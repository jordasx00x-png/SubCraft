import { SubtitleCue } from '../types/subtitle';
import { extractAudioFromFile } from '../utils/audioExtractor';

export interface WaveformBucket {
  t: number;
  rms: number;
  peak: number;
}

export interface SpeechSegment {
  start: number;
  end: number;
  avgEnergy: number;
  peakEnergy: number;
}

export interface SilenceRegion {
  start: number;
  end: number;
  duration: number;
}

export interface AutoAlignResult {
  alignedSubtitles: SubtitleCue[];
  adjustedCount: number;
  averageShiftSeconds: number;
  speechSegmentsCount: number;
  summary: string;
}

/**
 * Decode audio from File or URL (supporting locally restored blobs and /api/media streams).
 */
export async function decodeMediaAudio(
  videoFile: File | null | undefined,
  videoUrl: string | null | undefined
): Promise<AudioBuffer> {
  if (videoFile && videoFile.size > 0) {
    return await extractAudioFromFile(videoFile);
  }

  if (videoUrl) {
    let response: Response;
    try {
      response = await fetch(videoUrl);
    } catch {
      throw new Error(
        'No se pudo acceder al flujo de audio del video actual (CORS o archivo remoto). Importa un archivo de video o audio local para analizar la onda.'
      );
    }

    if (!response.ok) {
      throw new Error('No se pudo leer el archivo multimedia para analizar el audio.');
    }

    const arrayBuffer = await response.arrayBuffer();
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioCtxClass();
    try {
      return await audioCtx.decodeAudioData(arrayBuffer);
    } finally {
      audioCtx.close();
    }
  }

  throw new Error('No hay ningún archivo de video o audio cargado para analizar la onda.');
}

/**
 * Analyze decoded AudioBuffer to extract normalized waveform peaks (0-100),
 * active speech-activity bursts, and explicit silence (no-voice) regions
 * using percentile noise-floor & outlier-resistant VAD thresholding.
 */
