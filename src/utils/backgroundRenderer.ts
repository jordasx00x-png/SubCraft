import { BackgroundLoopType } from '../types/subtitle';

/**
 * Animated background loop renderer for canvas.
 * Can be called during real-time playback or during offline 1080p video rendering.
 */
export function drawBackgroundLoop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  loopType: BackgroundLoopType,
  timeSec: number,
  options?: {
    showVisualizer?: boolean;
    customVideoElement?: HTMLVideoElement | null;
  }
) {
  ctx.save();

  // If custom video provided and available
  if (loopType === 'custom-video' && options?.customVideoElement) {
    try {
      ctx.drawImage(options.customVideoElement, 0, 0, width, height);
      ctx.restore();
      return;
    } catch {
      // Fallback to aurora if video frame fails
    }
  }

  switch (loopType) {
    case 'synthwave-grid':
      drawSynthwaveGrid(ctx, width, height, timeSec);
      break;
    case 'cosmic-nebula':
      drawCosmicNebula(ctx, width, height, timeSec);
      break;
    case 'sound-spectrum':
      drawSoundSpectrum(ctx, width, height, timeSec);
      break;
    case 'lofi-ambient':
      drawLofiAmbient(ctx, width, height, timeSec);
      break;
    case 'aurora-gradient':
    default:
      drawAuroraGradient(ctx, width, height, timeSec);
      break;
  }

  // Draw audio visualizer overlay if enabled
  if (options?.showVisualizer) {
    drawAudioWaveformOverlay(ctx, width, height, timeSec);
  }

  ctx.restore();
}

/**
 * 1. Aurora Mesh Gradient: organic fluid morphing colors
 */
function drawAuroraGradient(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number
) {
  // Base dark gradient
  const bgGrad = ctx.createLinearGradient(0, 0, w, h);
  bgGrad.addColorStop(0, '#090514');
  bgGrad.addColorStop(0.5, '#0b0f19');
  bgGrad.addColorStop(1, '#05030a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Moving orb 1 (Indigo/Violet)
  const x1 = w * (0.3 + 0.25 * Math.sin(t * 0.4));
  const y1 = h * (0.4 + 0.2 * Math.cos(t * 0.35));
  const r1 = Math.min(w, h) * 0.55;
  const rad1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, r1);
  rad1.addColorStop(0, 'rgba(99, 102, 241, 0.45)');
  rad1.addColorStop(0.6, 'rgba(79, 70, 229, 0.15)');
  rad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = rad1;
  ctx.fillRect(0, 0, w, h);

  // Moving orb 2 (Cyan/Teal)
  const x2 = w * (0.7 + 0.2 * Math.cos(t * 0.3));
  const y2 = h * (0.6 + 0.25 * Math.sin(t * 0.45));
  const r2 = Math.min(w, h) * 0.5;
  const rad2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, r2);
  rad2.addColorStop(0, 'rgba(6, 182, 212, 0.4)');
  rad2.addColorStop(0.55, 'rgba(14, 116, 144, 0.12)');
  rad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = rad2;
  ctx.fillRect(0, 0, w, h);

  // Moving orb 3 (Rose/Magenta)
  const x3 = w * (0.5 + 0.3 * Math.sin(t * 0.25 + 2));
  const y3 = h * (0.3 + 0.3 * Math.cos(t * 0.3 + 1));
  const r3 = Math.min(w, h) * 0.45;
  const rad3 = ctx.createRadialGradient(x3, y3, 0, x3, y3, r3);
  rad3.addColorStop(0, 'rgba(236, 72, 153, 0.35)');
  rad3.addColorStop(0.5, 'rgba(190, 24, 93, 0.1)');
  rad3.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = rad3;
  ctx.fillRect(0, 0, w, h);

  // Subtle vignette
  const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.4, w / 2, h / 2, Math.max(w, h) * 0.8);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}

