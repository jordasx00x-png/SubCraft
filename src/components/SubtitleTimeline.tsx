import React, { useRef, useState, useMemo, useEffect } from 'react';
import { SubtitleCue } from '../types/subtitle';
import {
  Plus,
  Clock,
  ZoomIn,
  ZoomOut,
  SkipBack,
  SkipForward,
  MoveHorizontal,
} from 'lucide-react';
import { formatTimeDisplay } from '../utils/subtitleFormats';

interface SubtitleTimelineProps {
  subtitles: SubtitleCue[];
  duration: number;
  currentTime: number;
  selectedCueId?: string | number | null;
  onSeek: (time: number) => void;
  onAddCueAtTime: (time: number) => void;
  onSelectCue: (cueId: string | number) => void;
  onUpdateCue: (cue: SubtitleCue) => void;
  onPause?: () => void;
}

export const SubtitleTimeline: React.FC<SubtitleTimelineProps> = ({
  subtitles,
  duration,
  currentTime,
  selectedCueId,
  onSeek,
  onAddCueAtTime,
  onSelectCue,
  onUpdateCue,
  onPause,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Dragging / Resizing state
  const [draggingCueId, setDraggingCueId] = useState<string | number | null>(null);
  const [dragMode, setDragMode] = useState<'move' | 'resize-left' | 'resize-right' | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [initialCueTimes, setInitialCueTimes] = useState<{ start: number; end: number } | null>(null);

  const safeDuration = duration > 0 ? duration : 60;

  // Waveform bars
  const waveformBars = useMemo(() => {
    const barCount = 180;
    const bars: number[] = [];
    for (let i = 0; i < barCount; i++) {
      const timeAtBar = (i / barCount) * safeDuration;
      const hasSpeech = subtitles.some(
        (c) => timeAtBar >= c.start - 0.2 && timeAtBar <= c.end + 0.2
      );
      if (hasSpeech) {
        const amp = 40 + Math.sin(i * 1.8) * 25 + Math.cos(i * 3.4) * 20;
        bars.push(Math.max(25, Math.min(95, amp)));
      } else {
        bars.push(10 + (i % 5) * 2);
      }
    }
    return bars;
  }, [subtitles, safeDuration]);

  // Auto-scroll timeline to keep playhead centered when zoomed in
  useEffect(() => {
    if (!scrollContainerRef.current || !trackRef.current || zoomLevel <= 1) return;
    const containerWidth = scrollContainerRef.current.clientWidth;
    const trackWidth = trackRef.current.clientWidth;
    const playheadX = (currentTime / safeDuration) * trackWidth;
    scrollContainerRef.current.scrollLeft = playheadX - containerWidth / 2;
  }, [currentTime, safeDuration, zoomLevel]);

  const handlePrevCue = () => {
    const prev = [...subtitles].reverse().find((c) => c.start < currentTime - 0.2);
    if (prev) {
      onSeek(prev.start);
      onPause?.();
    } else if (subtitles.length > 0) {
      onSeek(subtitles[0].start);
      onPause?.();
    }
  };

  const handleNextCue = () => {
    const next = subtitles.find((c) => c.start > currentTime + 0.2);
    if (next) {
      onSeek(next.start);
      onPause?.();
    } else if (subtitles.length > 0) {
      onSeek(subtitles[subtitles.length - 1].start);
      onPause?.();
    }
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || duration <= 0) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(pct * safeDuration);
    onPause?.();
  };

  const handleMouseDownCue = (
    e: React.MouseEvent,
    cue: SubtitleCue,
    mode: 'move' | 'resize-left' | 'resize-right'
  ) => {
    e.stopPropagation();
    setDraggingCueId(cue.id);
    setDragMode(mode);
    setDragStartX(e.clientX);
    setInitialCueTimes({ start: cue.start, end: cue.end });
    onSelectCue(cue.id);
    onSeek(cue.start);
    onPause?.();
  };

  useEffect(() => {
    if (!draggingCueId || !dragMode || !initialCueTimes || !trackRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const trackWidth = trackRef.current?.clientWidth || 1;
      const deltaX = e.clientX - dragStartX;
      const deltaTime = (deltaX / trackWidth) * safeDuration;

      const targetCue = subtitles.find((c) => c.id === draggingCueId);
      if (!targetCue) return;

      let newStart = initialCueTimes.start;
      let newEnd = initialCueTimes.end;
      const cueLength = initialCueTimes.end - initialCueTimes.start;

      if (dragMode === 'move') {
        newStart = Math.max(0, initialCueTimes.start + deltaTime);
        newEnd = newStart + cueLength;
      } else if (dragMode === 'resize-left') {
        newStart = Math.max(0, Math.min(initialCueTimes.end - 0.3, initialCueTimes.start + deltaTime));
      } else if (dragMode === 'resize-right') {
        newEnd = Math.max(newStart + 0.3, Math.min(safeDuration, initialCueTimes.end + deltaTime));
      }

      onUpdateCue({
        ...targetCue,
        start: Math.round(newStart * 100) / 100,
        end: Math.round(newEnd * 100) / 100,
      });
    };

    const handleMouseUp = () => {
      setDraggingCueId(null);
      setDragMode(null);
      setInitialCueTimes(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingCueId, dragMode, dragStartX, initialCueTimes, safeDuration, subtitles, onUpdateCue]);

  const playheadPercent = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-3 sm:p-4 shadow-sm select-none flex flex-col gap-2.5">
      {/* Top Timeline Toolbar */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-neutral-800 dark:text-neutral-200 font-bold">
            <Clock className="w-4 h-4 text-indigo-500" />
            <span className="hidden sm:inline">Línea de Tiempo Multitrack</span>
            <span className="text-[11px] font-mono font-medium text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
              {subtitles.length} bloques
            </span>
          </div>

          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <button
              onClick={handlePrevCue}
              className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors cursor-pointer"
              title="Subtítulo anterior"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleNextCue}
              className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors cursor-pointer"
              title="Subtítulo siguiente"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <button
              onClick={() => setZoomLevel((z) => Math.max(1, z / 2))}
              disabled={zoomLevel <= 1}
              className="p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 disabled:opacity-30 cursor-pointer"
              title="Alejar Zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono px-1 font-semibold text-neutral-700 dark:text-neutral-300">
              {zoomLevel}x
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(8, z * 2))}
              disabled={zoomLevel >= 8}
              className="p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 disabled:opacity-30 cursor-pointer"
              title="Acercar Zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => onAddCueAtTime(currentTime)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-xs transition-all cursor-pointer"
            title="Añadir subtítulo en el tiempo actual"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Subtítulo en {formatTimeDisplay(currentTime, false)}</span>
          </button>
        </div>
      </div>

      {/* Main Multi-Track Scroll Area */}
      <div
        ref={scrollContainerRef}
        className="w-full overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-950 shadow-inner relative custom-scrollbar"
      >
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          style={{ width: `${zoomLevel * 100}%` }}
          className="relative h-40 cursor-pointer select-none transition-all duration-150"
        >
          {/* TRACK 0: Time Ruler Header */}
          <div className="h-6 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between px-2 text-[10px] font-mono text-neutral-400 select-none">
            {Array.from({ length: 11 }).map((_, i) => {
              const timeSec = (i / 10) * safeDuration;
              return (
                <div key={i} className="flex flex-col items-center">
                  <div className="h-2 w-px bg-neutral-700 mb-0.5" />
                  <span>{formatTimeDisplay(timeSec, false)}</span>
                </div>
              );
            })}
          </div>

          {/* TRACK 1: Audio Waveform */}
          <div className="h-14 px-1 flex items-center justify-between gap-[1px] bg-neutral-950/90 border-b border-neutral-800/80 pointer-events-none opacity-85">
            {waveformBars.map((heightPct, idx) => (
              <div
                key={idx}
                style={{ height: `${heightPct}%` }}
                className="flex-1 bg-indigo-500/50 rounded-full"
              />
            ))}
          </div>

          {/* TRACK 2: Draggable & Resizable Subtitle Cue Blocks */}
          <div className="relative h-20 p-1.5">
            {subtitles.map((cue, idx) => {
              const leftPct = Math.min(100, Math.max(0, (cue.start / safeDuration) * 100));
              const widthPct = Math.min(
                100 - leftPct,
                Math.max(0.6, ((cue.end - cue.start) / safeDuration) * 100)
              );
              const isSelected = selectedCueId !== null && selectedCueId !== undefined && String(cue.id) === String(selectedCueId);
              const isAtPlayhead = currentTime >= cue.start && currentTime <= cue.end;
              const isActive = isSelected || isAtPlayhead;

              return (
                <div
                  key={cue.id}
                  onMouseDown={(e) => handleMouseDownCue(e, cue, 'move')}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                  }}
                  className={`absolute top-1 bottom-1 rounded-lg border text-[11px] font-semibold px-2 flex items-center justify-between overflow-hidden cursor-grab active:cursor-grabbing transition-colors ${
                    isActive
                      ? 'bg-amber-400 border-amber-300 text-neutral-950 font-black shadow-lg z-10 ring-2 ring-amber-400/60'
                      : 'bg-indigo-600/40 border-indigo-400/50 text-indigo-100 hover:bg-indigo-600/60'
                  }`}
                  title={`[${formatTimeDisplay(cue.start, true)} - ${formatTimeDisplay(cue.end, true)}] ${cue.text} (Arrastra para mover o redimensionar bordes)`}
                >
                  {/* Left Resize Handle */}
                  <div
                    onMouseDown={(e) => handleMouseDownCue(e, cue, 'resize-left')}
                    className="absolute left-0 top-0 bottom-0 w-2 bg-white/30 hover:bg-white cursor-ew-resize rounded-l z-20"
                    title="Arrastra para alargar/achicar inicio"
                  />

                  <div className="flex items-center gap-1 truncate pointer-events-none px-1">
                    <span className="font-mono text-[9px] opacity-70">#{idx + 1}</span>
                    <span className="truncate">{cue.text}</span>
                  </div>

                  {/* Right Resize Handle */}
                  <div
                    onMouseDown={(e) => handleMouseDownCue(e, cue, 'resize-right')}
                    className="absolute right-0 top-0 bottom-0 w-2 bg-white/30 hover:bg-white cursor-ew-resize rounded-r z-20"
                    title="Arrastra para alargar/achacar fin"
                  />
                </div>
              );
            })}
          </div>

          {/* PLAYHEAD Line */}
          <div
            style={{ left: `${playheadPercent}%` }}
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-30 shadow-md flex flex-col items-center"
          >
            <div className="bg-red-500 text-white font-mono text-[9px] px-1 py-0.5 rounded-b -mt-0.5 shadow-md font-bold tracking-tight">
              <span>{formatTimeDisplay(currentTime, true)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Global Navigation Bar ("Linea para mover toda la linea del tiempo") */}
      <div className="flex items-center gap-3 bg-neutral-100 dark:bg-neutral-950 p-2 rounded-xl border border-neutral-200 dark:border-neutral-800">
        <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 shrink-0 flex items-center gap-1">
          <MoveHorizontal className="w-3.5 h-3.5 text-indigo-500" />
          <span>Mover Línea del Tiempo:</span>
        </span>

        <input
          type="range"
          min={0}
          max={safeDuration}
          step={0.1}
          value={currentTime}
          onChange={(e) => {
            const targetTime = parseFloat(e.target.value);
            onSeek(targetTime);
            onPause?.();
          }}
          className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          title="Desliza esta barra para desplazarte libremente por todo el video"
        />

        <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
          {formatTimeDisplay(currentTime, true)}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 px-1 pt-0.5">
        <div className="flex items-center gap-3">
          <span>💡 Arrastra los bordes de los bloques para cambiar su duración</span>
          <span>🖱️ Usa la barra de navegación para desplazarte libremente</span>
        </div>
        <span className="font-mono text-[10px] text-neutral-400">
          Duración total: {formatTimeDisplay(duration, false)}
        </span>
      </div>
    </div>
  );
};