export function analyzeWaveformPeaks(audioBuffer: AudioBuffer): {
  duration: number;
  waveformPeaks: WaveformBucket[];
  speechSegments: SpeechSegment[];
  silenceRegions: SilenceRegion[];
} {
  const duration = audioBuffer.duration || 0;
  const sampleRate = audioBuffer.sampleRate;
  const totalSamples = audioBuffer.length;

  // Mix down channels efficiently
  const channel0 = audioBuffer.getChannelData(0);
  const channel1 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null;

  // Fine analysis resolution: 50ms buckets for sharp speech-onset accuracy
  const bucketDuration = Math.max(0.05, Math.min(0.15, duration / 3600 || 0.05));
  const samplesPerBucket = Math.max(1, Math.floor(bucketDuration * sampleRate));
  const numBuckets = Math.ceil(totalSamples / samplesPerBucket);

  const rawRms: number[] = new Array(numBuckets);
  const rawPeak: number[] = new Array(numBuckets);
  let maxRms = 1e-6;
  let maxPeak = 1e-6;

  for (let b = 0; b < numBuckets; b++) {
    const startIdx = b * samplesPerBucket;
    const endIdx = Math.min(totalSamples, startIdx + samplesPerBucket);
    const count = Math.max(1, endIdx - startIdx);

    let sumSq = 0;
    let peak = 0;

    const stride = sampleRate >= 44100 ? 2 : 1;
    let sampledCount = 0;
    for (let i = startIdx; i < endIdx; i += stride) {
      const sample = channel1 ? (channel0[i] + channel1[i]) * 0.5 : channel0[i];
      const abs = Math.abs(sample);
      sumSq += sample * sample;
      if (abs > peak) peak = abs;
      sampledCount++;
    }

    const rms = Math.sqrt(sumSq / Math.max(1, sampledCount || count));
    rawRms[b] = rms;
    rawPeak[b] = peak;
    if (rms > maxRms) maxRms = rms;
    if (peak > maxPeak) maxPeak = peak;
  }

  // Outlier-resistant scaling using 98.5th percentile so isolated mic clicks don't flatten voice levels
  const sortedRms = [...rawRms].sort((a, b) => a - b);
  const sortedPeak = [...rawPeak].sort((a, b) => a - b);
  const scaleRms = Math.max(1e-5, sortedRms[Math.floor(sortedRms.length * 0.985)] || maxRms);
  const scalePeak = Math.max(1e-5, sortedPeak[Math.floor(sortedPeak.length * 0.985)] || maxPeak);

  const waveformPeaks: WaveformBucket[] = [];
  for (let b = 0; b < numBuckets; b++) {
    const t = Math.round(b * bucketDuration * 100) / 100;
    const rms = Math.min(100, Math.round((rawRms[b] / scaleRms) * 1000) / 10);
    const peak = Math.min(100, Math.round((rawPeak[b] / scalePeak) * 1000) / 10);
    waveformPeaks.push({ t, rms, peak });
  }

  // If the whole track is near-zero digital silence, return empty speech and full silence
  if (maxRms < 0.0012) {
    const silenceRegions: SilenceRegion[] =
      duration >= 0.35
        ? [{ start: 0, end: Math.round(duration * 100) / 100, duration: Math.round(duration * 100) / 100 }]
        : [];
    return { duration, waveformPeaks, speechSegments: [], silenceRegions };
  }

  // Adaptive threshold between quiet room-tone / soft intro (12th pct) and active voice (90th pct)
  const noiseFloorNorm = Math.min(100, (sortedRms[Math.floor(sortedRms.length * 0.12)] || 0) / scaleRms * 100);
  const speechCeilingNorm = Math.min(100, (sortedRms[Math.floor(sortedRms.length * 0.90)] || 0) / scaleRms * 100);
  const dynamicSpan = Math.max(0, speechCeilingNorm - noiseFloorNorm);
  const activeThreshold = Math.max(6, Math.min(42, noiseFloorNorm + Math.max(4.5, dynamicSpan * 0.22)));

  // Initial voice activity detection
  const rawActive: boolean[] = waveformPeaks.map(
    (w) => w.rms >= activeThreshold || w.peak >= activeThreshold * 1.65
  );

  // De-glitch: suppress isolated 1-bucket micro-clicks (< ~100ms) inside silence so they don't break silent regions
  const cleanedActive = [...rawActive];
  for (let i = 1; i < cleanedActive.length - 1; i++) {
    if (cleanedActive[i] && !rawActive[i - 1] && !rawActive[i + 1]) {
      const prev2Silent = i < 2 || !rawActive[i - 2];
      const next2Silent = i + 2 >= rawActive.length || !rawActive[i + 2];
      if (prev2Silent && next2Silent && waveformPeaks[i].rms < activeThreshold * 1.45) {
        cleanedActive[i] = false;
      }
    }
  }

  // Bridge brief intra-word / inter-syllable dips (~0.30s) inside continuous speech
  const bridgeBuckets = Math.max(1, Math.round(0.3 / bucketDuration));
  const bridged = [...cleanedActive];
  for (let i = 0; i < bridged.length; i++) {
    if (!bridged[i]) {
      let prevTrue = false;
      for (let back = 1; back <= bridgeBuckets && i - back >= 0; back++) {
        if (cleanedActive[i - back]) {
          prevTrue = true;
          break;
        }
      }
      let nextTrue = false;
      for (let fwd = 1; fwd <= bridgeBuckets && i + fwd < cleanedActive.length; fwd++) {
        if (cleanedActive[i + fwd]) {
          nextTrue = true;
          break;
        }
      }
      if (prevTrue && nextTrue) {
        bridged[i] = true;
      }
    }
  }

  const speechSegments: SpeechSegment[] = [];
  let inSeg = false;
  let segStartIdx = 0;

  for (let i = 0; i <= bridged.length; i++) {
    const active = i < bridged.length ? bridged[i] : false;
    if (active && !inSeg) {
      inSeg = true;
      segStartIdx = i;
    } else if (!active && inSeg) {
      inSeg = false;
      const start = Math.round(segStartIdx * bucketDuration * 100) / 100;
      const end = Math.min(duration, Math.round(i * bucketDuration * 100) / 100);
      if (end - start >= 0.18) {
        const slice = waveformPeaks.slice(segStartIdx, i);
        const avgEnergy = slice.reduce((acc, s) => acc + s.rms, 0) / Math.max(1, slice.length);
        const peakEnergy = slice.reduce((acc, s) => Math.max(acc, s.peak), 0);
        speechSegments.push({
          start,
          end,
          avgEnergy: Math.round(avgEnergy * 10) / 10,
          peakEnergy: Math.round(peakEnergy * 10) / 10,
        });
      }
    }
  }

  // Explicit silence (no-voice) regions >= 0.35s between speech bursts
  const silenceRegions: SilenceRegion[] = [];
  let cursor = 0;
  for (const seg of speechSegments) {
    if (seg.start - cursor >= 0.35) {
      const gapStart = Math.round(cursor * 100) / 100;
      const gapEnd = Math.round(seg.start * 100) / 100;
      silenceRegions.push({
        start: gapStart,
        end: gapEnd,
        duration: Math.round((gapEnd - gapStart) * 100) / 100,
      });
    }
    cursor = Math.max(cursor, seg.end);
  }
  if (duration - cursor >= 0.35) {
    const gapStart = Math.round(cursor * 100) / 100;
    const gapEnd = Math.round(duration * 100) / 100;
    silenceRegions.push({
      start: gapStart,
      end: gapEnd,
      duration: Math.round((gapEnd - gapStart) * 100) / 100,
    });
  }

  return { duration, waveformPeaks, speechSegments, silenceRegions };
}

