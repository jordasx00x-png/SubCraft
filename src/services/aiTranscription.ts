import { SubtitleCue } from '../types/subtitle';
import { extractAudioFromFile, convertAudioBufferTo16kHzWav } from '../utils/audioExtractor';
import { generateAlgorithmicSubtitles } from '../utils/nonAiTranscriber';
import {
  AutoAlignResult,
  decodeMediaAudio,
  runAutoAlignSubtitles,
} from './autoAlignService';

export interface TranscriptionOptions {
  videoFile: File | null;
  videoUrl?: string | null;
  videoDuration: number;
  promptHint?: string;
  language?: string;
  groqApiKey?: string;
  autoAlign?: boolean;
  onAutoAlignComplete?: (result: AutoAlignResult) => void;
  onLanguageDetected?: (languageCode: string) => void;
  onProgress?: (percent: number, stage: string) => void;
}

/**
 * Memory-safe video duration reader using HTML5 Video element metadata.
 * Uses 0 bytes of heap memory (does not load or decode video frames into RAM).
 */
export function getSafeVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const blobUrl = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(blobUrl);
      resolve(video.duration || 30);
    };
    video.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      resolve(30);
    };
    video.src = blobUrl;
  });
}

/**
 * Transcribes audio using Groq Whisper API (whisper-large-v3-turbo).
 * Uses direct binary streaming via FormData without base64 conversions to prevent Out-of-Memory crashes.
 */
export async function transcribeWithGroq(
  audioBlobOrFile: Blob | File,
  apiKey: string,
  promptHint?: string,
  onLanguageDetected?: (languageCode: string) => void
): Promise<SubtitleCue[]> {
  const fileName =
    audioBlobOrFile instanceof File
      ? audioBlobOrFile.name
      : 'audio.wav';

  const runGroqRequest = async (includeWords: boolean) => {
    const formData = new FormData();
    formData.append('file', audioBlobOrFile, fileName);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');
    if (includeWords) {
      formData.append('timestamp_granularities[]', 'word');
    }
    if (promptHint && promptHint.trim().length > 0) {
      formData.append('prompt', promptHint.slice(0, 400));
    }

    return fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: formData,
    });
  };

  let response = await runGroqRequest(true);
  if (!response.ok && response.status === 400) {
    response = await runGroqRequest(false);
  }

  if (!response.ok) {
    const errText = await response.text();
    let parsedErr = 'Error en el servicio de Groq';
    try {
      const errObj = JSON.parse(errText);
      parsedErr = errObj?.error?.message || errText;
    } catch {
      parsedErr = errText;
    }
    throw new Error(`Groq API Error: ${parsedErr}`);
  }

  const result = await response.json();
  if (typeof result.language === 'string' && result.language.trim()) {
    onLanguageDetected?.(result.language.trim().toLowerCase());
  }

  const segments = result.segments;
  const words: Array<{ word?: string; start?: number; end?: number }> = Array.isArray(result.words)
    ? result.words
    : [];

  if (Array.isArray(segments) && segments.length > 0) {
    let wordCursor = 0;

    return segments.map((seg: any, idx: number) => {
      const segStart = Number(seg.start || 0);
      const segEnd = Number(seg.end || segStart + 1);
      let start = segStart;
      let end = segEnd;

      if (words.length > 0) {
        while (
          wordCursor < words.length &&
          Number(words[wordCursor]?.end ?? 0) < segStart - 0.1
        ) {
          wordCursor++;
        }

        const segWords: Array<{ start: number; end: number }> = [];
        let scan = wordCursor;
        while (scan < words.length) {
          const wStart = Number(words[scan]?.start ?? NaN);
          const wEnd = Number(words[scan]?.end ?? NaN);
          if (!Number.isFinite(wStart) || !Number.isFinite(wEnd)) {
            scan++;
            continue;
          }
          if (wStart > segEnd + 0.15) break;
          if (wEnd >= segStart - 0.1) {
            segWords.push({ start: wStart, end: wEnd });
          }
          scan++;
        }

        if (segWords.length > 0) {
          wordCursor = scan;
          start = Math.max(segStart, segWords[0].start - 0.06);
          end = Math.min(
            segEnd + 0.1,
            Math.max(start + 0.35, segWords[segWords.length - 1].end + 0.14)
          );
        }
      }

      return {
        id: idx + 1,
        start: Math.round(start * 100) / 100,
        end: Math.round(end * 100) / 100,
        text: (seg.text || '').trim(),
        speaker: 'Locutor',
      };
    });
  }

  // If segments array is missing but single text is present
  if (result.text && typeof result.text === 'string') {
    return generateAlgorithmicSubtitles(result.duration || 30, result.text);
  }

  return [];
}

function normalizeTranscribedCues(cues: SubtitleCue[]): SubtitleCue[] {
  return [...cues]
    .sort((a, b) => a.start - b.start)
    .map((cue, idx) => {
      const start = Math.max(0, Math.round(Number(cue.start || 0) * 100) / 100);
      const rawEnd = Math.round(Number(cue.end || start + 1) * 100) / 100;
      const end = Math.max(start + 0.3, rawEnd);
      return {
        ...cue,
        id: idx + 1,
        start,
        end,
      };
    });
}

/**
 * Orchestrates memory-safe AI transcription (Groq / Gemini / Algorithmic fallback)
 * followed automatically by AI waveform peak auto-alignment so generated subtitles
 * arrive tightly synchronized to real spoken audio.
 */
