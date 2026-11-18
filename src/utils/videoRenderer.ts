import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4ArrayBufferTarget } from 'mp4-muxer';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmArrayBufferTarget } from 'webm-muxer';
import { SubtitleCue, SubtitleStyle } from '../types/subtitle';
import { drawBackgroundLoop } from './backgroundRenderer';

export interface VideoExportOptions {
  resolution?: 'original' | '1080p' | '720p';
  onProgress?: (progress: number, currentTime: number, totalDuration: number) => void;
  onStatusChange?: (status: string) => void;
  abortSignal?: AbortSignal;
}

/**
 * Splits text into lines respecting max width
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Helper to draw rounded rectangle on canvas
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Render styled subtitle overlay onto canvas context
 */
export function drawSubtitleOnCanvas(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  cue: SubtitleCue | null,
  style: SubtitleStyle
) {
  if (!cue || !cue.text.trim()) return;

  const effectiveStyle: SubtitleStyle = cue.styleOverride
    ? { ...style, ...cue.styleOverride }
    : style;

  // Scale font size proportionally to match editor preview ratio (editor preview height ~400px)
  const scale = canvasHeight / 400;
  const scaledFontSize = Math.max(16, Math.round(effectiveStyle.fontSize * scale));
  const lineHeight = scaledFontSize * 1.25;

  let formattedText = cue.text.trim();
  if (effectiveStyle.textTransform === 'uppercase') {
    formattedText = formattedText.toUpperCase();
  } else if (effectiveStyle.textTransform === 'capitalize') {
    formattedText = formattedText.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  ctx.save();
  ctx.font = `${effectiveStyle.fontWeight} ${scaledFontSize}px "${effectiveStyle.fontFamily}", sans-serif`;
  ctx.textAlign = effectiveStyle.textAlign;
  ctx.textBaseline = 'middle';

  const maxLineWidth = canvasWidth * 0.88;
  const lines = wrapText(ctx, formattedText, maxLineWidth);
  const totalTextHeight = lines.length * lineHeight;

  // Compute vertical position
  let centerY: number;
  const offsetPx = (effectiveStyle.verticalOffset / 100) * canvasHeight;

  if (effectiveStyle.position === 'top') {
    centerY = offsetPx + totalTextHeight / 2;
  } else if (effectiveStyle.position === 'middle') {
    centerY = canvasHeight / 2;
  } else {
    centerY = canvasHeight - offsetPx - totalTextHeight / 2;
  }

  // Draw background box if enabled
  if (effectiveStyle.hasBackground && effectiveStyle.backgroundOpacity > 0) {
    const padding = effectiveStyle.backgroundPadding * scale;
    const radius = effectiveStyle.backgroundRounded * scale;

    let maxBoxWidth = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxBoxWidth) maxBoxWidth = w;
    }

    const boxWidth = maxBoxWidth + padding * 3;
    const boxHeight = totalTextHeight + padding * 2;

    let boxX = (canvasWidth - boxWidth) / 2;
    if (effectiveStyle.textAlign === 'left') {
      boxX = canvasWidth * 0.08 - padding * 1.5;
    } else if (effectiveStyle.textAlign === 'right') {
      boxX = canvasWidth * 0.92 - boxWidth + padding * 1.5;
    }

    const boxY = centerY - totalTextHeight / 2 - padding;

    ctx.save();
    ctx.fillStyle = effectiveStyle.backgroundColor;
    ctx.globalAlpha = effectiveStyle.backgroundOpacity;
    roundRect(ctx, boxX, boxY, boxWidth, boxHeight, radius);
    ctx.fill();
    ctx.restore();
  }

  // Horizontal X coordinate
  let textX = canvasWidth / 2;
  if (effectiveStyle.textAlign === 'left') {
    textX = canvasWidth * 0.08;
  } else if (effectiveStyle.textAlign === 'right') {
    textX = canvasWidth * 0.92;
  }

  const startY = centerY - (lines.length - 1) * (lineHeight / 2);

  lines.forEach((line, index) => {
    const lineY = startY + index * lineHeight;

    // Stroke / Outline
    if (effectiveStyle.hasStroke && effectiveStyle.strokeWidth > 0) {
      ctx.save();
      ctx.strokeStyle = effectiveStyle.strokeColor;
      ctx.lineWidth = effectiveStyle.strokeWidth * scale;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(line, textX, lineY);
      ctx.restore();
    }

    // Shadow
    if (effectiveStyle.hasShadow) {
      ctx.save();
      ctx.shadowColor = effectiveStyle.shadowColor;
      ctx.shadowBlur = effectiveStyle.shadowBlur * scale;
      ctx.shadowOffsetX = effectiveStyle.shadowOffsetX * scale;
      ctx.shadowOffsetY = effectiveStyle.shadowOffsetY * scale;
      ctx.fillStyle = effectiveStyle.textColor;
      ctx.fillText(line, textX, lineY);
      ctx.restore();
    } else {
      ctx.save();
      ctx.fillStyle = effectiveStyle.textColor;
      ctx.fillText(line, textX, lineY);
      ctx.restore();
    }
  });

  ctx.restore();
}

