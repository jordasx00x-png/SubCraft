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

  // Scale font size proportionally to 1080p reference height
  const scale = canvasHeight / 720;
  const scaledFontSize = Math.max(16, Math.round(style.fontSize * scale));
  const lineHeight = scaledFontSize * 1.25;

  let formattedText = cue.text.trim();
  if (style.textTransform === 'uppercase') {
    formattedText = formattedText.toUpperCase();
  } else if (style.textTransform === 'capitalize') {
    formattedText = formattedText.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  ctx.save();
  ctx.font = `${style.fontWeight} ${scaledFontSize}px "${style.fontFamily}", sans-serif`;
  ctx.textAlign = style.textAlign;
  ctx.textBaseline = 'middle';

  const maxLineWidth = canvasWidth * 0.88;
  const lines = wrapText(ctx, formattedText, maxLineWidth);
  const totalTextHeight = lines.length * lineHeight;

  // Compute vertical position
  let centerY: number;
  const offsetPx = (style.verticalOffset / 100) * canvasHeight;

  if (style.position === 'top') {
    centerY = offsetPx + totalTextHeight / 2;
  } else if (style.position === 'middle') {
    centerY = canvasHeight / 2;
  } else {
    // bottom
    centerY = canvasHeight - offsetPx - totalTextHeight / 2;
  }

  // Draw background box if enabled
  if (style.hasBackground && style.backgroundOpacity > 0) {
    const padding = style.backgroundPadding * scale;
    const radius = style.backgroundRounded * scale;

    let maxBoxWidth = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxBoxWidth) maxBoxWidth = w;
    }

    const boxWidth = maxBoxWidth + padding * 3;
    const boxHeight = totalTextHeight + padding * 2;
    
    let boxX = (canvasWidth - boxWidth) / 2;
    if (style.textAlign === 'left') {
      boxX = canvasWidth * 0.08 - padding * 1.5;
    } else if (style.textAlign === 'right') {
      boxX = canvasWidth * 0.92 - boxWidth + padding * 1.5;
    }

    const boxY = centerY - totalTextHeight / 2 - padding;

    ctx.save();
    // Parse hex or rgb to rgba
    ctx.fillStyle = style.backgroundColor;
    ctx.globalAlpha = style.backgroundOpacity;
    roundRect(ctx, boxX, boxY, boxWidth, boxHeight, radius);
    ctx.fill();
    ctx.restore();
  }

  // Horizontal X coordinate
  let textX = canvasWidth / 2;
  if (style.textAlign === 'left') {
    textX = canvasWidth * 0.08;
  } else if (style.textAlign === 'right') {
    textX = canvasWidth * 0.92;
  }

  const startY = centerY - (lines.length - 1) * (lineHeight / 2);

  lines.forEach((line, index) => {
    const lineY = startY + index * lineHeight;

    // Stroke / Outline
    if (style.hasStroke && style.strokeWidth > 0) {
      ctx.save();
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = style.strokeWidth * scale;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(line, textX, lineY);
      ctx.restore();
    }

    // Shadow
    if (style.hasShadow) {
      ctx.save();
      ctx.shadowColor = style.shadowColor;
      ctx.shadowBlur = style.shadowBlur * scale;
      ctx.shadowOffsetX = style.shadowOffsetX * scale;
      ctx.shadowOffsetY = style.shadowOffsetY * scale;
      ctx.fillStyle = style.textColor;
      ctx.fillText(line, textX, lineY);
      ctx.restore();
    } else {
      ctx.save();
      ctx.fillStyle = style.textColor;
      ctx.fillText(line, textX, lineY);
      ctx.restore();
    }
  });

  ctx.restore();
}

/**
 * Export high-resolution video with burned-in subtitles using client-side Canvas and MediaRecorder
 */