export async function runSafeAITranscription(
  options: TranscriptionOptions
): Promise<SubtitleCue[]> {
  const {
    videoFile,
    videoUrl,
    promptHint,
    language = 'es',
    autoAlign = true,
    onAutoAlignComplete,
    onLanguageDetected,
    onProgress,
  } = options;

  let duration = options.videoDuration || 30;
  let cachedAudioBuffer: AudioBuffer | null = null;
  const shouldRunAutoAlign = autoAlign && Boolean(videoFile || videoUrl);

  const reportStage1Progress = (pct: number, stage: string) => {
    const scaled = shouldRunAutoAlign ? Math.round((pct / 100) * 60) : pct;
    const label = shouldRunAutoAlign ? `Paso 1/2 · ${stage}` : stage;
    onProgress?.(scaled, label);
  };

  if (videoFile) {
    try {
      const detectedDuration = await getSafeVideoDuration(videoFile);
      if (detectedDuration > 0) {
        duration = detectedDuration;
      }
    } catch (e) {
      console.warn('Could not read video duration metadata:', e);
    }
  }

  const activeGroqKey =
    options.groqApiKey || localStorage.getItem('subcraft_groq_api_key') || '';

  let rawCues: SubtitleCue[] | null = null;
  let effectiveLanguage = language;

  // 1. Try Groq Whisper directly if API key is configured
  if (activeGroqKey.trim().length > 0 && videoFile) {
    reportStage1Progress(30, 'Enviando audio a Groq Whisper LPU...');

    // If file is already an audio file or small video (< 24MB), stream directly
    if (videoFile.size < 24 * 1024 * 1024) {
      try {
        const groqCues = await transcribeWithGroq(videoFile, activeGroqKey, promptHint, (lang) => {
          effectiveLanguage = lang;
          onLanguageDetected?.(lang);
        });
        if (groqCues.length > 0) {
          rawCues = groqCues;
        }
      } catch (err) {
        console.warn('Groq direct file upload warning, attempting downsampled audio:', err);
      }
    }

    // Extract lightweight 16kHz mono WAV slice (< 20MB)
    if (!rawCues) {
      try {
        reportStage1Progress(45, 'Extrayendo audio comprimido a 16kHz mono...');
        cachedAudioBuffer = await extractAudioFromFile(videoFile);
        if (cachedAudioBuffer.duration > 0) {
          duration = cachedAudioBuffer.duration;
        }
        const { wavBlob } = await convertAudioBufferTo16kHzWav(cachedAudioBuffer);
        reportStage1Progress(75, 'Transcribiendo con Groq Whisper...');
        const groqCues = await transcribeWithGroq(wavBlob, activeGroqKey, promptHint, (lang) => {
          effectiveLanguage = lang;
          onLanguageDetected?.(lang);
        });
        if (groqCues.length > 0) {
          rawCues = groqCues;
        }
      } catch (err: any) {
        console.warn('Groq audio extraction failed, falling back:', err?.message || err);
      }
    }
  }

  // 2. Try Server-Side Gemini API (using lightweight 16kHz audio, supporting File or URL)
  if (!rawCues && (videoFile || videoUrl)) {
    try {
      reportStage1Progress(45, 'Extrayendo audio y conectando con Gemini IA...');
      if (!cachedAudioBuffer) {
        cachedAudioBuffer = videoFile
          ? await extractAudioFromFile(videoFile)
          : await decodeMediaAudio(null, videoUrl);
      }
      if (cachedAudioBuffer.duration > 0) {
        duration = cachedAudioBuffer.duration;
      }

      const { wavBase64 } = await convertAudioBufferTo16kHzWav(cachedAudioBuffer);

      reportStage1Progress(80, 'Generando subtítulos automáticos con Gemini IA...');
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: wavBase64,
          mimeType: 'audio/wav',
          language: effectiveLanguage,
          promptHint,
        }),
      });

      if (response.ok) {
        const resJson = await response.json();
        const subs = resJson.data?.subtitles;
        const langCode = resJson.data?.languageCode;
        if (typeof langCode === 'string' && langCode.trim().length > 0) {
          effectiveLanguage = langCode.trim().toLowerCase();
          onLanguageDetected?.(effectiveLanguage);
        }
        if (resJson.success && Array.isArray(subs) && subs.length >= (duration > 30 ? 3 : 1)) {
          rawCues = subs;
        }
      }
    } catch (apiErr) {
      console.warn('Server Gemini API unreachable or error:', apiErr);
    }
  }

  // 3. Fallback when transcription APIs did not produce cues
  if (!rawCues || rawCues.length === 0) {
    reportStage1Progress(90, 'Sintetizando estructura base de subtítulos...');
    await new Promise((r) => setTimeout(r, 250));
    rawCues = await generateAlgorithmicSubtitles(duration, promptHint);
  }

  const normalizedCues = normalizeTranscribedCues(rawCues);

  // 4. Unified Step 2: Automatically align generated subtitles to audio waveform peaks
  if (shouldRunAutoAlign && normalizedCues.length > 0) {
    try {
      onProgress?.(64, 'Paso 2/2 · Analizando picos de onda y auto-alineando con IA...');
      const alignResult = await runAutoAlignSubtitles({
        subtitles: normalizedCues,
        videoFile,
        videoUrl,
        audioBuffer: cachedAudioBuffer,
        duration,
        language: effectiveLanguage,
        onProgress: (pct, stage) => {
          const mapped = Math.min(99, 64 + Math.round((pct / 100) * 35));
          onProgress?.(mapped, `Paso 2/2 · ${stage}`);
        },
      });
      onAutoAlignComplete?.(alignResult);
      onProgress?.(100, '¡Subtítulos generados y auto-alineados con éxito!');
      return alignResult.alignedSubtitles;
    } catch (alignErr) {
      console.warn('Automatic post-generation alignment skipped due to error:', alignErr);
    }
  }

  onProgress?.(100, '¡Subtítulos generados con éxito!');
  return normalizedCues;
}
