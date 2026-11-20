import { SubtitleCue } from '../types/subtitle';

export interface VadSilenceSegment {
  id: string;
  start: number;
  end: number;
  duration: number;
  avgEnergyDb: number;
}

export interface VadVoiceSegment {
  start: number;
  end: number;
  duration: number;
  avgEnergy: number;
  peakEnergy: number;
}

export type VadSuggestionKind =
  | 'trim-leading-silence'
  | 'shift-out-of-silence'
  | 'trim-trailing-silence';

export interface SubtitleOffsetSuggestion {
  id: string;
  cueId: string | number;
  cueIndex: number;
  cueText: string;
  currentStart: number;
  currentEnd: number;
  suggestedStart: number;
  suggestedEnd: number;
  offsetSeconds: number;
  silenceSegment: VadSilenceSegment;
  reason: string;
  kind: VadSuggestionKind;
}

export interface VadEnvelopePoint {
  t: number;
  rms: number;
}

export interface VadAnalysisResult {
  duration: number;
  sampleRate: number;
  noiseFloorDb: number;
  thresholdNorm: number;
  minSilenceDuration: number;
  waveformPreview: number[];
  waveformEnvelope: VadEnvelopePoint[];
  silenceSegments: VadSilenceSegment[];
  voiceSegments: VadVoiceSegment[];
  totalSilenceDuration: number;
  suggestions: SubtitleOffsetSuggestion[];
  recommendedGlobalOffsetSeconds: number | null;
}

export interface RunVadOptions {
  videoFile?: File | null;
  videoUrl?: string | null;
  subtitles: SubtitleCue[];
  minSilenceDurationSec?: number;
  sensitivity?: 'balanced' | 'strict' | 'sensitive';
  onProgress?: (percent: number, stage: string) => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Decode audio track from File or URL using Web Audio API AudioContext.
 */
async function decodeAudioWithWebAudio(
  videoFile?: File | null,
  videoUrl?: string | null
): Promise<AudioBuffer> {
  const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtxClass) {
    throw new Error('Tu navegador no soporta Web Audio API para analizar la onda.');
  }

  let arrayBuffer: ArrayBuffer;

  if (videoFile && videoFile.size > 0) {
    arrayBuffer = await videoFile.arrayBuffer();
  } else if (videoUrl) {
    let res: Response;
    try {
      res = await fetch(videoUrl);
    } catch {
      throw new Error(
        'No se pudo leer el audio del video actual (CORS o enlace remoto). Carga un archivo local para usar el detector VAD.'
      );
    }
    if (!res.ok) {
      throw new Error('No se pudo descargar el audio del video para el análisis VAD.');
    }
    arrayBuffer = await res.arrayBuffer();
  } else {
    throw new Error('Carga un video o audio antes de ejecutar el análisis VAD.');
  }

  const audioCtx = new AudioCtxClass();
  try {
    return await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    audioCtx.close();
  }
}

/**
 * Condition decoded audio through Web Audio API BiquadFilterNodes (130 Hz high-pass + 4 kHz low-pass)
 * inside an OfflineAudioContext to isolate the human vocal band before measuring RMS energy.
 */