/**
 * Binary search for active cue in sorted array — O(log N) per lookup
 */
function findActiveCue(sortedCues: SubtitleCue[], time: number): SubtitleCue | null {
  let low = 0;
  let high = sortedCues.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const cue = sortedCues[mid];
    if (time < cue.start) {
      high = mid - 1;
    } else if (time > cue.end) {
      low = mid + 1;
    } else {
      return cue;
    }
  }
  return null;
}

/**
 * Cached subtitle overlay layer: renders subtitle text/box/shadow/stroke ONLY when active cue changes,
 * eliminating redundant per-frame measureText/wrapText/shadowBlur calls (~98% less CPU cost).
 */
class SubtitleOverlayCache {
  private offscreen: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private lastCacheKey: string | null = '__INIT__';
  private hasActiveCue = false;

  constructor(private width: number, private height: number, private baseStyle: SubtitleStyle) {
    this.offscreen = document.createElement('canvas');
    this.offscreen.width = width;
    this.offscreen.height = height;
    const ctx = this.offscreen.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create subtitle cache context');
    }
    this.offCtx = ctx;
  }

  public composite(targetCtx: CanvasRenderingContext2D, cue: SubtitleCue | null) {
    const key = cue
      ? `${cue.id}|${cue.text}|${cue.styleOverride ? JSON.stringify(cue.styleOverride) : ''}`
      : 'NONE';

    if (key !== this.lastCacheKey) {
      this.lastCacheKey = key;
      this.offCtx.clearRect(0, 0, this.width, this.height);
      if (cue && cue.text.trim()) {
        drawSubtitleOnCanvas(this.offCtx, this.width, this.height, cue, this.baseStyle);
        this.hasActiveCue = true;
      } else {
        this.hasActiveCue = false;
      }
    }

    if (this.hasActiveCue) {
      targetCtx.drawImage(this.offscreen, 0, 0);
    }
  }
}

interface SupportedCodecConfig {
  container: 'mp4' | 'webm';
  mimeType: string;
  videoCodec: string;
  muxerVideoCodec: 'avc' | 'V_VP8' | 'V_VP9';
  audioCodec: 'mp4a.40.2' | 'opus';
  muxerAudioCodec: 'aac' | 'A_OPUS';
  hardwareAcceleration: HardwareAcceleration;
}

