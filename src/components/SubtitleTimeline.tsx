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
  Trash2,
} from 'lucide-react';
import { formatTimeDisplay } from '../utils/subtitleFormats';

interface SubtitleTimelineProps {
  subtitles: SubtitleCue[];
  duration: number;
  currentTime: number;
  selectedCueId?: string | number | null;
  selectedCueIds?: Array<string | number>;
  onSeek: (time: number) => void;
  onAddCueAtTime: (time: number) => void;
  onSelectCue: (
    cueId: string | number,
    modifiers?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }
  ) => void;
  onUpdateCue: (cue: SubtitleCue) => void;
  onDeleteCue?: (cueId: string | number) => void;
  onPause?: () => void;
}

export const SubtitleTimeline: React.FC<SubtitleTimelineProps> = ({
  subtitles,
  duration,
  currentTime,
  selectedCueId,
  selectedCueIds = [],
  onSeek,
  onAddCueAtTime,
  onSelectCue,
  onUpdateCue,
  onDeleteCue,
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

  const selectedCueIndex = useMemo(
    () =>
      selectedCueId !== null && selectedCueId !== undefined
        ? subtitles.findIndex((c) => String(c.id) === String(selectedCueId))
        : -1,
    [subtitles, selectedCueId]
  );
  const selectedCue = selectedCueIndex >= 0 ? subtitles[selectedCueIndex] : null;

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
      onSelectCue(prev.id);
    } else if (subtitles.length > 0) {
      onSelectCue(subtitles[0].id);
    }
  };

  const handleNextCue = () => {
    const next = subtitles.find((c) => c.start > currentTime + 0.2);
    if (next) {
      onSelectCue(next.id);
    } else if (subtitles.length > 0) {
      onSelectCue(subtitles[subtitles.length - 1].id);
    }
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || safeDuration <= 0) return;
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
    const hasMultiModifier = e.shiftKey || e.ctrlKey || e.metaKey;
    onSelectCue(cue.id, {
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
    });
    if (hasMultiModifier && mode === 'move') {
      return;
    }
    setDraggingCueId(cue.id);
    setDragMode(mode);
    setDragStartX(e.clientX);
    setInitialCueTimes({ start: cue.start, end: cue.end });
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
    <div className="bg-white dark:bg-[#0b0c10] h-full min-h-0 flex flex-col select-none">
      {/* Top Timeline Toolbar (36px) */}
      <div className="h-9 px-3 border-b border-neutral-200 dark:border-neutral-800/90 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-neutral-900 dark:text-white font-semibold">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline">Línea de Tiempo</span>
          </div>

          <span aria-hidden="true" className="text-neutral-300 dark:text-neutral-700">·</span>

          <span className="text-[11px] font-mono tabular-nums text-neutral-500">
            {subtitles.length} bloques{selectedCueIds.length > 1 ? ` · ${selectedCueIds.length} sel.` : ''}
          </span>

          <div className="flex items-center bg-neutral-100 dark:bg-neutral-900 p-0.5 rounded border border-neutral-200 dark:border-neutral-800 ml-1">
            <button
              onClick={handlePrevCue}
              className="p-1 hover:text-indigo-500 rounded transition-colors cursor-pointer"
              title="Subtítulo anterior"
            >
              <SkipBack className="w-3 h-3" />
            </button>
            <button
              onClick={handleNextCue}
              className="p-1 hover:text-indigo-500 rounded transition-colors cursor-pointer"
              title="Subtítulo siguiente"
            >
              <SkipForward className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-900 px-1 py-0.5 rounded border border-neutral-200 dark:border-neutral-800">
            <button
              onClick={() => setZoomLevel((z) => Math.max(1, z / 2))}
              disabled={zoomLevel <= 1}
              className="p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 disabled:opacity-30 cursor-pointer"
              title="Alejar Zoom"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono px-1 font-semibold text-neutral-600 dark:text-neutral-400">
              {zoomLevel}x
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(8, z * 2))}
              disabled={zoomLevel >= 8}
              className="p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 disabled:opacity-30 cursor-pointer"
              title="Acercar Zoom"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          {selectedCue && onDeleteCue && (
            <button
              type="button"
              onClick={() => onDeleteCue(selectedCue.id)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25 hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
              title={`Eliminar bloque #${selectedCueIndex + 1} (Supr)`}
            >
              <Trash2 className="w-3 h-3" />
              <span>Eliminar #{selectedCueIndex + 1}</span>
            </button>
          )}

          <button
            onClick={() => onAddCueAtTime(currentTime)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
            title="Añadir subtítulo en el tiempo actual"
          >
            <Plus className="w-3 h-3" />
            <span>Bloque en {formatTimeDisplay(currentTime, false)}</span>
          </button>
        </div>
      </div>

      {/* Main Multi-Track Scroll Area (Flex 1 fills height) */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-[135px] w-full overflow-x-auto overflow-y-hidden bg-[#06070a] relative custom-scrollbar"
      >
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          style={{ width: `${zoomLevel * 100}%` }}
          className="relative h-full flex flex-col cursor-pointer select-none transition-all duration-150"
        >
          {/* TRACK 0: Time Ruler Header */}
          <div className="h-5 bg-[#0e1017] border-b border-neutral-800/90 flex items-center justify-between px-2 text-[10px] font-mono text-neutral-500 select-none shrink-0">
            {Array.from({ length: 11 }).map((_, i) => {
              const timeSec = (i / 10) * safeDuration;
              return (
                <div key={i} className="flex flex-col items-center">
                  <div className="h-1.5 w-px bg-neutral-700" />
                  <span>{formatTimeDisplay(timeSec, false)}</span>
                </div>
              );
            })}
          </div>

          {/* TRACK 1: Audio Waveform */}
          <div className="h-10 px-1 flex items-center justify-between gap-[1px] bg-[#08090d] border-b border-neutral-800/60 pointer-events-none opacity-80 shrink-0">
            {waveformBars.map((heightPct, idx) => (
              <div
                key={idx}
                style={{ height: `${heightPct}%` }}
                className="flex-1 bg-indigo-500/45 rounded-full"
              />
            ))}
          </div>

          {/* TRACK 2: Draggable & Resizable Subtitle Cue Blocks */}
          <div className="relative flex-1 min-h-[58px] p-1.5">
            {subtitles.map((cue, idx) => {
              const leftPct = Math.min(100, Math.max(0, (cue.start / safeDuration) * 100));
              const widthPct = Math.min(
                100 - leftPct,
                Math.max(0.6, ((cue.end - cue.start) / safeDuration) * 100)
              );
              const isPrimarySelected = selectedCueId !== null && selectedCueId !== undefined && String(cue.id) === String(selectedCueId);
              const isInBatch = selectedCueIds.some((id) => String(id) === String(cue.id));
              const isSelected = isPrimarySelected || isInBatch;
              const isAtPlayhead = currentTime >= cue.start && currentTime <= cue.end;

              return (
                <div
                  key={cue.id}
                  onMouseDown={(e) => handleMouseDownCue(e, cue, 'move')}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                  }}
                  className={`absolute top-1.5 bottom-1.5 rounded-md border text-[11px] font-medium px-2 flex items-center justify-between overflow-hidden cursor-grab active:cursor-grabbing transition-colors ${
                    isInBatch && !isPrimarySelected
                      ? 'bg-indigo-500 border-indigo-300 text-white font-semibold shadow-md z-10 ring-1 ring-indigo-300'
                      : isSelected || isAtPlayhead
                      ? 'bg-amber-400 border-amber-300 text-neutral-950 font-bold shadow-lg z-10 ring-1 ring-amber-300'
                      : 'bg-indigo-600/35 border-indigo-400/40 text-indigo-100 hover:bg-indigo-600/55'
                  }`}
                  title={`[${formatTimeDisplay(cue.start, true)} - ${formatTimeDisplay(cue.end, true)}] ${cue.text} (Shift/Ctrl+Clic para selección múltiple)`}
                >
                  {/* Left Resize Handle */}
                  <div
                    onMouseDown={(e) => handleMouseDownCue(e, cue, 'resize-left')}
                    className="absolute left-0 top-0 bottom-0 w-1.5 bg-white/25 hover:bg-white cursor-ew-resize rounded-l z-20"
                    title="Arrastra para ajustar inicio"
                  />

                  <div className="flex items-center gap-1 truncate pointer-events-none px-1 min-w-0">
                    <span className="font-mono text-[9px] opacity-75 shrink-0">#{idx + 1}</span>
                    <span className="truncate">{cue.text}</span>
                  </div>

                  {/* Inline Delete button on selected block (when wide enough) */}
                  {isSelected && onDeleteCue && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteCue(cue.id);
                      }}
                      className="relative z-20 ml-1 mr-1 p-0.5 rounded bg-neutral-950/20 hover:bg-red-600 text-neutral-950 hover:text-white transition-colors cursor-pointer shrink-0"
                      title={`Eliminar bloque #${idx + 1} (Supr)`}
                      aria-label={`Eliminar bloque ${idx + 1}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}

                  {/* Right Resize Handle */}
                  <div
                    onMouseDown={(e) => handleMouseDownCue(e, cue, 'resize-right')}
                    className="absolute right-0 top-0 bottom-0 w-1.5 bg-white/25 hover:bg-white cursor-ew-resize rounded-r z-20"
                    title="Arrastra para ajustar fin"
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
            <div className="bg-red-500 text-white font-mono text-[9px] px-1 py-0.5 rounded-b shadow-md font-bold tracking-tight">
              <span>{formatTimeDisplay(currentTime, true)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Scrubber & Status Bar (34px) */}
      <div className="h-8 px-3 border-t border-neutral-200 dark:border-neutral-800/90 bg-neutral-50 dark:bg-[#0e1017] flex items-center gap-3 shrink-0">
        <span className="text-[11px] font-medium text-neutral-500 shrink-0 flex items-center gap-1.5">
          <MoveHorizontal className="w-3.5 h-3.5 text-indigo-500" />
          <span className="hidden sm:inline">Navegador:</span>
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
          className="w-full h-1 bg-neutral-200 dark:bg-neutral-800 rounded appearance-none cursor-pointer accent-indigo-500"
          title="Desliza para desplazarte por la pista"
        />

        <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono text-neutral-500">
          <span className="font-semibold text-neutral-900 dark:text-neutral-200">
            {formatTimeDisplay(currentTime, true)}
          </span>
          <span>/</span>
          <span>{formatTimeDisplay(duration, false)}</span>
        </div>
      </div>
    </div>
  );
};