async function isolateSpeechBand(audioBuffer: AudioBuffer): Promise<AudioBuffer> {
  // For ultra-long (>20min) high-sample-rate tracks, skip offline render to avoid excess RAM allocation
  if (audioBuffer.duration > 1200) {
    return audioBuffer;
  }

  const OfflineCtxClass =
    window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (!OfflineCtxClass) {
    return audioBuffer;
  }

  try {
    const targetSampleRate = Math.min(16000, audioBuffer.sampleRate || 16000);
    const frameLength = Math.max(1, Math.ceil(audioBuffer.duration * targetSampleRate));
    const offlineCtx = new OfflineCtxClass(1, frameLength, targetSampleRate);

    // Downmix to mono source buffer at original sample rate
    const monoSrcBuffer = offlineCtx.createBuffer(1, audioBuffer.length, audioBuffer.sampleRate);
    const monoOut = monoSrcBuffer.getChannelData(0);
    const ch0 = audioBuffer.getChannelData(0);
    const ch1 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null;

    if (ch1) {
      for (let i = 0; i < audioBuffer.length; i++) {
        monoOut[i] = (ch0[i] + ch1[i]) * 0.5;
      }
    } else {
      monoOut.set(ch0);
    }

    const source = offlineCtx.createBufferSource();
    source.buffer = monoSrcBuffer;

    const highpass = offlineCtx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 220;
    highpass.Q.value = 0.707;

    const lowpass = offlineCtx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3400;
    lowpass.Q.value = 0.707;

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(offlineCtx.destination);
    source.start(0);

    return await offlineCtx.startRendering();
  } catch (err) {
    console.warn('VAD OfflineAudioContext bandpass skipped, using raw PCM buffer:', err);
    return audioBuffer;
  }
}

/**
 * Recompute subtitle timing offset suggestions against an existing VAD result.
 * Safe to invoke synchronously whenever subtitles are edited in the inspector or timeline.
 */