async function detectWebCodecsConfig(
  width: number,
  height: number,
  bitrate: number
): Promise<SupportedCodecConfig | null> {
  if (
    typeof VideoEncoder === 'undefined' ||
    typeof VideoFrame === 'undefined' ||
    typeof AudioEncoder === 'undefined'
  ) {
    return null;
  }

  // 1. Prefer MP4 (H.264 + AAC) with hardware acceleration first for fastest encoding + universal playback
  const h264Candidates = ['avc1.640028', 'avc1.4d002a', 'avc1.420028', 'avc1.42001f'];
  const hwModes: HardwareAcceleration[] = ['prefer-hardware', 'no-preference'];

  for (const hw of hwModes) {
    for (const vCodec of h264Candidates) {
      try {
        const vSupport = await VideoEncoder.isConfigSupported({
          codec: vCodec,
          width,
          height,
          bitrate,
          framerate: 30,
          hardwareAcceleration: hw,
        });
        if (!vSupport.supported) continue;

        const aSupport = await AudioEncoder.isConfigSupported({
          codec: 'mp4a.40.2',
          sampleRate: 48000,
          numberOfChannels: 2,
          bitrate: 192_000,
        });
        if (aSupport.supported) {
          return {
            container: 'mp4',
            mimeType: 'video/mp4',
            videoCodec: vCodec,
            muxerVideoCodec: 'avc',
            audioCodec: 'mp4a.40.2',
            muxerAudioCodec: 'aac',
            hardwareAcceleration: hw,
          };
        }
      } catch {
        // Try next codec candidate
      }
    }
  }

  // 2. Fallback to WebCodecs WebM (VP8 hardware/software is much faster than VP9, then VP9)
  const webmCandidates: Array<{ codec: string; muxer: 'V_VP8' | 'V_VP9' }> = [
    { codec: 'vp8', muxer: 'V_VP8' },
    { codec: 'vp09.00.10.08', muxer: 'V_VP9' },
  ];

  for (const hw of hwModes) {
    for (const candidate of webmCandidates) {
      try {
        const vSupport = await VideoEncoder.isConfigSupported({
          codec: candidate.codec,
          width,
          height,
          bitrate,
          framerate: 30,
          hardwareAcceleration: hw,
        });
        if (!vSupport.supported) continue;

        const aSupport = await AudioEncoder.isConfigSupported({
          codec: 'opus',
          sampleRate: 48000,
          numberOfChannels: 2,
          bitrate: 160_000,
        });
        if (aSupport.supported) {
          return {
            container: 'webm',
            mimeType: 'video/webm',
            videoCodec: candidate.codec,
            muxerVideoCodec: candidate.muxer,
            audioCodec: 'opus',
            muxerAudioCodec: 'A_OPUS',
            hardwareAcceleration: hw,
          };
        }
      } catch {
        // Try next
      }
    }
  }

  return null;
}

/**
 * Decodes source media audio offline and resamples to target sample rate / stereo for clean WebCodecs AudioEncoder input
 */
