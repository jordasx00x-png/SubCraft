/**
 * Client-side audio extraction and 16kHz Mono WAV encoder.
 * Allows processing 5 to 10 minute videos rapidly without uploading massive raw video files.
 */

export interface AudioExtractionProgress {
  stage: 'reading' | 'decoding' | 'resampling' | 'encoding' | 'ready';
  percent: number;
  message: string;
}

/**
 * Resample an AudioBuffer to 16,000 Hz Mono and return an ArrayBuffer of 16-bit PCM WAV.
 */
export async function convertAudioBufferTo16kHzWav(
  audioBuffer: AudioBuffer,
  startSec = 0,
  durationSec?: number
): Promise<{ wavBlob: Blob; wavBase64: string; actualDuration: number }> {
  const targetSampleRate = 16000;
  const startSample = Math.floor(startSec * audioBuffer.sampleRate);
  const totalAvailableSamples = audioBuffer.length - startSample;
  const samplesToTake = durationSec
    ? Math.min(totalAvailableSamples, Math.floor(durationSec * audioBuffer.sampleRate))
    : totalAvailableSamples;

  const actualDuration = samplesToTake / audioBuffer.sampleRate;

  // OfflineAudioContext for high-speed hardware-accelerated resampling
  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(samplesToTake * (targetSampleRate / audioBuffer.sampleRate)),
    targetSampleRate
  );

  // Extract mono or downmix stereo
  const monoBuffer = offlineCtx.createBuffer(1, samplesToTake, audioBuffer.sampleRate);
  const monoChannel = monoBuffer.getChannelData(0);

  if (audioBuffer.numberOfChannels === 1) {
    const origData = audioBuffer.getChannelData(0);
    monoChannel.set(origData.subarray(startSample, startSample + samplesToTake));
  } else {
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    for (let i = 0; i < samplesToTake; i++) {
      const srcIdx = startSample + i;
      monoChannel[i] = (left[srcIdx] + right[srcIdx]) / 2;
    }
  }

  const source = offlineCtx.createBufferSource();
  source.buffer = monoBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const resampled = await offlineCtx.startRendering();
  const samples = resampled.getChannelData(0);

  // Encode to 16-bit PCM WAV
  const wavBytes = encodeWavPcm16(samples, targetSampleRate);
  const wavBlob = new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });

  const wavBase64 = await blobToBase64(wavBlob);

  return { wavBlob, wavBase64, actualDuration };
}

/**
 * Encode Float32Array PCM samples to 16-bit PCM WAV format
 */
function encodeWavPcm16(samples: Float32Array, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1 mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write 16-bit PCM samples with clipping protection
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const int16 = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      const base64 = res.split(',')[1] || res;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Decode audio from video file using browser AudioContext
 */
export async function extractAudioFromFile(
  file: File,
  onProgress?: (progress: AudioExtractionProgress) => void
): Promise<AudioBuffer> {
  onProgress?.({ stage: 'reading', percent: 15, message: 'Reading video file...' });

  const arrayBuffer = await file.arrayBuffer();

  onProgress?.({ stage: 'decoding', percent: 45, message: 'Decoding audio track...' });

  const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtxClass();

  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    onProgress?.({ stage: 'ready', percent: 100, message: 'Audio ready for AI analysis' });
    return audioBuffer;
  } finally {
    audioCtx.close();
  }
}