export function computeSubtitleOffsetSuggestions(
  subtitles: SubtitleCue[],
  silenceSegments: VadSilenceSegment[],
  voiceSegments: VadVoiceSegment[],
  duration: number,
  waveformEnvelope: VadEnvelopePoint[] = []
): {
  suggestions: SubtitleOffsetSuggestion[];
  recommendedGlobalOffsetSeconds: number | null;
} {
  if (
    !subtitles ||
    subtitles.length === 0 ||
    (silenceSegments.length === 0 && waveformEnvelope.length === 0)
  ) {
    return { suggestions: [], recommendedGlobalOffsetSeconds: null };
  }

  const ordered = [...subtitles].sort((a, b) => a.start - b.start);
  const suggestions: SubtitleOffsetSuggestion[] = [];
  const directionalOffsets: number[] = [];

  for (let i = 0; i < ordered.length; i++) {
    const cue = ordered[i];
    const cueStart = Number(cue.start || 0);
    const cueEnd = Number(cue.end || cueStart + 0.5);
    const cueDur = Math.max(0.45, cueEnd - cueStart);
    const prevEndBound = i > 0 ? Number(ordered[i - 1].end || 0) : 0;
    const nextStartBound =
      i + 1 < ordered.length ? Number(ordered[i + 1].start || duration) : duration;

    // 1. Check if a silence segment (>1s) covers the start of the cue before voice begins
    const leadingSilence = silenceSegments.find(
      (sil) => sil.start <= cueStart + 0.15 && sil.end > cueStart + 0.35 && sil.end < cueEnd + 1.5
    );

    if (leadingSilence) {
      // Find voice onset right after this silence
      const nextVoice = voiceSegments.find((v) => v.start >= leadingSilence.end - 0.15);
      const voiceOnset = nextVoice ? nextVoice.start : leadingSilence.end;
      const targetStart = round2(Math.max(prevEndBound, voiceOnset - 0.08));

      // Case A: Cue starts in silence and spans into voice
      if (targetStart < cueEnd - 0.35 && targetStart - cueStart >= 0.3) {
        const delta = round2(targetStart - cueStart);
        suggestions.push({
          id: `vad-sug-${cue.id}-lead`,
          cueId: cue.id,
          cueIndex: i + 1,
          cueText: cue.text,
          currentStart: round2(cueStart),
          currentEnd: round2(cueEnd),
          suggestedStart: targetStart,
          suggestedEnd: round2(cueEnd),
          offsetSeconds: delta,
          silenceSegment: leadingSilence,
          kind: 'trim-leading-silence',
          reason: `Empieza ${delta.toFixed(2)}s antes de la voz (silencio ${round2(
            leadingSilence.start
          )}s–${round2(leadingSilence.end)}s).`,
        });
        directionalOffsets.push(delta);
        continue;
      }

      // Case B: Entire cue sits inside the silence segment (>1s) before voice resumes
      if (cueEnd <= leadingSilence.end + 0.25 && nextVoice) {
        const shiftedStart = round2(Math.max(prevEndBound, nextVoice.start - 0.08));
        const shiftedEnd = round2(
          Math.min(
            nextStartBound > shiftedStart + 0.45 ? nextStartBound : duration,
            Math.max(shiftedStart + 0.45, Math.min(shiftedStart + cueDur, nextVoice.end + 0.18))
          )
        );
        const delta = round2(shiftedStart - cueStart);
        if (Math.abs(delta) >= 0.3 && shiftedEnd > shiftedStart + 0.35) {
          suggestions.push({
            id: `vad-sug-${cue.id}-shift`,
            cueId: cue.id,
            cueIndex: i + 1,
            cueText: cue.text,
            currentStart: round2(cueStart),
            currentEnd: round2(cueEnd),
            suggestedStart: shiftedStart,
            suggestedEnd: shiftedEnd,
            offsetSeconds: delta,
            silenceSegment: leadingSilence,
            kind: 'shift-out-of-silence',
            reason: `El bloque completo cae en silencio de ${leadingSilence.duration.toFixed(
              1
            )}s; mover al inicio de voz en ${shiftedStart.toFixed(2)}s.`,
          });
          directionalOffsets.push(delta);
          continue;
        }
      }
    }

    // 2. Check if the cue sits wholly inside a silence segment (>1s) without touching its start
    const enclosingSilence = silenceSegments.find(
      (sil) => cueStart >= sil.start - 0.1 && cueEnd <= sil.end + 0.1
    );
    if (enclosingSilence) {
      const voiceAfter = voiceSegments.find(
        (v) => v.start >= enclosingSilence.end - 0.15 && v.start < nextStartBound - 0.35
      );
      const voiceBefore = [...voiceSegments]
        .reverse()
        .find((v) => v.end <= enclosingSilence.start + 0.15 && v.end > prevEndBound + 0.35);

      const chosenVoice = voiceAfter || voiceBefore;
      if (chosenVoice) {
        const targetStart = round2(
          Math.max(prevEndBound, Math.min(duration - 0.45, chosenVoice.start - 0.08))
        );
        const maxBound = voiceAfter
          ? Math.max(targetStart + 0.45, nextStartBound)
          : enclosingSilence.start + 0.2;
        const targetEnd = round2(
          Math.min(
            maxBound,
            Math.max(targetStart + 0.45, Math.min(targetStart + cueDur, chosenVoice.end + 0.18))
          )
        );
        const delta = round2(targetStart - cueStart);
        if (Math.abs(delta) >= 0.3 && targetEnd > targetStart + 0.35) {
          suggestions.push({
            id: `vad-sug-${cue.id}-enclose`,
            cueId: cue.id,
            cueIndex: i + 1,
            cueText: cue.text,
            currentStart: round2(cueStart),
            currentEnd: round2(cueEnd),
            suggestedStart: targetStart,
            suggestedEnd: targetEnd,
            offsetSeconds: delta,
            silenceSegment: enclosingSilence,
            kind: 'shift-out-of-silence',
            reason: `Ubicado dentro de silencio sin voz (${enclosingSilence.duration.toFixed(
              1
            )}s); desplazar ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}s.`,
          });
          directionalOffsets.push(delta);
          continue;
        }
      }
    }

    // 3. Check trailing silence: cue continues >0.8s past voice stop into a >1s silence
    const trailingSilence = silenceSegments.find(
      (sil) => sil.start > cueStart + 0.45 && sil.start < cueEnd - 0.8
    );
    if (trailingSilence) {
      const trimmedEnd = round2(Math.max(cueStart + 0.45, trailingSilence.start + 0.18));
      const deltaEnd = round2(trimmedEnd - cueEnd);
      if (deltaEnd <= -0.5) {
        suggestions.push({
          id: `vad-sug-${cue.id}-trail`,
          cueId: cue.id,
          cueIndex: i + 1,
          cueText: cue.text,
          currentStart: round2(cueStart),
          currentEnd: round2(cueEnd),
          suggestedStart: round2(cueStart),
          suggestedEnd: trimmedEnd,
          offsetSeconds: deltaEnd,
          silenceSegment: trailingSilence,
          kind: 'trim-trailing-silence',
          reason: `Permanece visible ${Math.abs(deltaEnd).toFixed(
            2
          )}s durante un silencio posterior; recortar fin a ${trimmedEnd.toFixed(2)}s.`,
        });
        continue;
      }
    }

    // 4. Oversized cue with low-energy instrumental/non-vocal intro (e.g. 0s -> 16.5s for 7 words)
    const wordsCount = (cue.text || '').trim().split(/\s+/).filter(Boolean).length;
    const expectedMaxSpeechDur = Math.max(4.0, wordsCount * 0.85);
    if (waveformEnvelope.length > 0 && cueDur > expectedMaxSpeechDur + 1.5) {
      const cueEnv = waveformEnvelope.filter((p) => p.t >= cueStart && p.t <= cueEnd);
      if (cueEnv.length >= 8) {
        const leadCutoff = cueStart + Math.min(3.0, cueDur * 0.3);
        const leadSlice = cueEnv.filter((p) => p.t <= leadCutoff);
        const leadAvg =
          leadSlice.reduce((acc, p) => acc + p.rms, 0) / Math.max(1, leadSlice.length);

        const stepSec = Math.max(0.1, (cueEnv[1]?.t || 0.2) - (cueEnv[0]?.t || 0));
        const winLen = Math.min(cueEnv.length, Math.max(3, Math.round(1.0 / stepSec)));
        let maxWinAvg = 0;
        for (let k = 0; k <= cueEnv.length - winLen; k++) {
          let sum = 0;
          for (let j = 0; j < winLen; j++) sum += cueEnv[k + j].rms;
          const avg = sum / winLen;
          if (avg > maxWinAvg) maxWinAvg = avg;
        }

        if (maxWinAvg >= Math.max(20, leadAvg * 1.45)) {
          const onsetThreshold = Math.max(leadAvg * 1.4, maxWinAvg * 0.46);
          const minKeepTail = Math.max(
            1.2,
            Math.min(expectedMaxSpeechDur * 0.7, wordsCount * 0.35)
          );
          const latestAllowedStart = Math.max(cueStart, cueEnd - minKeepTail);

          for (let k = 0; k < cueEnv.length - 1; k++) {
            if (cueEnv[k].t > latestAllowedStart) break;
            if (
              cueEnv[k].rms >= onsetThreshold &&
              cueEnv[k + 1].rms >= onsetThreshold * 0.85
            ) {
              const targetStart = round2(Math.max(prevEndBound, cueEnv[k].t - 0.1));
              const delta = round2(targetStart - cueStart);
              if (delta >= 0.8 && targetStart < cueEnd - 0.45) {
                suggestions.push({
                  id: `vad-sug-${cue.id}-intro`,
                  cueId: cue.id,
                  cueIndex: i + 1,
                  cueText: cue.text,
                  currentStart: round2(cueStart),
                  currentEnd: round2(cueEnd),
                  suggestedStart: targetStart,
                  suggestedEnd: round2(cueEnd),
                  offsetSeconds: delta,
                  silenceSegment: {
                    id: `intro-${cue.id}`,
                    start: round2(cueStart),
                    end: targetStart,
                    duration: delta,
                    avgEnergyDb: -35,
                  },
                  kind: 'trim-leading-silence',
                  reason: `Intro sin voz (${cueDur.toFixed(1)}s para ${wordsCount} palabras); la voz entra cerca de ${targetStart.toFixed(2)}s.`,
                });
                directionalOffsets.push(delta);
              }
              break;
            }
          }
        }
      }
    }
  }

  // Compute global offset recommendation when >= 2 start-shift suggestions align in direction
  let recommendedGlobalOffsetSeconds: number | null = null;
  if (directionalOffsets.length >= 2) {
    const sorted = [...directionalOffsets].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const sameSignCount = directionalOffsets.filter(
      (d) => Math.sign(d) === Math.sign(median) && Math.abs(d) >= 0.25
    ).length;
    if (sameSignCount >= 2 && Math.abs(median) >= 0.25) {
      recommendedGlobalOffsetSeconds = round2(median);
    }
  }

  return { suggestions, recommendedGlobalOffsetSeconds };
}

