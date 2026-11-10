import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Upload,
  Repeat,
  FastForward,
  Rewind,
  Video,
  Radio,
  Sparkles,
  Music,
  Smartphone,
  Monitor,
  Square,
  StepBack,
  StepForward,
} from 'lucide-react';
import { SubtitleCue, SubtitleStyle } from '../types/subtitle';
import { formatTimeDisplay } from '../utils/subtitleFormats';
import { drawBackgroundLoop } from '../utils/backgroundRenderer';

export type AspectRatioType = '16:9' | '9:16' | '1:1';

interface VideoPlayerProps {
  videoUrl: string | null;
  videoFileName?: string;
  subtitles: SubtitleCue[];
  selectedCueId?: string | number | null;
  style: SubtitleStyle;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onPlayPauseToggle: () => void;
  onSeek: (time: number) => void;
  onUploadNewVideo: () => void;
  onLoadSampleVideo: () => void;
  onOpenBackgroundLoopModal?: () => void;
  onUpdateCue?: (updatedCue: SubtitleCue) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  videoFileName,
  subtitles,
  selectedCueId,
  style,
  currentTime,
  duration,
  isPlaying,
  onTimeUpdate,
  onDurationChange,
  onPlayPauseToggle,
  onSeek,
  onUploadNewVideo,
  onLoadSampleVideo,
  onOpenBackgroundLoopModal,
  onUpdateCue,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>('16:9');
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [loopCurrentCue, setLoopCurrentCue] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isEditingOnScreen, setIsEditingOnScreen] = useState<boolean>(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ultra-smooth 60 FPS Background Loop Canvas animation for Audio Mode
  useEffect(() => {
    if (!style.isAudioMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let startTimestamp: number | null = null;
    const baseTime = currentTime;

    const render = (timestamp: number) => {
      if (startTimestamp === null) startTimestamp = timestamp;

      const targetW = canvas.clientWidth || 1280;
      const targetH = canvas.clientHeight || 720;
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      // Smooth continuous time calculation for 60fps animations
      const elapsedSec = isPlaying
        ? baseTime + (timestamp - startTimestamp) / 1000
        : currentTime;

      drawBackgroundLoop(
        ctx,
        canvas.width,
        canvas.height,
        style.backgroundLoop || 'aurora-gradient',
        elapsedSec,
        {
          showVisualizer: style.showAudioVisualizer,
        }
      );

      if (isPlaying) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [style.isAudioMode, style.backgroundLoop, style.showAudioVisualizer, isPlaying]);

  // Sync internal video element with isPlaying state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying && video.paused) {
      video.play().catch(() => {});
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [isPlaying]);

  // Sync internal playback rate
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Sync volume & mute
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  const isSeekingRef = useRef<boolean>(false);
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync video element time when currentTime prop changes externally (e.g. timeline click)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (Math.abs(video.currentTime - currentTime) > 0.05) {
      isSeekingRef.current = true;
      video.currentTime = currentTime;

      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
      seekTimeoutRef.current = setTimeout(() => {
        isSeekingRef.current = false;
      }, 220);
    }
  }, [currentTime]);

  // Active cue strictly for the current playhead position or selected subtitle
  const activeCue = useMemo(() => {
    if (subtitles.length === 0) return null;

    // 1. First priority: Exact match at current playhead position
    const activeAtTime = subtitles.find(
      (c) => currentTime >= c.start - 0.05 && currentTime <= c.end + 0.05
    );
    if (activeAtTime) {
      return activeAtTime;
    }

    // 2. If no cue is active at current time (e.g. in a gap or paused), check if selectedCueId is within range of playhead
    if (selectedCueId !== null && selectedCueId !== undefined) {
      const selected = subtitles.find((c) => String(c.id) === String(selectedCueId));
      if (selected && currentTime >= selected.start - 1.0 && currentTime <= selected.end + 1.0) {
        return selected;
      }
    }

    return null;
  }, [subtitles, currentTime, selectedCueId]);

  // Loop current cue if enabled
  useEffect(() => {
    if (loopCurrentCue && activeCue && videoRef.current) {
      if (currentTime >= activeCue.end) {
        videoRef.current.currentTime = activeCue.start;
        onSeek(activeCue.start);
      }
    }
  }, [loopCurrentCue, activeCue, currentTime, onSeek]);

  const handleTimeUpdate = () => {
    if (videoRef.current && !isSeekingRef.current) {
      onTimeUpdate(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      onDurationChange(videoRef.current.duration);
    }
  };

  const handleSliderSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = target;
    }
    onSeek(target);
  };

  const handleStepFrame = (delta: number) => {
    if (!videoRef.current) return;
    const target = Math.max(0, Math.min(duration, videoRef.current.currentTime + delta));
    videoRef.current.currentTime = target;
    onSeek(target);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 2800);
  };

  // Build real-time CSS for subtitle overlay
  const overlayStyle = useMemo(() => {
    let textShadow = 'none';
    if (style.hasShadow) {
      textShadow = `${style.shadowOffsetX}px ${style.shadowOffsetY}px ${style.shadowBlur}px ${style.shadowColor}`;
    }

    let webkitTextStroke = 'none';
    if (style.hasStroke && style.strokeWidth > 0) {
      webkitTextStroke = `${style.strokeWidth}px ${style.strokeColor}`;
    }

    let backgroundColor = 'transparent';
    if (style.hasBackground && style.backgroundOpacity > 0) {
      const hex = style.backgroundColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 0;
      const g = parseInt(hex.substring(2, 4), 16) || 0;
      const b = parseInt(hex.substring(4, 6), 16) || 0;
      backgroundColor = `rgba(${r}, ${g}, ${b}, ${style.backgroundOpacity})`;
    }

    const minSize = Math.max(14, Math.round(style.fontSize * 0.45));
    const cqwVal = (style.fontSize / 5.5).toFixed(2);
    const maxSize = Math.round(style.fontSize * 3.8);

    const calculatedFontSize = style.fullScreenSubtitle
      ? `clamp(24px, ${(style.fontSize / 4.0).toFixed(2)}cqw, ${style.fontSize * 4.5}px)`
      : `clamp(${minSize}px, ${cqwVal}cqw, ${maxSize}px)`;

    return {
      fontFamily: `"${style.fontFamily}", sans-serif`,
      fontSize: calculatedFontSize,
      fontWeight: style.fontWeight,
      color: style.textColor,
      textTransform: style.textTransform,
      letterSpacing: `${style.letterSpacing}px`,
      lineHeight: 1.25,
      WebkitTextStroke: webkitTextStroke,
      paintOrder: 'stroke fill',
      textShadow,
      backgroundColor,
      padding: style.hasBackground
        ? `${style.backgroundPadding}px ${style.backgroundPadding * 1.6}px`
        : '2px 8px',
      borderRadius: `${style.backgroundRounded}px`,
      textAlign: style.textAlign,
      boxSizing: 'border-box' as const,
      display: 'inline-flex',
      flexDirection: 'column' as const,
      alignItems:
        style.textAlign === 'left'
          ? 'flex-start'
          : style.textAlign === 'right'
          ? 'flex-end'
          : 'center',
      justifyContent: 'center',
      maxWidth: '92%',
      width: 'fit-content',
      wordBreak: 'break-word' as const,
      whiteSpace: 'pre-wrap' as const,
    };
  }, [style]);

  // Position class for overlay
  const positionClass = useMemo(() => {
    let vertical = 'bottom-10 inset-x-0 items-end';
    if (style.position === 'top') {
      vertical = 'top-6 inset-x-0 items-start';
    } else if (style.position === 'middle' || style.fullScreenSubtitle) {
      vertical = 'inset-0 items-center';
    }

    let horizontal = 'justify-center text-center px-6';
    if (style.textAlign === 'left') {
      horizontal = 'justify-start text-left pl-8 pr-4';
    } else if (style.textAlign === 'right') {
      horizontal = 'justify-end text-right pr-8 pl-4';
    }

    return `${vertical} ${horizontal}`;
  }, [style.position, style.textAlign, style.fullScreenSubtitle]);

  // Aspect ratio container styles
  const aspectClass = useMemo(() => {
    if (aspectRatio === '9:16') {
      return 'aspect-[9/16] w-full max-w-[340px] mx-auto';
    }
    if (aspectRatio === '1:1') {
      return 'aspect-square w-full max-w-[440px] mx-auto';
    }
    return 'aspect-video w-full shadow-2xl';
  }, [aspectRatio]);

  return (
    <div className="flex flex-col gap-2">
      {/* Upper Monitor Bar: Source Info & Aspect Ratio Switcher */}
      <div className="flex items-center justify-between text-xs px-1 text-neutral-600 dark:text-neutral-400">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5 truncate">
            {style.isAudioMode ? (
              <Radio className="w-4 h-4 text-pink-500 shrink-0" />
            ) : (
              <Video className="w-4 h-4 text-indigo-500 shrink-0" />
            )}
            <span className="truncate max-w-[220px] sm:max-w-xs">
              {videoFileName || 'Proyecto de Video'}
            </span>
          </span>

          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 hidden sm:inline">
            {style.isAudioMode ? 'Puro Audio + 60fps Loop' : 'Video 1080p'}
          </span>
        </div>

        {/* Aspect Ratio Switcher (16:9, 9:16 Reels, 1:1 Feed) */}
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <button
            onClick={() => setAspectRatio('16:9')}
            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
              aspectRatio === '16:9'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
            title="Formato Horizontal (YouTube / TV / Pantalla normal)"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">16:9</span>
          </button>

          <button
            onClick={() => setAspectRatio('9:16')}
            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
              aspectRatio === '9:16'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
            title="Formato Vertical (TikTok / Reels / Shorts)"
          >
            <Smartphone className="w-3.5 h-3.5 text-pink-500" />
            <span className="hidden xs:inline">9:16</span>
          </button>

          <button
            onClick={() => setAspectRatio('1:1')}
            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
              aspectRatio === '1:1'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
            title="Formato Cuadrado (Instagram / LinkedIn Post)"
          >
            <Square className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">1:1</span>
          </button>
        </div>
      </div>

      {/* Main Video Monitor Bezel */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className={`relative ${aspectClass} @container bg-neutral-950 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-center items-center group border border-neutral-200 dark:border-neutral-800 transition-all`}
      >
        {videoUrl ? (
          <>
            {/* Animated Canvas for Audio-Only Mode */}
            {style.isAudioMode ? (
              <canvas
                ref={canvasRef}
                onClick={onPlayPauseToggle}
                className="w-full h-full object-cover cursor-pointer"
              />
            ) : null}

            {/* Native Video Element */}
            <video
              ref={videoRef}
              src={videoUrl}
              onClick={onPlayPauseToggle}
              onTimeUpdate={handleTimeUpdate}
              onSeeked={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => onPlayPauseToggle()}
              className={`w-full h-full object-contain cursor-pointer ${
                style.isAudioMode ? 'hidden' : 'block'
              }`}
              playsInline
            />

            {/* Live Subtitle Overlay with On-Screen Direct Editing */}
            <div
              className={`absolute pointer-events-auto flex justify-center px-6 z-20 transition-all duration-75 ${positionClass}`}
              style={{
                transform:
                  style.position === 'bottom'
                    ? `translateY(-${style.verticalOffset * 1.8}px)`
                    : style.position === 'top'
                    ? `translateY(${style.verticalOffset * 1.8}px)`
                    : 'none',
              }}
            >
              {activeCue && (
                <div className="relative group/sub">
                  {isEditingOnScreen ? (
                    <div className="flex flex-col items-center gap-1.5 animate-in zoom-in-95 duration-100">
                      <span className="text-[10px] font-bold text-amber-300 bg-black/90 backdrop-blur-md px-3 py-1 rounded-full border border-amber-400/40 shadow-md">
                        ✏ Editando subtítulo en pantalla (Enter o haz clic fuera para guardar)
                      </span>
                      <textarea
                        autoFocus
                        rows={2}
                        value={activeCue.text}
                        onChange={(e) => onUpdateCue?.({ ...activeCue, text: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            setIsEditingOnScreen(false);
                          }
                        }}
                        onBlur={() => setIsEditingOnScreen(false)}
                        style={overlayStyle as React.CSSProperties}
                        className="max-w-[92vw] sm:max-w-[540px] leading-relaxed outline-none ring-2 ring-indigo-500 rounded-2xl resize-none shadow-2xl text-center bg-black/85"
                      />
                    </div>
                  ) : (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isPlaying) onPlayPauseToggle();
                        setIsEditingOnScreen(true);
                      }}
                      style={overlayStyle as React.CSSProperties}
                      className="max-w-[92%] leading-relaxed select-none transition-all duration-75 drop-shadow-md inline-block animate-in fade-in zoom-in-95 duration-100 text-center cursor-pointer hover:ring-2 hover:ring-indigo-400/80 hover:scale-102 rounded-2xl p-1.5"
                      title="Haz clic para editar el texto directamente sobre el video"
                    >
                      {activeCue.text}
                      <span className="opacity-0 group-hover/sub:opacity-100 transition-opacity ml-2 text-[10px] text-indigo-300 font-mono font-bold">
                        [✎ Editar]
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick On-Video Header (Hover overlay) */}
            <div
              className={`absolute top-0 inset-x-0 p-3 bg-gradient-to-b from-black/80 via-black/30 to-transparent flex items-center justify-between z-30 transition-opacity duration-300 ${
                showControls ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-white/90 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/10 flex items-center gap-1.5 truncate max-w-[260px]">
                  <Video className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="truncate">{videoFileName}</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                {onOpenBackgroundLoopModal && (
                  <button
                    onClick={onOpenBackgroundLoopModal}
                    className="text-[11px] font-semibold text-white bg-violet-600/80 hover:bg-violet-600 backdrop-blur-md px-2.5 py-1 rounded-lg border border-violet-400/30 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span className="hidden xs:inline">Fondos Loop</span>
                  </button>
                )}
                <button
                  onClick={onUploadNewVideo}
                  className="text-[11px] font-semibold text-white bg-indigo-600/80 hover:bg-indigo-600 backdrop-blur-md px-2.5 py-1 rounded-lg border border-indigo-400/30 flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Cambiar Video</span>
                </button>
              </div>
            </div>

            {/* Transport & Playback Overlay (Bottom of Video) */}
            <div
              className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-3 sm:p-4 flex flex-col gap-2 z-30 transition-opacity duration-300 ${
                showControls ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {/* Scrubber Range Input */}
              <div className="relative flex items-center group/scrubber cursor-pointer">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.02}
                  value={currentTime}
                  onChange={handleSliderSeek}
                  className="w-full h-1.5 group-hover/scrubber:h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500 transition-all"
                />
              </div>

              {/* Bottom Transport Controls */}
              <div className="flex items-center justify-between text-white text-xs mt-0.5">
                {/* Left: Play/Pause, Frame steps, Timecode */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={onPlayPauseToggle}
                    className="p-1.5 sm:p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title={isPlaying ? 'Pausar (Espacio)' : 'Reproducir (Espacio)'}
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4 fill-white" />
                    ) : (
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                    )}
                  </button>

                  {/* Step frame backward (-0.1s) */}
                  <button
                    onClick={() => handleStepFrame(-0.1)}
                    className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                    title="Retroceder 1 cuadro (-0.1s)"
                  >
                    <StepBack className="w-3.5 h-3.5" />
                  </button>

                  {/* Step frame forward (+0.1s) */}
                  <button
                    onClick={() => handleStepFrame(0.1)}
                    className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                    title="Avanzar 1 cuadro (+0.1s)"
                  >
                    <StepForward className="w-3.5 h-3.5" />
                  </button>

                  {/* Loop cue toggle */}
                  <button
                    onClick={() => setLoopCurrentCue(!loopCurrentCue)}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer hidden xs:flex items-center gap-1 ${
                      loopCurrentCue
                        ? 'bg-amber-400 text-neutral-950 font-bold'
                        : 'text-white/80 hover:bg-white/15 hover:text-white'
                    }`}
                    title="Repetir en bucle el subtítulo actual"
                  >
                    <Repeat className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Bucle</span>
                  </button>

                  {/* Monospace Accurate Timecode */}
                  <div className="text-xs font-mono text-white/90 tracking-wide select-none pl-1">
                    <span className="font-bold text-white">
                      {formatTimeDisplay(currentTime, true)}
                    </span>
                    <span className="text-white/40 mx-1">/</span>
                    <span className="text-white/70">
                      {formatTimeDisplay(duration, false)}
                    </span>
                  </div>
                </div>

                {/* Right: Sound, Playback Speed, Fullscreen */}
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Volume Slider */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className="p-1 rounded text-white/80 hover:text-white transition-colors cursor-pointer"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-3.5 h-3.5" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        setVolume(parseFloat(e.target.value));
                        if (isMuted) setIsMuted(false);
                      }}
                      className="w-12 sm:w-16 h-1 bg-white/20 rounded appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Speed Selector */}
                  <select
                    value={playbackRate}
                    onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                    className="bg-white/10 hover:bg-white/20 text-white text-[11px] font-mono px-1.5 py-1 rounded border border-white/10 outline-none cursor-pointer"
                  >
                    <option value={0.5} className="bg-neutral-900 text-white">0.5x</option>
                    <option value={0.75} className="bg-neutral-900 text-white">0.75x</option>
                    <option value={1} className="bg-neutral-900 text-white">1x</option>
                    <option value={1.25} className="bg-neutral-900 text-white">1.25x</option>
                    <option value={1.5} className="bg-neutral-900 text-white">1.5x</option>
                    <option value={2} className="bg-neutral-900 text-white">2x</option>
                  </select>

                  {/* Fullscreen */}
                  <button
                    onClick={toggleFullscreen}
                    className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                    title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                  >
                    {isFullscreen ? (
                      <Minimize className="w-3.5 h-3.5" />
                    ) : (
                      <Maximize className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3 shadow-md">
              <Upload className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              {videoFileName ? `Video de Proyecto: ${videoFileName}` : 'Carga un video para subtitular'}
            </h3>
            <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
              {videoFileName
                ? 'Sube el archivo de video/audio correspondiente para comenzar a editar o previsualizar.'
                : 'Soporta MP4, WebM, MOV o puro audio con fondos animados en bucle.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                onClick={onUploadNewVideo}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{videoFileName ? 'Seleccionar Video' : '+ Añadir Video'}</span>
              </button>
              <button
                onClick={onLoadSampleVideo}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Video className="w-3.5 h-3.5 text-amber-400" />
                <span>Usar Demo</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