export async function exportBurnedVideo(
  videoSourceUrl: string,
  subtitles: SubtitleCue[],
  style: SubtitleStyle,
  options: VideoExportOptions = {}
): Promise<Blob> {
  const { onProgress, onStatusChange, abortSignal, resolution = '1080p' } = options;

  onStatusChange?.('Preparing video rendering environment...');

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = videoSourceUrl;
    video.muted = false; // We connect to audio graph
    video.playsInline = true;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });

    if (!ctx) {
      reject(new Error('Failed to create Canvas 2D context'));
      return;
    }

    let mediaRecorder: MediaRecorder | null = null;
    let animationFrameId: number;
    const recordedChunks: Blob[] = [];

    const cleanup = () => {
      cancelAnimationFrame(animationFrameId);
      video.pause();
      video.removeAttribute('src');
      video.load();
    };

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        cleanup();
        reject(new Error('Export was cancelled by user.'));
      });
    }

    video.onloadedmetadata = () => {
      const isAudioOnly = style.isAudioMode || !video.videoWidth;
      const origWidth = isAudioOnly ? 1920 : (video.videoWidth || 1920);
      const origHeight = isAudioOnly ? 1080 : (video.videoHeight || 1080);
      const aspectRatio = origWidth / origHeight;

      let targetWidth = origWidth;
      let targetHeight = origHeight;

      if (resolution === '1080p' || isAudioOnly) {
        targetHeight = 1080;
        targetWidth = Math.round(targetHeight * aspectRatio);
      } else if (resolution === '720p') {
        targetHeight = 720;
        targetWidth = Math.round(targetHeight * aspectRatio);
      }

      // Ensure dimensions are even numbers (required by some encoders)
      canvas.width = targetWidth % 2 === 0 ? targetWidth : targetWidth + 1;
      canvas.height = targetHeight % 2 === 0 ? targetHeight : targetHeight + 1;

      // Audio setup using Web Audio API
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      const audioSource = audioCtx.createMediaElementSource(video);
      const audioDest = audioCtx.createMediaStreamDestination();
      audioSource.connect(audioDest);
      // Also connect to silent gain to avoid double speaker echo while recording
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 0.001;
      audioSource.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      // Create stream combining canvas video track + destination audio track
      const canvasStream = canvas.captureStream(30);
      const combinedTracks = [
        ...canvasStream.getVideoTracks(),
        ...audioDest.stream.getAudioTracks(),
      ];
      const combinedStream = new MediaStream(combinedTracks);

      // Select supported mime type
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ];
      const chosenMime = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || 'video/webm';

      try {
        mediaRecorder = new MediaRecorder(combinedStream, {
          mimeType: chosenMime,
          videoBitsPerSecond: 6_000_000, // 6 Mbps for high clarity
        });
      } catch (err) {
        mediaRecorder = new MediaRecorder(combinedStream);
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          if (animationFrameId) cancelAnimationFrame(animationFrameId);
          video.pause();
          combinedStream.getTracks().forEach((track) => track.stop());
          canvasStream.getTracks().forEach((track) => track.stop());
          audioDest.stream.getTracks().forEach((track) => track.stop());
          if (audioCtx.state !== 'closed') {
            await audioCtx.close();
          }
        } catch (err) {
          console.warn('AudioContext cleanup warning:', err);
        }

        onStatusChange?.('Finalizando y guardando archivo de video HD...');
        const finalBlob = new Blob(recordedChunks, { type: chosenMime });
        onProgress?.(100, video.duration || 0, video.duration || 0);
        resolve(finalBlob);
      };

      // Start rendering loop
      video.currentTime = 0;
      onStatusChange?.('Grabando video en alta resolución con subtítulos quemados...');
      mediaRecorder.start(250);

      const sortedCues = [...subtitles].sort((a, b) => a.start - b.start);

      const renderFrame = () => {
        if (video.ended || (video.duration > 0 && video.currentTime >= video.duration - 0.1)) {
          video.pause();
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
          return;
        }

        // Draw background loop or current video frame
        const isAudioOnly = style.isAudioMode || !video.videoWidth;
        const curTime = video.currentTime;

        if (isAudioOnly) {
          drawBackgroundLoop(ctx, canvas.width, canvas.height, style.backgroundLoop || 'aurora-gradient', curTime, {
            showVisualizer: style.showAudioVisualizer,
          });
        } else {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        const activeCue = sortedCues.find((c) => curTime >= c.start && curTime <= c.end) || null;

        // Draw styled subtitle overlay
        drawSubtitleOnCanvas(ctx, canvas.width, canvas.height, activeCue, style);

        // Report progress
        const percent = Math.min(99, Math.round((curTime / video.duration) * 100));
        onProgress?.(percent, curTime, video.duration);

        animationFrameId = requestAnimationFrame(renderFrame);
      };

      video.play().then(() => {
        animationFrameId = requestAnimationFrame(renderFrame);
      }).catch((err) => {
        cleanup();
        reject(err);
      });
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to load video file for burning.'));
    };
  });
}