/**
 * Apply one or multiple VAD offset suggestions safely without overlaps.
 */
export function applyVadSuggestionsToCues(
  subtitles: SubtitleCue[],
  suggestionsToApply: SubtitleOffsetSuggestion[],
  maxDuration: number
): SubtitleCue[] {
  if (!suggestionsToApply.length) return subtitles;

  const mapById = new Map<string, SubtitleOffsetSuggestion>();
  for (const s of suggestionsToApply) {
    mapById.set(String(s.cueId), s);
  }

  const sorted = [...subtitles].sort((a, b) => a.start - b.start);
  const result: SubtitleCue[] = [];
  let prevEnd = 0;

  for (const cue of sorted) {
    const sug = mapById.get(String(cue.id));
    let start = sug ? sug.suggestedStart : cue.start;
    let end = sug ? sug.suggestedEnd : cue.end;

    start = round2(Math.max(prevEnd, Math.min(maxDuration - 0.35, start)));
    end = round2(Math.max(start + 0.35, Math.min(maxDuration, end)));
    prevEnd = end;

    result.push({
      ...cue,
      start,
      end,
    });
  }

  return result;
}

/**
 * Frontend Web Audio API Voice Activity Detection (VAD) pipeline:
 * 1. Decodes video/audio stream via AudioContext.
 * 2. Isolates human vocal frequencies (130 Hz - 4 kHz) via OfflineAudioContext BiquadFilters.
 * 3. Measures 50ms RMS energy frames against adaptive percentile noise floor.
 * 4. Identifies all silence intervals longer than `minSilenceDurationSec` (default 1.0s).
 * 5. Suggests concrete subtitle timing offsets to snap cues out of silence and onto speech onsets.
 */