/**
 * Isolate human vocal frequencies (220 Hz - 3.4 kHz) using OfflineAudioContext BiquadFilters
 * so low piano pads, basslines, and drums don't mask the exact entry of speech or singing.
 */
async function conditionVocalBuffer(audioBuffer: AudioBuffer): Promise<AudioBuffer> {
  if (audioBuffer.duration > 1200) return audioBuffer;
  const OfflineCtxClass =
    window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (!OfflineCtxClass) return audioBuffer;

  try {
    const targetRate = Math.min(16000, audioBuffer.sampleRate || 16000);
    const frameLength = Math.max(1, Math.ceil(audioBuffer.duration * targetRate));
    const offlineCtx = new OfflineCtxClass(1, frameLength, targetRate);

    const monoSrc = offlineCtx.createBuffer(1, audioBuffer.length, audioBuffer.sampleRate);
    const out = monoSrc.getChannelData(0);
    const ch0 = audioBuffer.getChannelData(0);
    const ch1 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null;
    if (ch1) {
      for (let i = 0; i < audioBuffer.length; i++) out[i] = (ch0[i] + ch1[i]) * 0.5;
    } else {
      out.set(ch0);
    }

    const src = offlineCtx.createBufferSource();
    src.buffer = monoSrc;

    const hp = offlineCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 220;
    hp.Q.value = 0.707;

    const lp = offlineCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3400;
    lp.Q.value = 0.707;

    src.connect(hp);
    hp.connect(lp);
    lp.connect(offlineCtx.destination);
    src.start(0);

    return await offlineCtx.startRendering();
  } catch {
    return audioBuffer;
  }
}

/**
 * Enforce strict chronological monotonicity and ground each cue against real speech onsets:
 * - Trims leading silence (>0.25s) so subtitles wait until the voice actually starts.
 * - Trims instrumental/low-energy intros inside oversized cues (e.g. 7 words spanning 16s from t=0).
 * - Shifts cues stranded entirely in silent gaps onto the matching speech onset when safe.
 * - Trims excessive trailing silence (>0.45s) hanging after speech ends.
 */