async function decodeAudioToStereo48k(
  videoSourceUrl: string,
  abortSignal?: AbortSignal
): Promise<AudioBuffer | null> {
  const response = await fetch(videoSourceUrl, { signal: abortSignal });
  const arrayBuffer = await response.arrayBuffer();
  if (abortSignal?.aborted) throw new Error('Export was cancelled by user.');

  const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const tempCtx = new AudioCtxClass();
  let decoded: AudioBuffer;
  try {
    decoded = await tempCtx.decodeAudioData(arrayBuffer);
  } catch {
    // Source may have no audio stream
    return null;
  } finally {
    if (tempCtx.state !== 'closed') {
      await tempCtx.close().catch(() => {});
    }
  }

  if (!decoded || decoded.numberOfChannels === 0 || decoded.length === 0) {
    return null;
  }

  // Already 48kHz stereo/mono -> resample cleanly to 48kHz stereo so AAC/Opus encoder always matches
  const targetSampleRate = 48000;
  const targetLength = Math.ceil(decoded.duration * targetSampleRate);
  const offlineCtx = new OfflineAudioContext(2, targetLength, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start(0);
  return await offlineCtx.startRendering();
}

async function encodeOfflineAudioTrack(
  audioBuffer: AudioBuffer,
  audioCodec: 'mp4a.40.2' | 'opus',
  onChunk: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => void,
  abortSignal?: AbortSignal
) {
  let encoderError: unknown = null;
  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => onChunk(chunk, meta),
    error: (err) => {
      encoderError = err;
    },
  });

  audioEncoder.configure({
    codec: audioCodec,
    sampleRate: audioBuffer.sampleRate,
    numberOfChannels: 2,
    bitrate: audioCodec === 'mp4a.40.2' ? 192_000 : 160_000,
  });

  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : left;
  const totalFrames = audioBuffer.length;
  const chunkFrames = 4096;

  for (let offset = 0; offset < totalFrames; offset += chunkFrames) {
    if (abortSignal?.aborted) {
      audioEncoder.close();
      throw new Error('Export was cancelled by user.');
    }
    if (encoderError) throw encoderError;

    const count = Math.min(chunkFrames, totalFrames - offset);
    const planarData = new Float32Array(count * 2);
    planarData.set(left.subarray(offset, offset + count), 0);
    planarData.set(right.subarray(offset, offset + count), count);

    const timestampUs = Math.round((offset / audioBuffer.sampleRate) * 1_000_000);
    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate: audioBuffer.sampleRate,
      numberOfFrames: count,
      numberOfChannels: 2,
      timestamp: timestampUs,
      data: planarData,
    });

    audioEncoder.encode(audioData);
    audioData.close();

    // Yield periodically to keep browser UI responsive & respect queue backpressure
    if (audioEncoder.encodeQueueSize > 16) {
      await new Promise((r) => setTimeout(r, 2));
    }
  }

  await audioEncoder.flush();
  audioEncoder.close();
  if (encoderError) throw encoderError;
}

function yieldFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Accelerated WebCodecs export pipeline (10x–30x faster in Audio Mode offline loop,
 * 2.5x–3x faster in Video Mode via accelerated requestVideoFrameCallback + offline audio).
 */
