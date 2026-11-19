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
async function decodeMediaAudio(
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
 * Analyze decoded AudioBuffer to extract normalized waveform peaks (0-100)
 * and contiguous speech-activity bursts using adaptive noise-floor thresholding.
 */
export function analyzeWaveformPeaks(audioBuffer: AudioBuffer): {
  duration: number;
  waveformPeaks: WaveformBucket[];
  speechSegments: SpeechSegment[];
} {
  const duration = audioBuffer.duration || 0;
  const sampleRate = audioBuffer.sampleRate;
  const totalSamples = audioBuffer.length;

  // Mix down channels efficiently
  const channel0 = audioBuffer.getChannelData(0);
  const channel1 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null;

  // Fine analysis resolution: 100ms buckets (capped around 2400 buckets for very long audio)
  const bucketDuration = Math.max(0.1, Math.min(0.25, duration / 1800 || 0.1));
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

    // Step by 2 samples on high sample-rate audio for fast scanning without losing peak accuracy
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

  // Normalize to 0..100 scale
  const waveformPeaks: WaveformBucket[] = [];
  const sortedRms = [...rawRms].sort((a, b) => a - b);
  const noiseFloorNorm = (sortedRms[Math.floor(sortedRms.length * 0.2)] || 0) / maxRms * 100;
  const activeThreshold = Math.max(8, Math.min(28, noiseFloorNorm * 1.9 + 5));

  for (let b = 0; b < numBuckets; b++) {
    const t = Math.round(b * bucketDuration * 100) / 100;
    const rms = Math.round((rawRms[b] / maxRms) * 1000) / 10;
    const peak = Math.round((rawPeak[b] / maxPeak) * 1000) / 10;
    waveformPeaks.push({ t, rms, peak });
  }

  // Detect contiguous speech bursts with hysteresis & brief pause bridging (~0.3s)
  const rawActive: boolean[] = waveformPeaks.map((w) => w.rms >= activeThreshold || w.peak >= activeThreshold * 1.5);
  const bridgeBuckets = Math.max(1, Math.round(0.32 / bucketDuration));

  // Fill short silence dips inside active speech
  const bridged = [...rawActive];
  for (let i = 0; i < bridged.length; i++) {
    if (!bridged[i]) {
      let prevTrue = false;
      for (let back = 1; back <= bridgeBuckets && i - back >= 0; back++) {
        if (rawActive[i - back]) {
          prevTrue = true;
          break;
        }
      }
      let nextTrue = false;
      for (let fwd = 1; fwd <= bridgeBuckets && i + fwd < rawActive.length; fwd++) {
        if (rawActive[i + fwd]) {
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
      if (end - start >= 0.2) {
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

  return { duration, waveformPeaks, speechSegments };
}

/**
 * Enforce strict chronological monotonicity and valid time bounds after AI alignment.
 */
function normalizeAlignedCues(
  originalCues: SubtitleCue[],
  alignedMap: Map<string, { start: number; end: number }>,
  maxDuration: number
): SubtitleCue[] {
  const result: SubtitleCue[] = [];
  let prevEnd = 0;

  for (let i = 0; i < originalCues.length; i++) {
    const orig = originalCues[i];
    const aligned = alignedMap.get(String(orig.id));

    let start = aligned && Number.isFinite(aligned.start) ? aligned.start : orig.start;
    let end = aligned && Number.isFinite(aligned.end) ? aligned.end : orig.end;

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
 * Full pipeline: Extract audio waveform peaks, detect speech bursts, send to Gemini AI (/api/auto-align),
 * and return re-timed SubtitleCues preserving all text, IDs, and speakers.
 */
export async function runAutoAlignSubtitles(options: {
  subtitles: SubtitleCue[];
  videoFile?: File | null;
  videoUrl?: string | null;
  duration: number;
  language?: string;
  onProgress?: (percent: number, stage: string) => void;
}): Promise<AutoAlignResult> {
  const { subtitles, videoFile, videoUrl, duration, language = 'es', onProgress } = options;

  if (!subtitles || subtitles.length === 0) {
    throw new Error('No hay subtítulos en el proyecto para alinear.');
  }

  onProgress?.(20, 'Decodificando pista de audio...');
  const audioBuffer = await decodeMediaAudio(videoFile, videoUrl);

  onProgress?.(48, 'Analizando picos de onda y segmentos de voz...');
  const analysis = analyzeWaveformPeaks(audioBuffer);
  const actualDuration = analysis.duration > 0 ? analysis.duration : duration;

  if (analysis.waveformPeaks.length === 0) {
    throw new Error('La pista de audio está vacía o no contiene picos analizables.');
  }

  onProgress?.(72, 'Alineando bloques de subtítulos con Gemini IA...');

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

    const minT = Math.max(0, chunk[0].start - 15);
    const maxT = Math.min(actualDuration, chunk[chunk.length - 1].end + 15);

    let windowPeaks = analysis.waveformPeaks.filter((p) => p.t >= minT && p.t <= maxT);
    let windowSegments = analysis.speechSegments.filter((s) => s.end >= minT && s.start <= maxT);

    // If window looks sparse (e.g., heavily desynchronized cues), fall back to full compressed waveform
    if (windowSegments.length < Math.max(2, Math.floor(chunk.length / 5))) {
      const step = Math.max(1, Math.ceil(analysis.waveformPeaks.length / 450));
      windowPeaks = analysis.waveformPeaks.filter((_, idx) => idx % step === 0);
      windowSegments = analysis.speechSegments;
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

  onProgress?.(95, 'Verificando sincronización final...');
  const alignedSubtitles = normalizeAlignedCues(subtitles, alignedMap, actualDuration);

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