/**
 * 2. Synthwave 3D Grid & Neon Horizon
 */
function drawSynthwaveGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number
) {
  // Dark purple sky
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  sky.addColorStop(0, '#090014');
  sky.addColorStop(0.5, '#1b003a');
  sky.addColorStop(1, '#3b0764');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * 0.6);

  // Glowing Retro Sun
  const sunX = w / 2;
  const sunY = h * 0.48;
  const sunR = Math.min(w, h) * 0.22;

  const sunGlow = ctx.createRadialGradient(sunX, sunY, sunR * 0.4, sunX, sunY, sunR * 1.8);
  sunGlow.addColorStop(0, 'rgba(251, 146, 60, 0.9)');
  sunGlow.addColorStop(0.4, 'rgba(236, 72, 153, 0.5)');
  sunGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR * 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Sun core
  const sunCore = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  sunCore.addColorStop(0, '#fde047');
  sunCore.addColorStop(0.6, '#f97316');
  sunCore.addColorStop(1, '#db2777');
  ctx.fillStyle = sunCore;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // Sun cut lines
  ctx.fillStyle = '#1b003a';
  for (let i = 1; i <= 5; i++) {
    const lineY = sunY + sunR * 0.2 + (i * (sunR * 0.75)) / 5;
    const lineH = 2 + i * 1.5;
    ctx.fillRect(sunX - sunR, lineY, sunR * 2, lineH);
  }

  // Ground plane
  const ground = ctx.createLinearGradient(0, h * 0.55, 0, h);
  ground.addColorStop(0, '#100028');
  ground.addColorStop(1, '#050010');
  ctx.fillStyle = ground;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);

  // Moving Perspective Grid
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = '#ec4899';
  ctx.shadowBlur = 8;

  const horizonY = h * 0.55;
  const numVLines = 24;
  for (let i = -numVLines; i <= numVLines; i++) {
    const xBottom = w / 2 + (i * w * 1.5) / numVLines;
    ctx.beginPath();
    ctx.moveTo(w / 2, horizonY);
    ctx.lineTo(xBottom, h);
    ctx.stroke();
  }

  // Horizontal moving lines (exponential perspective)
  const speed = (t * 0.8) % 1;
  const numHLines = 12;
  for (let i = 0; i < numHLines; i++) {
    const p = Math.pow((i + speed) / numHLines, 2.2);
    const lineY = horizonY + p * (h - horizonY);
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(w, lineY);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

/**
 * 3. Cosmic Starfield & Stardust Nebula
 */
function drawCosmicNebula(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number
) {
  // Deep space base
  ctx.fillStyle = '#030014';
  ctx.fillRect(0, 0, w, h);

  // Nebula cloud 1 (Cyan/Purple)
  const neb1 = ctx.createRadialGradient(
    w * 0.35 + Math.sin(t * 0.2) * 50,
    h * 0.45 + Math.cos(t * 0.25) * 40,
    10,
    w * 0.35,
    h * 0.45,
    Math.min(w, h) * 0.6
  );
  neb1.addColorStop(0, 'rgba(168, 85, 247, 0.4)');
  neb1.addColorStop(0.4, 'rgba(59, 130, 246, 0.15)');
  neb1.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = neb1;
  ctx.fillRect(0, 0, w, h);

  // Nebula cloud 2 (Pink/Amber)
  const neb2 = ctx.createRadialGradient(
    w * 0.7 + Math.cos(t * 0.18) * 60,
    h * 0.55 + Math.sin(t * 0.22) * 50,
    10,
    w * 0.7,
    h * 0.55,
    Math.min(w, h) * 0.5
  );
  neb2.addColorStop(0, 'rgba(244, 63, 94, 0.3)');
  neb2.addColorStop(0.5, 'rgba(251, 146, 60, 0.1)');
  neb2.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = neb2;
  ctx.fillRect(0, 0, w, h);

  // Twinkling stars (deterministic based on index)
  ctx.fillStyle = '#ffffff';
  const starCount = 60;
  for (let i = 0; i < starCount; i++) {
    const seedX = (Math.sin(i * 123.45) * 0.5 + 0.5) * w;
    const seedY = ((Math.cos(i * 678.9) * 0.5 + 0.5) * h + t * (10 + (i % 15))) % h;
    const size = 1 + (i % 3);
    const alpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 2 + i));

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(seedX, seedY, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * 4. Sound Spectrum Visualizer
 */
function drawSoundSpectrum(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number
) {
  // Dark techno gradient
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#020617');
  bg.addColorStop(1, '#0f172a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Centered circular radar pulses
  const cx = w / 2;
  const cy = h / 2;
  for (let i = 1; i <= 4; i++) {
    const pulseR = ((t * 60 + i * 80) % 320) + 40;
    const alpha = Math.max(0, 1 - pulseR / 360) * 0.25;
    ctx.strokeStyle = `rgba(34, 211, 238, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Audio frequency bars along the bottom
  const barCount = 42;
  const barWidth = (w * 0.8) / barCount;
  const startX = w * 0.1;

  for (let i = 0; i < barCount; i++) {
    // Generate rhythmic wave based on math frequencies
    const freq = Math.sin(t * 4 + i * 0.35) * Math.cos(t * 2.5 + i * 0.2);
    const heightFactor = Math.abs(freq);
    const barHeight = 20 + heightFactor * (h * 0.28);
    const barX = startX + i * barWidth;
    const barY = h - barHeight - 40;

    const barGrad = ctx.createLinearGradient(0, barY, 0, h - 40);
    barGrad.addColorStop(0, '#22d3ee');
    barGrad.addColorStop(0.5, '#6366f1');
    barGrad.addColorStop(1, '#a855f7');

    ctx.fillStyle = barGrad;
    ctx.fillRect(barX + 2, barY, barWidth - 4, barHeight);
  }
}

/**
 * 5. Lo-Fi Midnight Rain & Ambient Bokeh
 */
function drawLofiAmbient(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number
) {
  // Midnight blue/grey
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0c101c');
  bg.addColorStop(1, '#05070d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Ambient bokeh circles
  const bokehCount = 14;
  for (let i = 0; i < bokehCount; i++) {
    const bx = (Math.sin(i * 32.1) * 0.5 + 0.5) * w;
    const by = (Math.cos(i * 45.6) * 0.5 + 0.5) * h;
    const br = 40 + (i % 5) * 30;
    const bGrad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    bGrad.addColorStop(0, i % 2 === 0 ? 'rgba(251, 191, 36, 0.18)' : 'rgba(56, 189, 248, 0.15)');
    bGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft falling rain streaks
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  const rainCount = 45;
  for (let i = 0; i < rainCount; i++) {
    const rx = (Math.sin(i * 99.7) * 0.5 + 0.5) * w;
    const ry = ((Math.cos(i * 77.3) * 0.5 + 0.5) * h + t * 400 + i * 30) % (h + 100);
    const rLen = 20 + (i % 15);
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx - 4, ry + rLen);
    ctx.stroke();
  }
}

/**
 * Animated sine audio waveform overlay
 */
function drawAudioWaveformOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number
) {
  const centerY = h * 0.5;
  ctx.lineWidth = 2.5;

  // Wave 1
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
  for (let x = 0; x <= w; x += 8) {
    const norm = x / w;
    const envelope = Math.sin(norm * Math.PI); // tapering edges
    const y = centerY + Math.sin(x * 0.02 + t * 4) * 35 * envelope;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Wave 2
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.5)';
  for (let x = 0; x <= w; x += 8) {
    const norm = x / w;
    const envelope = Math.sin(norm * Math.PI);
    const y = centerY + Math.cos(x * 0.025 - t * 3.5) * 45 * envelope;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}