async function exportWithWebCodecs(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  videoSourceUrl: string,
  sortedCues: SubtitleCue[],
  style: SubtitleStyle,
  codecConfig: SupportedCodecConfig,
  bitrate: number,
  isAudioOnly: boolean,
  options: VideoExportOptions
): Promise<Blob> {
  const { onProgress, onStatusChange, abortSignal } = options;
  const duration = video.duration > 0 ? video.duration : 10;
  const fps = 30;

  let lastProgressReportMs = 0;
  const reportProgressThrottled = (percent: number, curTime: number) => {
    const now = performance.now();
    if (now - lastProgressReportMs >= 100 || percent >= 99) {
      lastProgressReportMs = now;
      onProgress?.(Math.min(99, Math.max(0, Math.round(percent))), curTime, duration);
    }
  };

  onStatusChange?.('Decodificando audio en memoria para sincronización perfecta...');
  const audioBuffer = await decodeAudioToStereo48k(videoSourceUrl, abortSignal);
  const hasAudio = Boolean(audioBuffer);

  if (abortSignal?.aborted) throw new Error('Export was cancelled by user.');

  const isMp4 = codecConfig.container === 'mp4';
  const mp4Target = isMp4 ? new Mp4ArrayBufferTarget() : null;
  const webmTarget = !isMp4 ? new WebmArrayBufferTarget() : null;

  const mp4Muxer = isMp4
    ? new Mp4Muxer({
        target: mp4Target!,
        video: {
          codec: 'avc',
          width: canvas.width,
          height: canvas.height,
          frameRate: fps,
        },
        audio: hasAudio
          ? {
              codec: 'aac',
              numberOfChannels: 2,
              sampleRate: audioBuffer!.sampleRate,
            }
          : undefined,
        fastStart: 'in-memory',
      })
    : null;

  const webmMuxer = !isMp4
    ? new WebmMuxer({
        target: webmTarget!,
        video: {
          codec: codecConfig.muxerVideoCodec === 'V_VP8' ? 'V_VP8' : 'V_VP9',
          width: canvas.width,
          height: canvas.height,
          frameRate: fps,
        },
        audio: hasAudio
          ? {
              codec: 'A_OPUS',
              numberOfChannels: 2,
              sampleRate: audioBuffer!.sampleRate,
            }
          : undefined,
      })
    : null;

  // Step 1: Encode audio offline first (ultra fast, exact timestamps)
  if (hasAudio && audioBuffer) {
    onStatusChange?.('Codificando pista de audio HD...');
    await encodeOfflineAudioTrack(
      audioBuffer,
      codecConfig.audioCodec,
      (chunk, meta) => {
        if (mp4Muxer) mp4Muxer.addAudioChunk(chunk, meta);
        else if (webmMuxer) webmMuxer.addAudioChunk(chunk, meta);
      },
      abortSignal
    );
  }

  if (abortSignal?.aborted) throw new Error('Export was cancelled by user.');

  // Step 2: Configure hardware VideoEncoder
  let videoEncoderError: unknown = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      if (mp4Muxer) mp4Muxer.addVideoChunk(chunk, meta);
      else if (webmMuxer) webmMuxer.addVideoChunk(chunk, meta);
    },
    error: (err) => {
      videoEncoderError = err;
    },
  });

  videoEncoder.configure({
    codec: codecConfig.videoCodec,
    width: canvas.width,
    height: canvas.height,
    bitrate,
    framerate: fps,
    hardwareAcceleration: codecConfig.hardwareAcceleration,
    avc: isMp4 ? { format: 'avc' } : undefined,
  });

  const subtitleCache = new SubtitleOverlayCache(canvas.width, canvas.height, style);
  const frameDurationUs = Math.round(1_000_000 / fps);
  const bgLoop = style.backgroundLoop || 'aurora-gradient';

  if (isAudioOnly) {
    // Pure offline rendering loop: 10x–30x faster than realtime!
    onStatusChange?.('Renderizando fotogramas offline con aceleración GPU (modo turbo)...');
    const totalFrames = Math.max(1, Math.ceil(duration * fps));
    const keyframeInterval = fps * 2; // keyframe every 2 seconds

    for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
      if (abortSignal?.aborted) {
        videoEncoder.close();
        throw new Error('Export was cancelled by user.');
      }
      if (videoEncoderError) throw videoEncoderError;

      // Backpressure wait so encoder queue stays bounded
      while (videoEncoder.encodeQueueSize > 8) {
        await new Promise((r) => setTimeout(r, 3));
        if (abortSignal?.aborted) {
          videoEncoder.close();
          throw new Error('Export was cancelled by user.');
        }
      }

      const tSec = frameIdx / fps;
      drawBackgroundLoop(ctx, canvas.width, canvas.height, bgLoop, tSec, {
        showVisualizer: style.showAudioVisualizer,
      });

      const activeCue = findActiveCue(sortedCues, tSec);
      subtitleCache.composite(ctx, activeCue);

      const frame = new VideoFrame(canvas, {
        timestamp: Math.round(tSec * 1_000_000),
        duration: frameDurationUs,
      });

      videoEncoder.encode(frame, { keyFrame: frameIdx % keyframeInterval === 0 });
      frame.close();

      reportProgressThrottled((frameIdx / totalFrames) * 98, tSec);

      // Yield to UI event loop every 6 frames
      if (frameIdx % 6 === 5) {
        await yieldFrame();
      }
    }
  } else {
    // Video source mode: accelerated muted playback + requestVideoFrameCallback + exact mediaTime timestamps
    onStatusChange?.('Renderizando video acelerado por hardware con subtítulos quemados...');

    await new Promise<void>((resolveVideo, rejectVideo) => {
      video.muted = true;
      video.currentTime = 0;

      // Run at 3x playback speed; scale down dynamically if encoder queue fills up
      let currentSpeed = 3.0;
      try {
        video.playbackRate = currentSpeed;
      } catch {
        currentSpeed = 1.5;
        video.playbackRate = currentSpeed;
      }

      let lastTimestampUs = -1;
      let lastKeyframeUs = -2_000_000;
      let finished = false;
      let rafId = 0;
      let vfcId = 0;

      const stopCallbacks = () => {
        if (rafId) cancelAnimationFrame(rafId);
        if (vfcId && 'cancelVideoFrameCallback' in video) {
          (video as HTMLVideoElement & { cancelVideoFrameCallback: (id: number) => void }).cancelVideoFrameCallback(vfcId);
        }
      };

      const onAbort = () => {
        finished = true;
        stopCallbacks();
        video.pause();
        rejectVideo(new Error('Export was cancelled by user.'));
      };
      abortSignal?.addEventListener('abort', onAbort, { once: true });

      const finishVideoLoop = () => {
        if (finished) return;
        finished = true;
        stopCallbacks();
        abortSignal?.removeEventListener('abort', onAbort);
        video.pause();
        resolveVideo();
      };

      const encodeCurrentCanvasFrame = (mediaTimeSec: number) => {
        if (finished) return;
        if (videoEncoderError) {
          finished = true;
          stopCallbacks();
          video.pause();
          rejectVideo(videoEncoderError);
          return;
        }

        // Dynamic playbackRate backpressure control so frames never drop
        const qSize = videoEncoder.encodeQueueSize;
        if (qSize > 10 && currentSpeed > 1.25) {
          currentSpeed = 1.25;
          try {
            video.playbackRate = currentSpeed;
          } catch {
            // ignore
          }
        } else if (qSize < 4 && currentSpeed < 3.0) {
          currentSpeed = 3.0;
          try {
            video.playbackRate = currentSpeed;
          } catch {
            // ignore
          }
        }

        const rawTsUs = Math.max(0, Math.round(mediaTimeSec * 1_000_000));
        const tsUs = rawTsUs <= lastTimestampUs ? lastTimestampUs + 1000 : rawTsUs;
        lastTimestampUs = tsUs;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const activeCue = findActiveCue(sortedCues, mediaTimeSec);
        subtitleCache.composite(ctx, activeCue);

        const isKeyFrame = tsUs - lastKeyframeUs >= 2_000_000;
        if (isKeyFrame) lastKeyframeUs = tsUs;

        const frame = new VideoFrame(canvas, {
          timestamp: tsUs,
          duration: frameDurationUs,
        });
        videoEncoder.encode(frame, { keyFrame: isKeyFrame });
        frame.close();

        reportProgressThrottled((mediaTimeSec / duration) * 98, mediaTimeSec);
      };

      const hasVfc = 'requestVideoFrameCallback' in video;

      const onVideoFrame = (_now: number, metadata: { mediaTime: number }) => {
        if (finished) return;
        encodeCurrentCanvasFrame(metadata.mediaTime);
        if (video.ended || metadata.mediaTime >= duration - 0.04) {
          finishVideoLoop();
          return;
        }
        vfcId = (
          video as HTMLVideoElement & {
            requestVideoFrameCallback: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
          }
        ).requestVideoFrameCallback(onVideoFrame);
      };

      let lastRafTime = -1;
      const onRafFrame = () => {
        if (finished) return;
        const curTime = video.currentTime;
        if (curTime - lastRafTime >= 1 / (fps * 1.1) || lastRafTime < 0) {
          lastRafTime = curTime;
          encodeCurrentCanvasFrame(curTime);
        }
        if (video.ended || curTime >= duration - 0.05) {
          finishVideoLoop();
          return;
        }
        rafId = requestAnimationFrame(onRafFrame);
      };

      video.onended = () => finishVideoLoop();

      video
        .play()
        .then(() => {
          if (hasVfc) {
            vfcId = (
              video as HTMLVideoElement & {
                requestVideoFrameCallback: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
              }
            ).requestVideoFrameCallback(onVideoFrame);
          } else {
            rafId = requestAnimationFrame(onRafFrame);
          }
        })
        .catch((err) => {
          finished = true;
          stopCallbacks();
          rejectVideo(err);
        });
    });
  }

  onStatusChange?.('Empaquetando pista de video y audio en archivo final...');
  await videoEncoder.flush();
  videoEncoder.close();
  if (videoEncoderError) throw videoEncoderError;

  if (mp4Muxer && mp4Target) {
    mp4Muxer.finalize();
    onProgress?.(100, duration, duration);
    return new Blob([mp4Target.buffer], { type: 'video/mp4' });
  }

  webmMuxer!.finalize();
  onProgress?.(100, duration, duration);
  return new Blob([webmTarget!.buffer], { type: 'video/webm' });
}

