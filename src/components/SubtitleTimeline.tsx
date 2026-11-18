import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
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
  Play,
  Pause,
  Scissors,
  CopyPlus,
  Magnet,
  LocateFixed,
} from 'lucide-react';
import { formatTimeDisplay } from '../utils/subtitleFormats';

interface SubtitleTimelineProps {
  subtitles: SubtitleCue[];
  duration: number;
  currentTime: number;
  isPlaying?: boolean;
  selectedCueId?: string | number | null;
  selectedCueIds?: Array<string | number>;
  onPlayPauseToggle?: () => void;
  onSeek: (time: number) => void;
  onAddCueAtTime: (time: number) => void;
  onSelectCue: (
    cueId: string | number,
    modifiers?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }
  ) => void;
  onUpdateCue: (cue: SubtitleCue) => void;
  onDeleteCue?: (cueId: string | number) => void;
  onBatchDeleteCues?: (cueIds: Array<string | number>) => void;
  onSplitCue?: (index: number) => void;
  onDuplicateCue?: (cue: SubtitleCue) => void;
  onPause?: () => void;
}

const ZOOM_STEPS = [1, 1.5, 2, 3, 4, 6, 8, 12, 16];

export const SubtitleTimeline: React.FC<SubtitleTimelineProps> = ({
  subtitles,
  duration,
  currentTime,
  isPlaying = false,
  selectedCueId,
  selectedCueIds = [],
  onPlayPauseToggle,
  onSeek,
  onAddCueAtTime,
  onSelectCue,
  onUpdateCue,
  onDeleteCue,
  onBatchDeleteCues,
  onSplitCue,
  onDuplicateCue,
  onPause,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);
  // IMPORTANT: Auto-follow defaults to false and ONLY activates during playback (never on cue click/selection)
  const [followPlayhead, setFollowPlayhead] = useState<boolean>(false);

  // Viewport scroll tracking for bottom minimap bracket
  const [viewportRange, setViewportRange] = useState<{ startPct: number; widthPct: number }>({
    startPct: 0,
    widthPct: 100,
  });

  // Hover & scrubbing states
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const [isScrubbingPlayhead, setIsScrubbingPlayhead] = useState<boolean>(false);
  const [snapGuideTime, setSnapGuideTime] = useState<number | null>(null);

  // Dragging / Resizing cue state
  const [draggingCueId, setDraggingCueId] = useState<string | number | null>(null);
  const [dragMode, setDragMode] = useState<'move' | 'resize-left' | 'resize-right' | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [initialCueTimes, setInitialCueTimes] = useState<{ start: number; end: number } | null>(null);
  const [liveDragCue, setLiveDragCue] = useState<{ start: number; end: number } | null>(null);

  const safeDuration = duration > 0 ? duration : 60;

  const selectedCueIndex = useMemo(
    () =>
      selectedCueId !== null && selectedCueId !== undefined
        ? subtitles.findIndex((c) => String(c.id) === String(selectedCueId))
        : -1,
    [subtitles, selectedCueId]
  );
  const selectedCue = selectedCueIndex >= 0 ? subtitles[selectedCueIndex] : null;
  const activeMultiCount = selectedCueIds.length;

  // Waveform bars (more detailed when track is wide)
  const waveformBars = useMemo(() => {
    const barCount = Math.min(360, Math.max(180, Math.round(180 * Math.min(zoomLevel, 2))));
    const bars: number[] = [];
    for (let i = 0; i < barCount; i++) {
      const timeAtBar = (i / barCount) * safeDuration;
      const hasSpeech = subtitles.some(
        (c) => timeAtBar >= c.start - 0.15 && timeAtBar <= c.end + 0.15
      );
      if (hasSpeech) {
        const amp = 42 + Math.sin(i * 1.7) * 24 + Math.cos(i * 3.1) * 18;
        bars.push(Math.max(24, Math.min(95, amp)));
      } else {
        bars.push(10 + (i % 5) * 2);
      }
    }
    return bars;
  }, [subtitles, safeDuration, zoomLevel]);

  // Dynamic ruler ticks scaled to zoomLevel
  const rulerTicks = useMemo(() => {
    const tickCount = zoomLevel >= 8 ? 32 : zoomLevel >= 4 ? 24 : zoomLevel >= 2 ? 16 : 10;
    return Array.from({ length: tickCount + 1 }, (_, i) => (i / tickCount) * safeDuration);
  }, [zoomLevel, safeDuration]);

  const updateViewportMetrics = useCallback(() => {
    const scroller = scrollContainerRef.current;
    if (!scroller) return;
    const totalW = scroller.scrollWidth || 1;
    const visibleW = scroller.clientWidth || 1;
    const startPct = (scroller.scrollLeft / totalW) * 100;
    const widthPct = Math.min(100, (visibleW / totalW) * 100);
    setViewportRange({ startPct, widthPct });
  }, []);

  useEffect(() => {
    updateViewportMetrics();
    window.addEventListener('resize', updateViewportMetrics);
    return () => window.removeEventListener('resize', updateViewportMetrics);
  }, [updateViewportMetrics, zoomLevel]);

  // Anchored zoom: keeps the timestamp under `anchorClientX` (or viewport center) locked so timeline NEVER jumps unexpectedly
  const applyAnchoredZoom = useCallback(
    (nextZoomRaw: number, anchorClientX?: number) => {
      const nextZoom = Math.max(1, Math.min(16, Math.round(nextZoomRaw * 100) / 100));
      const scroller = scrollContainerRef.current;
      if (!scroller) {
        setZoomLevel(nextZoom);
        return;
      }

      const rect = scroller.getBoundingClientRect();
      const offsetInViewport =
        anchorClientX !== undefined
          ? Math.max(0, Math.min(rect.width, anchorClientX - rect.left))
          : rect.width / 2;

      const prevTotalWidth = scroller.scrollWidth || rect.width;
      const anchorRatio = (scroller.scrollLeft + offsetInViewport) / prevTotalWidth;

      setZoomLevel(nextZoom);

      requestAnimationFrame(() => {
        if (!scrollContainerRef.current) return;
        const newTotalWidth = scrollContainerRef.current.clientWidth * nextZoom;
        const targetScrollLeft = Math.max(0, anchorRatio * newTotalWidth - offsetInViewport);
        scrollContainerRef.current.scrollLeft = targetScrollLeft;
        updateViewportMetrics();
      });
    },
    [updateViewportMetrics]
  );

  const handleStepZoom = (direction: 'in' | 'out') => {
    if (direction === 'in') {
      const next = ZOOM_STEPS.find((z) => z > zoomLevel + 0.01) ?? 16;
      applyAnchoredZoom(next);
    } else {
      const prev = [...ZOOM_STEPS].reverse().find((z) => z < zoomLevel - 0.01) ?? 1;
      applyAnchoredZoom(prev);
    }
  };

  // Smooth edge-only follow ONLY during active playback when user toggled "Seguir" ON (never on cue click/select/drag!)
  useEffect(() => {
    if (
      !followPlayhead ||
      !isPlaying ||
      draggingCueId ||
      isScrubbingPlayhead ||
      zoomLevel <= 1 ||
      !scrollContainerRef.current ||
      !trackRef.current
    ) {
      return;
    }

    const scroller = scrollContainerRef.current;
    const containerW = scroller.clientWidth;
    const trackW = trackRef.current.clientWidth;
    const playheadX = (currentTime / safeDuration) * trackW;

    const visibleLeft = scroller.scrollLeft;
    const visibleRight = visibleLeft + containerW;

    // Only advance scroll smoothly if playhead exits the visible window; never yank on selection
    if (playheadX > visibleRight - 40) {
      scroller.scrollLeft = Math.max(0, playheadX - containerW * 0.2);
      updateViewportMetrics();
    } else if (playheadX < visibleLeft + 20) {
      scroller.scrollLeft = Math.max(0, playheadX - containerW * 0.2);
      updateViewportMetrics();
    }
  }, [
    followPlayhead,
    isPlaying,
    draggingCueId,
    isScrubbingPlayhead,
    currentTime,
    safeDuration,
    zoomLevel,
    updateViewportMetrics,
  ]);

  // Ctrl/Cmd + Wheel -> anchored zoom; normal vertical Wheel when zoomed -> smooth horizontal pan
  const handleWheelOnTimeline = (e: React.WheelEvent<HTMLDivElement>) => {
    const scroller = scrollContainerRef.current;
    if (!scroller) return;

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.25 : 0.8;
      applyAnchoredZoom(zoomLevel * factor, e.clientX);
      return;
    }

    if (zoomLevel > 1 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      scroller.scrollLeft += e.deltaY;
      updateViewportMetrics();
    }
  };

  const clientXToTime = useCallback(
    (clientX: number): { time: number; pct: number } | null => {
      if (!trackRef.current || safeDuration <= 0) return null;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return { time: pct * safeDuration, pct: pct * 100 };
    },
    [safeDuration]
  );

  // Ruler Scrubbing (click + drag to move playhead smoothly)
  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const mapped = clientXToTime(e.clientX);
    if (!mapped) return;
    setIsScrubbingPlayhead(true);
    onSeek(mapped.time);
    onPause?.();
  };

  useEffect(() => {
    if (!isScrubbingPlayhead) return;

    const handleMove = (e: MouseEvent) => {
      const mapped = clientXToTime(e.clientX);
      if (mapped) onSeek(mapped.time);
    };
    const handleUp = () => setIsScrubbingPlayhead(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isScrubbingPlayhead, clientXToTime, onSeek]);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const mapped = clientXToTime(e.clientX);
    if (!mapped) return;
    onSeek(mapped.time);
    onPause?.();
  };

  const handleTrackDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Double-click empty track area inserts a new cue directly at clicked time
    const mapped = clientXToTime(e.clientX);
    if (!mapped) return;
    onAddCueAtTime(Math.round(mapped.time * 100) / 100);
  };

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
    setLiveDragCue({ start: cue.start, end: cue.end });
  };

  // Dragging & Resizing with optional magnetic snap to adjacent cue edges & playhead
  useEffect(() => {
    if (!draggingCueId || !dragMode || !initialCueTimes || !trackRef.current) return;

    const snapPoints: number[] = [currentTime];
    for (const c of subtitles) {
      if (String(c.id) !== String(draggingCueId)) {
        snapPoints.push(c.start, c.end);
      }
    }

    const findSnap = (candidate: number, thresholdSec: number): number | null => {
      let best: number | null = null;
      let bestDist = thresholdSec;
      for (const p of snapPoints) {
        const d = Math.abs(candidate - p);
        if (d <= bestDist) {
          bestDist = d;
          best = p;
        }
      }
      return best;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const trackWidth = trackRef.current?.clientWidth || 1;
      const deltaX = e.clientX - dragStartX;
      const deltaTime = (deltaX / trackWidth) * safeDuration;
      const snapThresholdSec = Math.max(0.06, (8 / trackWidth) * safeDuration);
      const useSnap = snapEnabled && !e.altKey;

      const targetCue = subtitles.find((c) => String(c.id) === String(draggingCueId));
      if (!targetCue) return;

      let newStart = initialCueTimes.start;
      let newEnd = initialCueTimes.end;
      const cueLength = initialCueTimes.end - initialCueTimes.start;
      let activeGuide: number | null = null;

      if (dragMode === 'move') {
        newStart = Math.max(0, Math.min(safeDuration - cueLength, initialCueTimes.start + deltaTime));
        newEnd = newStart + cueLength;

        if (useSnap) {
          const snapStart = findSnap(newStart, snapThresholdSec);
          const snapEnd = findSnap(newEnd, snapThresholdSec);
          if (snapStart !== null) {
            newStart = snapStart;
            newEnd = snapStart + cueLength;
            activeGuide = snapStart;
          } else if (snapEnd !== null) {
            newEnd = snapEnd;
            newStart = Math.max(0, snapEnd - cueLength);
            activeGuide = snapEnd;
          }
        }
      } else if (dragMode === 'resize-left') {
        newStart = Math.max(0, Math.min(initialCueTimes.end - 0.25, initialCueTimes.start + deltaTime));
        if (useSnap) {
          const snapStart = findSnap(newStart, snapThresholdSec);
          if (snapStart !== null && snapStart <= initialCueTimes.end - 0.25) {
            newStart = snapStart;
            activeGuide = snapStart;
          }
        }
      } else if (dragMode === 'resize-right') {
        newEnd = Math.max(newStart + 0.25, Math.min(safeDuration, initialCueTimes.end + deltaTime));
        if (useSnap) {
          const snapEnd = findSnap(newEnd, snapThresholdSec);
          if (snapEnd !== null && snapEnd >= newStart + 0.25) {
            newEnd = snapEnd;
            activeGuide = snapEnd;
          }
        }
      }

      const roundedStart = Math.round(newStart * 100) / 100;
      const roundedEnd = Math.round(newEnd * 100) / 100;

      setSnapGuideTime(activeGuide);
      setLiveDragCue({ start: roundedStart, end: roundedEnd });

      onUpdateCue({
        ...targetCue,
        start: roundedStart,
        end: roundedEnd,
      });
    };

    const handleMouseUp = () => {
      setDraggingCueId(null);
      setDragMode(null);
      setInitialCueTimes(null);
      setLiveDragCue(null);
      setSnapGuideTime(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingCueId, dragMode, dragStartX, initialCueTimes, safeDuration, subtitles, snapEnabled, currentTime, onUpdateCue]);

  const handleDeleteSelection = () => {
    if (activeMultiCount > 1 && onBatchDeleteCues) {
      onBatchDeleteCues(selectedCueIds);
    } else if (selectedCue && onDeleteCue) {
      onDeleteCue(selectedCue.id);
    }
  };

  const playheadPercent = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));

  return (
    <div className="bg-white dark:bg-[#0b0c10] h-full min-h-0 flex flex-col select-none">
      {/* Top Timeline Studio Toolbar (38px) */}
      <div className="h-9.5 px-3 border-b border-neutral-200 dark:border-neutral-800/90 flex items-center justify-between gap-2 text-xs shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 shrink-0">
          {/* Play / Pause directly on Timeline so user doesn't have to move mouse up */}
          {onPlayPauseToggle && (
            <button
              type="button"
              onClick={onPlayPauseToggle}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isPlaying
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/35 hover:bg-amber-500/25'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
              title={isPlaying ? 'Pausar reproducción (Espacio)' : 'Reproducir desde aquí (Espacio)'}
            >
              {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
              <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
            </button>
          )}

          <div className="flex items-center bg-neutral-100 dark:bg-neutral-900 p-0.5 rounded border border-neutral-200 dark:border-neutral-800 shrink-0">
            <button
              type="button"
              onClick={handlePrevCue}
              className="p-1 text-neutral-600 dark:text-neutral-300 hover:text-indigo-500 rounded transition-colors cursor-pointer"
              title="Subtítulo anterior"
            >
              <SkipBack className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={handleNextCue}
              className="p-1 text-neutral-600 dark:text-neutral-300 hover:text-indigo-500 rounded transition-colors cursor-pointer"
              title="Subtítulo siguiente"
            >
              <SkipForward className="w-3 h-3" />
            </button>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 font-medium shrink-0">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span className="font-mono tabular-nums text-[11px]">
              {subtitles.length} bloques
              {activeMultiCount > 1 ? ` · ${activeMultiCount} sel.` : selectedCue ? ` · #${selectedCueIndex + 1}` : ''}
            </span>
          </div>

          {hoverTime !== null && !draggingCueId && (
            <span className="hidden xl:inline font-mono tabular-nums text-[11px] text-neutral-500 dark:text-neutral-400">
              · Cursor {formatTimeDisplay(hoverTime, true)}
            </span>
          )}
        </div>

        {/* Right Controls: Quick Edit + Snap + Follow + Anchored Zoom + Add */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Edit Controls for selected cue(s) */}
          {selectedCue && onSplitCue && activeMultiCount <= 1 && (
            <button
              type="button"
              onClick={() => onSplitCue(selectedCueIndex)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 hover:border-indigo-500/40 hover:text-indigo-500 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title={`Dividir bloque #${selectedCueIndex + 1} en dos`}
            >
              <Scissors className="w-3 h-3" />
              <span className="hidden sm:inline">Dividir</span>
            </button>
          )}

          {selectedCue && onDuplicateCue && activeMultiCount <= 1 && (
            <button
              type="button"
              onClick={() => onDuplicateCue(selectedCue)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 hover:border-indigo-500/40 hover:text-indigo-500 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title={`Duplicar bloque #${selectedCueIndex + 1}`}
            >
              <CopyPlus className="w-3 h-3" />
              <span className="hidden sm:inline">Duplicar</span>
            </button>
          )}

          {(selectedCue || activeMultiCount > 1) && (onDeleteCue || onBatchDeleteCues) && (
            <button
              type="button"
              onClick={handleDeleteSelection}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25 hover:bg-red-600 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title={
                activeMultiCount > 1
                  ? `Eliminar ${activeMultiCount} bloques seleccionados (Supr)`
                  : `Eliminar bloque #${selectedCueIndex + 1} (Supr)`
              }
            >
              <Trash2 className="w-3 h-3" />
              <span>{activeMultiCount > 1 ? `Eliminar (${activeMultiCount})` : `#${selectedCueIndex + 1}`}</span>
            </button>
          )}

          {/* Snap Toggle */}
          <button
            type="button"
            onClick={() => setSnapEnabled((s) => !s)}
            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              snapEnabled
                ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/35'
                : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500 border-neutral-200 dark:border-neutral-800'
            }`}
            title="Imán magnético: alinea bordes a subtítulos vecinos o cabezal (mantén Alt para ignorar)"
          >
            <Magnet className="w-3 h-3" />
            <span className="hidden md:inline">Imán</span>
          </button>

          {/* Auto-Follow Playback Toggle */}
          <button
            type="button"
            onClick={() => setFollowPlayhead((f) => !f)}
            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              followPlayhead
                ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/35'
                : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500 border-neutral-200 dark:border-neutral-800'
            }`}
            title="Seguir cabezal automáticamente SOLO al reproducir (nunca al seleccionar un cuadro)"
          >
            <LocateFixed className="w-3 h-3" />
            <span className="hidden md:inline">Seguir</span>
          </button>

          {/* Anchored Zoom Controls */}
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-900 px-1 py-0.5 rounded border border-neutral-200 dark:border-neutral-800 shrink-0">
            <button
              type="button"
              onClick={() => handleStepZoom('out')}
              disabled={zoomLevel <= 1}
              className="p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 disabled:opacity-30 cursor-pointer"
              title="Alejar Zoom (Ctrl + Rueda)"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono tabular-nums px-1 font-semibold text-neutral-600 dark:text-neutral-300 min-w-[2.2rem] text-center">
              {Number.isInteger(zoomLevel) ? `${zoomLevel}x` : `${zoomLevel.toFixed(1)}x`}
            </span>
            <button
              type="button"
              onClick={() => handleStepZoom('in')}
              disabled={zoomLevel >= 16}
              className="p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 disabled:opacity-30 cursor-pointer"
              title="Acercar Zoom (Ctrl + Rueda)"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => onAddCueAtTime(currentTime)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Añadir subtítulo en el tiempo actual (o doble clic en la pista)"
          >
            <Plus className="w-3 h-3" />
            <span className="font-mono tabular-nums">{formatTimeDisplay(currentTime, false)}</span>
          </button>
        </div>
      </div>

      {/* Main Multi-Track Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={updateViewportMetrics}
        onWheel={handleWheelOnTimeline}
        className="flex-1 min-h-[135px] w-full overflow-x-auto overflow-y-hidden bg-[#06070a] relative custom-scrollbar"
      >
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          onDoubleClick={handleTrackDoubleClick}
          onMouseMove={(e) => {
            const mapped = clientXToTime(e.clientX);
            if (mapped) {
              setHoverTime(mapped.time);
              setHoverPct(mapped.pct);
            }
          }}
          onMouseLeave={() => {
            setHoverTime(null);
            setHoverPct(null);
          }}
          style={{ width: `${zoomLevel * 100}%` }}
          className="relative h-full flex flex-col cursor-crosshair select-none"
        >
          {/* TRACK 0: Interactive Time Ruler (Click & Drag Scrubbing) */}
          <div
            onMouseDown={handleRulerMouseDown}
            onClick={(e) => e.stopPropagation()}
            className="h-5 bg-[#0e1017] border-b border-neutral-800/90 relative select-none shrink-0 cursor-ew-resize"
            title="Haz clic o arrastra sobre la regla para mover el cabezal"
          >
            {rulerTicks.map((timeSec, i) => {
              const pct = (timeSec / safeDuration) * 100;
              const isEdgeEnd = i === rulerTicks.length - 1;
              return (
                <div
                  key={i}
                  style={{ left: `${pct}%` }}
                  className={`absolute top-0 bottom-0 flex flex-col ${
                    isEdgeEnd ? '-translate-x-full items-end pr-1' : i === 0 ? 'items-start pl-1' : '-translate-x-1/2 items-center'
                  }`}
                >
                  <div className="h-1.5 w-px bg-neutral-600" />
                  <span className="text-[9px] font-mono tabular-nums text-neutral-400 leading-none mt-0.5">
                    {formatTimeDisplay(timeSec, false)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* TRACK 1: Audio Waveform Reference */}
          <div className="h-10 px-1 flex items-center justify-between gap-[1px] bg-[#08090d] border-b border-neutral-800/60 pointer-events-none opacity-85 shrink-0">
            {waveformBars.map((heightPct, idx) => (
              <div
                key={idx}
                style={{ height: `${heightPct}%` }}
                className="flex-1 bg-indigo-500/45 rounded-full"
              />
            ))}
          </div>

          {/* TRACK 2: Draggable & Resizable Subtitle Cue Blocks */}
          <div
            className="relative flex-1 min-h-[60px] p-1.5"
            title="Doble clic aquí para insertar un nuevo bloque en esa posición"
          >
            {subtitles.map((cue, idx) => {
              const leftPct = Math.min(100, Math.max(0, (cue.start / safeDuration) * 100));
              const widthPct = Math.min(
                100 - leftPct,
                Math.max(0.55, ((cue.end - cue.start) / safeDuration) * 100)
              );
              const isPrimarySelected =
                selectedCueId !== null && selectedCueId !== undefined && String(cue.id) === String(selectedCueId);
              const isInBatch = selectedCueIds.some((id) => String(id) === String(cue.id));
              const isSelected = isPrimarySelected || isInBatch;
              const isAtPlayhead = currentTime >= cue.start && currentTime <= cue.end;
              const isBeingDragged = draggingCueId !== null && String(draggingCueId) === String(cue.id);

              return (
                <div
                  key={cue.id}
                  onMouseDown={(e) => handleMouseDownCue(e, cue, 'move')}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                  }}
                  className={`absolute top-1.5 bottom-1.5 rounded-md border text-[11px] font-medium px-2 flex items-center justify-between overflow-visible cursor-grab active:cursor-grabbing ${
                    isBeingDragged
                      ? 'bg-amber-300 border-white text-neutral-950 font-bold shadow-2xl z-20 ring-2 ring-amber-400'
                      : isInBatch && !isPrimarySelected
                      ? 'bg-indigo-500 border-indigo-300 text-white font-semibold shadow-md z-10 ring-1 ring-indigo-300'
                      : isSelected || isAtPlayhead
                      ? 'bg-amber-400 border-amber-300 text-neutral-950 font-bold shadow-lg z-10 ring-1 ring-amber-300'
                      : 'bg-indigo-600/35 border-indigo-400/40 text-indigo-100 hover:bg-indigo-600/55'
                  }`}
                  title={`#${idx + 1} [${formatTimeDisplay(cue.start, true)} → ${formatTimeDisplay(cue.end, true)}] ${cue.text} (Shift/Ctrl+Clic para multiselección)`}
                >
                  {/* Live Floating Timing HUD while dragging/resizing */}
                  {isBeingDragged && liveDragCue && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-neutral-950 text-amber-300 border border-amber-400/50 font-mono tabular-nums text-[10px] whitespace-nowrap shadow-xl pointer-events-none z-40">
                      {formatTimeDisplay(liveDragCue.start, true)} → {formatTimeDisplay(liveDragCue.end, true)} ({(liveDragCue.end - liveDragCue.start).toFixed(2)}s)
                    </div>
                  )}

                  {/* Left Resize Handle */}
                  <div
                    onMouseDown={(e) => handleMouseDownCue(e, cue, 'resize-left')}
                    className="absolute left-0 top-0 bottom-0 w-2 bg-white/25 hover:bg-white cursor-ew-resize rounded-l z-20"
                    title="Arrastra para ajustar inicio"
                  />

                  <div className="flex items-center gap-1 truncate pointer-events-none px-1 min-w-0">
                    <span className="font-mono text-[9px] opacity-75 shrink-0">#{idx + 1}</span>
                    <span className="truncate">{cue.text}</span>
                  </div>

                  {/* Inline Delete button on selected block */}
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
                    className="absolute right-0 top-0 bottom-0 w-2 bg-white/25 hover:bg-white cursor-ew-resize rounded-r z-20"
                    title="Arrastra para ajustar fin"
                  />
                </div>
              );
            })}
          </div>

          {/* Hover Hairline Guide */}
          {hoverPct !== null && !draggingCueId && !isScrubbingPlayhead && (
            <div
              style={{ left: `${hoverPct}%` }}
              className="absolute top-5 bottom-0 w-px bg-white/20 pointer-events-none z-10"
            />
          )}

          {/* Magnetic Snap Guide Line */}
          {snapGuideTime !== null && (
            <div
              style={{ left: `${(snapGuideTime / safeDuration) * 100}%` }}
              className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 pointer-events-none z-30 shadow-[0_0_8px_rgba(34,211,238,0.9)]"
            />
          )}

          {/* PLAYHEAD Line & Draggable Time Handle */}
          <div
            style={{ left: `${playheadPercent}%` }}
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-30 shadow-md flex flex-col items-center"
          >
            <div
              onMouseDown={handleRulerMouseDown}
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto cursor-ew-resize bg-red-500 hover:bg-red-400 text-white font-mono tabular-nums text-[9px] px-1.5 py-0.5 rounded-b shadow-md font-bold tracking-tight whitespace-nowrap"
              title="Arrastra para mover el cabezal de reproducción"
            >
              {formatTimeDisplay(currentTime, true)}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Overview Minimap Scrubber & Status Bar (34px) */}
      <div className="h-8 px-3 border-t border-neutral-200 dark:border-neutral-800/90 bg-neutral-50 dark:bg-[#0e1017] flex items-center gap-3 shrink-0">
        <span className="text-[11px] font-medium text-neutral-500 shrink-0 flex items-center gap-1.5 whitespace-nowrap">
          <MoveHorizontal className="w-3.5 h-3.5 text-indigo-500" />
          <span className="hidden sm:inline">Navegador:</span>
        </span>

        {/* Interactive Overview Minimap with Cue Markers + Viewport Window */}
        <div className="relative flex-1 h-4 flex items-center">
          {/* Background track showing cue blocks & zoomed viewport highlight */}
          <div className="absolute inset-x-0 h-2.5 rounded bg-neutral-200 dark:bg-neutral-900 border border-neutral-300/70 dark:border-neutral-800 overflow-hidden pointer-events-none">
            {subtitles.map((cue) => {
              const left = Math.max(0, Math.min(100, (cue.start / safeDuration) * 100));
              const width = Math.max(0.3, Math.min(100 - left, ((cue.end - cue.start) / safeDuration) * 100));
              return (
                <div
                  key={cue.id}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  className="absolute top-0.5 bottom-0.5 bg-indigo-500/45 rounded-[1px]"
                />
              );
            })}
            {zoomLevel > 1 && (
              <div
                style={{ left: `${viewportRange.startPct}%`, width: `${viewportRange.widthPct}%` }}
                className="absolute top-0 bottom-0 border border-amber-400/70 bg-amber-400/10 rounded-[2px]"
              />
            )}
          </div>

          <input
            type="range"
            min={0}
            max={safeDuration}
            step={0.05}
            value={Math.min(safeDuration, currentTime)}
            onChange={(e) => {
              const targetTime = parseFloat(e.target.value);
              onSeek(targetTime);
              onPause?.();
            }}
            className="relative z-10 w-full h-3 bg-transparent appearance-none cursor-pointer accent-red-500"
            title="Desliza para desplazarte rápidamente por todo el proyecto"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono tabular-nums text-neutral-500 whitespace-nowrap">
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