function normalizeAlignedCues(
  originalCues: SubtitleCue[],
  alignedMap: Map<string, { start: number; end: number }>,
  maxDuration: number,
  speechSegments: SpeechSegment[] = [],
  silenceRegions: SilenceRegion[] = [],
  waveformPeaks: WaveformBucket[] = []
): SubtitleCue[] {
  const result: SubtitleCue[] = [];
  let prevEnd = 0;

  for (let i = 0; i < originalCues.length; i++) {
    const orig = originalCues[i];
    const aligned = alignedMap.get(String(orig.id));

    let start = aligned && Number.isFinite(aligned.start) ? aligned.start : orig.start;
    let end = aligned && Number.isFinite(aligned.end) ? aligned.end : orig.end;

    const origDur = Math.max(0.45, (orig.end || 0) - (orig.start || 0));
    const wordsCount = (orig.text || '').trim().split(/\s+/).filter(Boolean).length;
    const expectedMaxSpeechDur = Math.max(4.0, wordsCount * 0.85);

    const nextOrig = i + 1 < originalCues.length ? originalCues[i + 1] : null;
    const nextAligned = nextOrig ? alignedMap.get(String(nextOrig.id)) : undefined;
    const nextCueBound = nextOrig
      ? Math.max(start + 0.45, nextAligned && Number.isFinite(nextAligned.start) ? nextAligned.start : nextOrig.start)
      : maxDuration;

    if (speechSegments.length > 0) {
      const overlapping = speechSegments.filter(
        (seg) => seg.end > start + 0.15 && seg.start < end - 0.15
      );

      if (overlapping.length > 0) {
        const firstSpeech = overlapping[0];
        const lastSpeech = overlapping[overlapping.length - 1];

        // Snap start forward when cue begins in prolonged silence (>0.25s) before voice onset
        if (firstSpeech.start - start > 0.25) {
          const snappedStart = Math.max(prevEnd, firstSpeech.start - 0.08);
          if (snappedStart < end - 0.35) {
            start = snappedStart;
          } else {
            start = snappedStart;
            end = Math.min(nextCueBound, Math.max(end, start + Math.min(origDur, 1.8)));
          }
        }

        // Trim dead silent tail (>0.45s) when cue lingers after voice finishes into a silence region
        if (end - lastSpeech.end > 0.45) {
          const overlapsSilenceTail = silenceRegions.some(
            (sil) => sil.start <= lastSpeech.end + 0.15 && sil.end >= end - 0.15
          );
          if (overlapsSilenceTail) {
            end = Math.max(start + 0.45, lastSpeech.end + 0.18);
          }
        }
      } else {
        // Cue fell completely inside a no-voice gap; snap forward to the earliest speech segment before nextCueBound
        const candidateSeg = speechSegments.find(
          (seg) => seg.end > Math.max(prevEnd, start) + 0.2 && seg.start < nextCueBound - 0.35
        );
        if (candidateSeg && candidateSeg.start > start) {
          const shiftedStart = Math.max(prevEnd, candidateSeg.start - 0.08);
          if (shiftedStart < nextCueBound - 0.35) {
            start = shiftedStart;
            end = Math.min(
              nextCueBound,
              Math.max(start + 0.45, Math.min(start + origDur, candidateSeg.end + 0.18))
            );
          }
        }
      }
    }

    // Oversized cue onset detector (handles song intros / low-energy intros like 0.0s -> 16.5s for 7 words)
    if (waveformPeaks.length > 0 && end - start > expectedMaxSpeechDur + 1.5) {
      const cuePeaks = waveformPeaks.filter((p) => p.t >= start && p.t <= end);
      if (cuePeaks.length >= 10) {
        const leadCutoff = start + Math.min(3.0, (end - start) * 0.3);
        const leadSlice = cuePeaks.filter((p) => p.t <= leadCutoff);
        const leadAvg =
          leadSlice.reduce((acc, p) => acc + p.rms, 0) / Math.max(1, leadSlice.length);

        const bucketStep = Math.max(0.05, (cuePeaks[1]?.t || 0.05) - (cuePeaks[0]?.t || 0));
        const winLen = Math.min(cuePeaks.length, Math.max(4, Math.round(1.0 / bucketStep)));
        let maxWinAvg = 0;
        for (let k = 0; k <= cuePeaks.length - winLen; k++) {
          let sum = 0;
          for (let j = 0; j < winLen; j++) sum += cuePeaks[k + j].rms;
          const avg = sum / winLen;
          if (avg > maxWinAvg) maxWinAvg = avg;
        }

        if (maxWinAvg >= Math.max(20, leadAvg * 1.45)) {
          const onsetThreshold = Math.max(leadAvg * 1.4, maxWinAvg * 0.46);
          const minKeepTail = Math.max(1.2, Math.min(expectedMaxSpeechDur * 0.7, wordsCount * 0.35));
          const latestAllowedStart = Math.max(start, end - minKeepTail);

          for (let k = 0; k < cuePeaks.length - 1; k++) {
            if (cuePeaks[k].t > latestAllowedStart) break;
            if (
              cuePeaks[k].rms >= onsetThreshold &&
              cuePeaks[k + 1].rms >= onsetThreshold * 0.85
            ) {
              if (cuePeaks[k].t - start > 0.5) {
                start = Math.max(prevEnd, cuePeaks[k].t - 0.1);
              }
              break;
            }
          }
        }
      }
    }

    start = Math.max(prevEnd, Math.min(maxDuration - 0.25, start));
    end = Math.max(start + 0.35, Math.min(maxDuration, end));

    if (end <= start) {
      end = Math.min(maxDuration, start + 0.4);
    }

    start = Math.round(start * 100) / 100;
    end = Math.round(end * 100) / 100;
    prevEnd = end;

    result.push({
      ...orig,
      start,
      end,
    });
  }

  return result;
}