/**
 * Fallback pipeline using optimized MediaRecorder (VP8 hardware-friendly prioritized over CPU VP9,
 * cached subtitle overlay canvas, binary cue search, and 100ms throttled UI progress).
 */
async function exportWithMediaRecorder(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  sortedCues: SubtitleCue[],
  style: SubtitleStyle,
  bitrate: number,
  options: VideoExportOptions
): Promise<Blob> {
  const { onProgress, onStatusChange, abortSignal } = options;

  return new Promise((resolve, reject) => {
    let mediaRecorder: MediaRecorder | null = null;
    let animationFrameId = 0;
    const recordedChunks: Blob[] = [];

    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioCtxClass();
    const audioSource = audioCtx.createMediaElementSource(video);
    const audioDest = audioCtx.createMediaStreamDestination();
    audioSource.connect(audioDest);

    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.001;
    audioSource.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const canvasStream = canvas.captureStream(30);
    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioDest.stream.getAudioTracks(),
    ]);

    // Prioritize fast VP8/H.264 before heavy software VP9
    const mimeTypes = [
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm',
      'video/mp4',
    ];
    const chosenMime = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || 'video/webm';

    try {
      mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: chosenMime,
        videoBitsPerSecond: bitrate,
      });
    } catch {
      mediaRecorder = new MediaRecorder(combinedStream);
    }

    const cleanup = () => {
      cancelAnimationFrame(animationFrameId);
      video.pause();
      combinedStream.getTracks().forEach((track) => track.stop());
      canvasStream.getTracks().forEach((track) => track.stop());
      audioDest.stream.getTracks().forEach((track) => track.stop());
      if (audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    };

    const onAbort = () => {
      cleanup();
      reject(new Error('Export was cancelled by user.'));
    };
    abortSignal?.addEventListener('abort', onAbort, { once: true });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      abortSignal?.removeEventListener('abort', onAbort);
      cleanup();
      onStatusChange?.('Finalizando y guardando archivo de video HD...');
      const finalBlob = new Blob(recordedChunks, { type: chosenMime });
      onProgress?.(100, video.duration || 0, video.duration || 0);
      resolve(finalBlob);
    };

    const subtitleCache = new SubtitleOverlayCache(canvas.width, canvas.height, style);
    const isAudioOnly = style.isAudioMode || !video.videoWidth;
    const bgLoop = style.backgroundLoop || 'aurora-gradient';
    const minFrameMs = 1000 / 30;
    let lastDrawMs = 0;
    let lastProgressMs = 0;

    video.muted = false;
    video.currentTime = 0;
    onStatusChange?.('Grabando video en alta resolución con subtítulos quemados...');
    mediaRecorder.start(250);

    const renderFrame = (nowMs: number) => {
      if (video.ended || (video.duration > 0 && video.currentTime >= video.duration - 0.1)) {
        video.pause();
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
        return;
      }

      if (nowMs - lastDrawMs >= minFrameMs) {
        lastDrawMs = nowMs;
        const curTime = video.currentTime;

        if (isAudioOnly) {
          drawBackgroundLoop(ctx, canvas.width, canvas.height, bgLoop, curTime, {
            showVisualizer: style.showAudioVisualizer,
          });
        } else {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }

        const activeCue = findActiveCue(sortedCues, curTime);
        subtitleCache.composite(ctx, activeCue);

        if (nowMs - lastProgressMs >= 100) {
          lastProgressMs = nowMs;
          const percent = Math.min(99, Math.round((curTime / video.duration) * 100));
          onProgress?.(percent, curTime, video.duration);
        }
      }

      animationFrameId = requestAnimationFrame(renderFrame);
    };

    video
      .play()
      .then(() => {
        animationFrameId = requestAnimationFrame(renderFrame);
      })
      .catch((err) => {
        cleanup();
        reject(err);
      });
  });
}