export async function analyzeVideoWithWebAudioVad(
  options: RunVadOptions
): Promise<VadAnalysisResult> {
  const {
    videoFile,
    videoUrl,
    subtitles,
    minSilenceDurationSec = 1.0,
    sensitivity = 'balanced',
    onProgress,
  } = options;

  onProgress?.(15, 'Decodificando audio con Web Audio API...');
  const rawBuffer = await decodeAudioWithWebAudio(videoFile, videoUrl);

  onProgress?.(40, 'Aplicando filtro vocal (130 Hz – 4 kHz)...');
  const filteredBuffer = await isolateSpeechBand(rawBuffer);

  onProgress?.(68, 'Analizando energía RMS e identificando silencios > 1s...');
  const duration = rawBuffer.duration || filteredBuffer.duration || 0;
  const sampleRate = filteredBuffer.sampleRate;
  const totalSamples = filteredBuffer.length;
  const channelData = filteredBuffer.getChannelData(0);

  // 50ms analysis frames (capped slightly on ultra-long media)
  const frameDuration = Math.max(0.05, Math.min(0.12, duration / 4000 || 0.05));
  const samplesPerFrame = Math.max(1, Math.floor(frameDuration * sampleRate));
  const numFrames = Math.ceil(totalSamples / samplesPerFrame);

  const frameRms: number[] = new Array(numFrames);
  let maxRms = 1e-7;

  for (let f = 0; f < numFrames; f++) {
    const startIdx = f * samplesPerFrame;
    const endIdx = Math.min(totalSamples, startIdx + samplesPerFrame);
    let sumSq = 0;
    const stride = sampleRate >= 32000 ? 2 : 1;
    let count = 0;
    for (let i = startIdx; i < endIdx; i += stride) {
      const s = channelData[i];
      sumSq += s * s;
      count++;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, count));
    frameRms[f] = rms;
    if (rms > maxRms) maxRms = rms;
  }

  // Outlier-resistant scaling via 98.5th percentile
  const sortedRms = [...frameRms].sort((a, b) => a - b);
  const scaleRms = Math.max(1e-6, sortedRms[Math.floor(sortedRms.length * 0.985)] || maxRms);
  const noiseFloorRaw = sortedRms[Math.floor(sortedRms.length * 0.12)] || 1e-6;
  const noiseFloorDb = round2(20 * Math.log10(Math.max(1e-6, noiseFloorRaw)));

  const normFrames = frameRms.map((r) => Math.min(100, (r / scaleRms) * 100));
  const noiseFloorNorm = Math.min(100, (noiseFloorRaw / scaleRms) * 100);
  const speechCeilingNorm = Math.min(
    100,
    ((sortedRms[Math.floor(sortedRms.length * 0.9)] || maxRms) / scaleRms) * 100
  );
  const dynamicSpan = Math.max(0, speechCeilingNorm - noiseFloorNorm);

  const sensitivityMultiplier =
    sensitivity === 'strict' ? 0.28 : sensitivity === 'sensitive' ? 0.14 : 0.22;
  const thresholdNorm = round2(
    Math.max(5.5, Math.min(42, noiseFloorNorm + Math.max(4.5, dynamicSpan * sensitivityMultiplier)))
  );

  // Digital silence check
  let voiceSegments: VadVoiceSegment[] = [];
  if (maxRms >= 0.001) {
    const rawActive = normFrames.map((v) => v >= thresholdNorm);

    // Suppress isolated single-frame clicks (<120ms) inside silent spans
    const cleaned = [...rawActive];
    for (let i = 1; i < cleaned.length - 1; i++) {
      if (cleaned[i] && !rawActive[i - 1] && !rawActive[i + 1]) {
        const p2 = i < 2 || !rawActive[i - 2];
        const n2 = i + 2 >= rawActive.length || !rawActive[i + 2];
        if (p2 && n2 && normFrames[i] < thresholdNorm * 1.45) {
          cleaned[i] = false;
        }
      }
    }

    // Bridge natural brief pauses inside speech (~0.30s)
    const bridgeFrames = Math.max(1, Math.round(0.3 / frameDuration));
    const bridged = [...cleaned];
    for (let i = 0; i < bridged.length; i++) {
      if (!bridged[i]) {
        let prevVoice = false;
        for (let b = 1; b <= bridgeFrames && i - b >= 0; b++) {
          if (cleaned[i - b]) {
            prevVoice = true;
            break;
          }
        }
        let nextVoice = false;
        for (let f = 1; f <= bridgeFrames && i + f < cleaned.length; f++) {
          if (cleaned[i + f]) {
            nextVoice = true;
            break;
          }
        }
        if (prevVoice && nextVoice) {
          bridged[i] = true;
        }
      }
    }

    let inVoice = false;
    let segStartIdx = 0;
    for (let i = 0; i <= bridged.length; i++) {
      const active = i < bridged.length ? bridged[i] : false;
      if (active && !inVoice) {
        inVoice = true;
        segStartIdx = i;
      } else if (!active && inVoice) {
        inVoice = false;
        const start = round2(segStartIdx * frameDuration);
        const end = round2(Math.min(duration, i * frameDuration));
        if (end - start >= 0.18) {
          const slice = normFrames.slice(segStartIdx, i);
          const avgEnergy = slice.reduce((a, b) => a + b, 0) / Math.max(1, slice.length);
          const peakEnergy = slice.reduce((a, b) => Math.max(a, b), 0);
          voiceSegments.push({
            start,
            end,
            duration: round2(end - start),
            avgEnergy: Math.round(avgEnergy * 10) / 10,
            peakEnergy: Math.round(peakEnergy * 10) / 10,
          });
        }
      }
    }
  }

  // Extract silence segments strictly longer than minSilenceDurationSec (default > 1.0s)
  const silenceSegments: VadSilenceSegment[] = [];
  const pushSilenceIfLong = (gapStart: number, gapEnd: number) => {
    const dur = round2(gapEnd - gapStart);
    if (dur > minSilenceDurationSec) {
      const startFrame = Math.max(0, Math.floor(gapStart / frameDuration));
      const endFrame = Math.min(frameRms.length, Math.ceil(gapEnd / frameDuration));
      const slice = frameRms.slice(startFrame, Math.max(startFrame + 1, endFrame));
      const avgRaw = slice.reduce((a, b) => a + b, 0) / Math.max(1, slice.length);
      const avgEnergyDb = round2(20 * Math.log10(Math.max(1e-6, avgRaw)));

      silenceSegments.push({
        id: `sil-${silenceSegments.length + 1}`,
        start: round2(gapStart),
        end: round2(gapEnd),
        duration: dur,
        avgEnergyDb,
      });
    }
  };

  let cursor = 0;
  for (const seg of voiceSegments) {
    if (seg.start > cursor) {
      pushSilenceIfLong(cursor, seg.start);
    }
    cursor = Math.max(cursor, seg.end);
  }
  if (duration > cursor) {
    pushSilenceIfLong(cursor, duration);
  }

  // Compact 100-bar envelope for UI mini-waveform display
  const PREVIEW_BARS = 100;
  const waveformPreview: number[] = [];
  const step = Math.max(1, normFrames.length / PREVIEW_BARS);
  for (let b = 0; b < PREVIEW_BARS; b++) {
    const idxStart = Math.floor(b * step);
    const idxEnd = Math.min(normFrames.length, Math.max(idxStart + 1, Math.floor((b + 1) * step)));
    let maxInBar = 0;
    for (let j = idxStart; j < idxEnd; j++) {
      if (normFrames[j] > maxInBar) maxInBar = normFrames[j];
    }
    waveformPreview.push(Math.round(maxInBar));
  }

  // Build ~0.20s resolution RMS envelope for cue-level onset diagnostics
  const waveformEnvelope: VadEnvelopePoint[] = [];
  const envStride = Math.max(1, Math.round(0.2 / frameDuration));
  for (let i = 0; i < normFrames.length; i += envStride) {
    let sum = 0;
    let count = 0;
    for (let j = i; j < Math.min(normFrames.length, i + envStride); j++) {
      sum += normFrames[j];
      count++;
    }
    waveformEnvelope.push({
      t: round2(i * frameDuration),
      rms: Math.round((sum / Math.max(1, count)) * 10) / 10,
    });
  }

  onProgress?.(90, 'Calculando sugerencias de desplazamiento de subtítulos...');
  const { suggestions, recommendedGlobalOffsetSeconds } = computeSubtitleOffsetSuggestions(
    subtitles,
    silenceSegments,
    voiceSegments,
    duration,
    waveformEnvelope
  );

  const totalSilenceDuration = round2(
    silenceSegments.reduce((acc, s) => acc + s.duration, 0)
  );

  onProgress?.(100, 'Análisis VAD completado');

  return {
    duration: round2(duration),
    sampleRate,
    noiseFloorDb,
    thresholdNorm,
    minSilenceDuration: minSilenceDurationSec,
    waveformPreview,
    waveformEnvelope,
    silenceSegments,
    voiceSegments,
    totalSilenceDuration,
    suggestions,
    recommendedGlobalOffsetSeconds,
  };
}