/**
 * Full pipeline: Extract audio waveform peaks, detect speech bursts & silence gaps,
 * send to Gemini AI (/api/auto-align), and refine onset timestamps against the real waveform.
 */
export async function runAutoAlignSubtitles(options: {
  subtitles: SubtitleCue[];
  videoFile?: File | null;
  videoUrl?: string | null;
  audioBuffer?: AudioBuffer | null;
  duration: number;
  language?: string;
  onProgress?: (percent: number, stage: string) => void;
}): Promise<AutoAlignResult> {
  const {
    subtitles,
    videoFile,
    videoUrl,
    audioBuffer: preDecodedAudioBuffer,
    duration,
    language = 'es',
    onProgress,
  } = options;

  if (!subtitles || subtitles.length === 0) {
    throw new Error('No hay subtítulos en el proyecto para alinear.');
  }

  let audioBuffer = preDecodedAudioBuffer || null;
  if (!audioBuffer) {
    onProgress?.(20, 'Decodificando pista de audio...');
    audioBuffer = await decodeMediaAudio(videoFile, videoUrl);
  } else {
    onProgress?.(30, 'Reutilizando pista de audio decodificada...');
  }

  onProgress?.(42, 'Aislando frecuencias vocales y detectando inicios de voz...');
  const vocalBuffer = await conditionVocalBuffer(audioBuffer);
  const analysis = analyzeWaveformPeaks(vocalBuffer);
  const actualDuration = analysis.duration > 0 ? analysis.duration : duration;

  if (analysis.waveformPeaks.length === 0) {
    throw new Error('La pista de audio está vacía o no contiene picos analizables.');
  }

  onProgress?.(72, 'Alineando bloques al inicio real de voz con Gemini IA...');

  // Process in compact chunks of 30 cues so long projects stay fast and never hit HTTP timeouts
  const CHUNK_SIZE = 30;
  const alignedMap = new Map<string, { start: number; end: number }>();
  let lastSummary = '';

  for (let offset = 0; offset < subtitles.length; offset += CHUNK_SIZE) {
    const chunk = subtitles.slice(offset, offset + CHUNK_SIZE);
    const batchStartIdx = offset + 1;
    const batchEndIdx = Math.min(subtitles.length, offset + chunk.length);
    const progressPct = 70 + Math.round((offset / Math.max(1, subtitles.length)) * 22);
    onProgress?.(
      progressPct,
      `Alineando bloques ${batchStartIdx}–${batchEndIdx} de ${subtitles.length} con Gemini IA...`
    );

    const minT = Math.max(0, chunk[0].start - 25);
    const maxT = Math.min(actualDuration, chunk[chunk.length - 1].end + 25);

    let windowPeaks = analysis.waveformPeaks.filter((p) => p.t >= minT && p.t <= maxT);
    let windowSegments = analysis.speechSegments.filter((s) => s.end >= minT && s.start <= maxT);
    let windowSilences = analysis.silenceRegions.filter((s) => s.end >= minT && s.start <= maxT);

    // If window looks sparse (e.g., heavily desynchronized cues), fall back to full compressed waveform
    if (windowSegments.length < Math.max(2, Math.floor(chunk.length / 5))) {
      const step = Math.max(1, Math.ceil(analysis.waveformPeaks.length / 450));
      windowPeaks = analysis.waveformPeaks.filter((_, idx) => idx % step === 0);
      windowSegments = analysis.speechSegments;
      windowSilences = analysis.silenceRegions;
    } else if (windowPeaks.length > 450) {
      const step = Math.ceil(windowPeaks.length / 450);
      windowPeaks = windowPeaks.filter((_, idx) => idx % step === 0);
    }

    const res = await fetch('/api/auto-align', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subtitles: chunk,
        duration: actualDuration,
        language,
        speechSegments: windowSegments,
        silenceRegions: windowSilences,
        waveformPeaks: windowPeaks,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      throw new Error(
        json.error || `Error del servidor (${res.status}) al ejecutar la alineación automática con IA.`
      );
    }

    if (json.data?.summary) {
      lastSummary = json.data.summary;
    }

    for (const item of json.data?.alignedCues || []) {
      alignedMap.set(String(item.id), {
        start: Number(item.start),
        end: Number(item.end),
      });
    }
  }

  onProgress?.(95, 'Ajustando inicios exactos de voz y recortando silencios...');
  const alignedSubtitles = normalizeAlignedCues(
    subtitles,
    alignedMap,
    actualDuration,
    analysis.speechSegments,
    analysis.silenceRegions,
    analysis.waveformPeaks
  );

  let adjustedCount = 0;
  let totalAbsShift = 0;
  for (let i = 0; i < subtitles.length; i++) {
    const diffStart = Math.abs(alignedSubtitles[i].start - subtitles[i].start);
    const diffEnd = Math.abs(alignedSubtitles[i].end - subtitles[i].end);
    if (diffStart >= 0.05 || diffEnd >= 0.05) {
      adjustedCount++;
    }
    totalAbsShift += diffStart;
  }

  const averageShiftSeconds = Math.round((totalAbsShift / Math.max(1, subtitles.length)) * 100) / 100;

  onProgress?.(100, '¡Subtítulos alineados con el habla!');

  return {
    alignedSubtitles,
    adjustedCount,
    averageShiftSeconds,
    speechSegmentsCount: analysis.speechSegments.length,
    summary:
      lastSummary ||
      `Se ajustaron ${adjustedCount} bloques a ${analysis.speechSegments.length} segmentos de voz detectados.`,
  };
}