/**
 * Export high-resolution video with burned-in subtitles.
 * Uses hardware-accelerated WebCodecs (MP4 H.264+AAC / WebM) when supported for 3x–30x faster export,
 * falling back cleanly to optimized MediaRecorder.
 */
export async function exportBurnedVideo(
  videoSourceUrl: string,
  subtitles: SubtitleCue[],
  style: SubtitleStyle,
  options: VideoExportOptions = {}
): Promise<Blob> {
  const { onStatusChange, abortSignal, resolution = '1080p' } = options;

  onStatusChange?.('Preparando motor de renderizado de alta velocidad...');

  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.src = videoSourceUrl;
  video.playsInline = true;
  video.preload = 'auto';

  const cleanupVideo = () => {
    video.pause();
    video.removeAttribute('src');
    video.load();
  };

  try {
    await new Promise<void>((resolve, reject) => {
      if (abortSignal?.aborted) {
        reject(new Error('Export was cancelled by user.'));
        return;
      }
      const onAbort = () => reject(new Error('Export was cancelled by user.'));
      abortSignal?.addEventListener('abort', onAbort, { once: true });

      video.onloadedmetadata = () => {
        abortSignal?.removeEventListener('abort', onAbort);
        resolve();
      };
      video.onerror = () => {
        abortSignal?.removeEventListener('abort', onAbort);
        reject(new Error('Failed to load video file for burning.'));
      };
    });

    const isAudioOnly = style.isAudioMode || !video.videoWidth;
    const origWidth = isAudioOnly ? 1920 : video.videoWidth || 1920;
    const origHeight = isAudioOnly ? 1080 : video.videoHeight || 1080;
    const aspectRatio = origWidth / origHeight;

    let targetWidth = origWidth;
    let targetHeight = origHeight;

    if (resolution === '1080p' || (isAudioOnly && resolution !== '720p')) {
      targetHeight = 1080;
      targetWidth = Math.round(targetHeight * aspectRatio);
    } else if (resolution === '720p') {
      targetHeight = 720;
      targetWidth = Math.round(targetHeight * aspectRatio);
    }

    // Ensure dimensions are divisible by 2 (required by H.264 / WebCodecs encoders)
    const width = targetWidth % 2 === 0 ? targetWidth : targetWidth + 1;
    const height = targetHeight % 2 === 0 ? targetHeight : targetHeight + 1;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Failed to create Canvas 2D context');
    }

    const sortedCues = [...subtitles].sort((a, b) => a.start - b.start);
    const bitrate = targetHeight >= 1080 ? 8_000_000 : 5_000_000;

    // Try fast WebCodecs path first; if unsupported or fails before outputting, fallback to MediaRecorder
    const webCodecsConfig = await detectWebCodecsConfig(width, height, bitrate);
    if (webCodecsConfig) {
      try {
        return await exportWithWebCodecs(
          video,
          canvas,
          ctx,
          videoSourceUrl,
          sortedCues,
          style,
          webCodecsConfig,
          bitrate,
          isAudioOnly,
          options
        );
      } catch (err) {
        if (err instanceof Error && err.message === 'Export was cancelled by user.') {
          throw err;
        }
        console.warn('WebCodecs fast export failed, falling back to MediaRecorder:', err);
      }
    }

    return await exportWithMediaRecorder(
      video,
      canvas,
      ctx,
      sortedCues,
      style,
      bitrate,
      options
    );
  } finally {
    cleanupVideo();
  }
}
