import React, { useState, useMemo } from 'react';
import {
  Subtitles,
  Palette,
  Radio,
  Search,
  Plus,
  Trash2,
  Play,
  Scissors,
  Layers,
  Clock,
  ArrowRight,
  UploadCloud,
  Type,
  Maximize2,
  Sliders,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Check,
  Cpu,
  Wand2,
  AlertCircle,
  Film,
  Music,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Edit3,
  User,
  Zap,
  Sparkles,
  Key,
  AudioLines,
  Loader2,
  Undo2,
  CheckSquare,
  Square,
  Activity,
  VolumeX,
} from 'lucide-react';
import {
  SubtitleCue,
  SubtitleStyle,
  STYLE_PRESETS,
  SubtitlePreset,
  BackgroundLoopType,
} from '../types/subtitle';
import { formatTimeDisplay } from '../utils/subtitleFormats';
import { runAutoAlignSubtitles } from '../services/autoAlignService';
import {
  analyzeVideoWithWebAudioVad,
  applyVadSuggestionsToCues,
  computeSubtitleOffsetSuggestions,
  SubtitleOffsetSuggestion,
  VadAnalysisResult,
} from '../utils/vadAnalyzer';

export type StudioTab = 'subtitles' | 'style' | 'loops' | 'tools';

interface StudioInspectorProps {
  activeTab: StudioTab;
  onChangeTab: (tab: StudioTab) => void;
  subtitles: SubtitleCue[];
  selectedCueId?: string | number | null;
  selectedCueIds?: Array<string | number>;
  onSelectCue?: (
    id: string | number,
    modifiers?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }
  ) => void;
  onSetSelectedCueIds?: (ids: Array<string | number>) => void;
  currentTime: number;
  duration: number;
  style: SubtitleStyle;
  onChangeStyle: (newStyle: SubtitleStyle) => void;
  onUpdateCue: (updatedCue: SubtitleCue) => void;
  onBatchUpdateCues?: (
    targetIds: Array<string | number>,
    updater: (cue: SubtitleCue) => SubtitleCue
  ) => void;
  onDeleteCue: (id: string | number) => void;
  onBatchDeleteCues?: (targetIds: Array<string | number>) => void;
  onAddCue: (cue: SubtitleCue, index?: number) => void;
  onMergeWithNext: (index: number) => void;
  onSplitCue: (index: number) => void;
  onSeek: (time: number) => void;
  onPlaySpan: (start: number, end: number) => void;
  onImportSrt: (file: File) => void;
  onOpenGenerate: () => void;
  onOpenExport: () => void;
  onApplyTimeShift: (cues: SubtitleCue[]) => void;
  onRestoreSampleSubtitles?: () => void;
  videoFile?: File | null;
  videoUrl?: string | null;
  language?: string;
}

const FONT_OPTIONS = [
  { label: 'Montserrat (Viral / Moderno)', value: 'Montserrat' },
  { label: 'Bebas Neue (Titulares / Impacto)', value: 'Bebas Neue' },
  { label: 'Outfit (Tendencia / Redes)', value: 'Outfit' },
  { label: 'Inter (Limpio / Cinematográfico)', value: 'Inter' },
  { label: 'Poppins (Elegante / Suave)', value: 'Poppins' },
  { label: 'Rubik (Grueso / Punch)', value: 'Rubik' },
  { label: 'Roboto Mono (Técnico / Código)', value: 'Roboto Mono' },
];

const COLOR_SWATCHES = [
  '#FFFFFF',
  '#FACC15', // Amarillo viral
  '#22D3EE', // Cian
  '#4ADE80', // Verde neón
  '#F472B6', // Rosa
  '#FB923C', // Naranja
  '#A78BFA', // Violeta
  '#000000', // Negro
];

const LOOP_OPTIONS: {
  id: BackgroundLoopType;
  title: string;
  desc: string;
  gradient: string;
  tag: string;
}[] = [
  {
    id: 'aurora-gradient',
    title: 'Aurora Fluid Gradient',
    desc: 'Esferas orgánicas en movimiento fluido continuo de color.',
    gradient: 'from-indigo-600 via-purple-600 to-cyan-500',
    tag: 'Popular',
  },
  {
    id: 'synthwave-grid',
    title: 'Synthwave 3D Grid',
    desc: 'Rejilla retrofuturista en perspectiva y sol neón en el horizonte.',
    gradient: 'from-pink-600 via-purple-800 to-amber-500',
    tag: 'Retro 80s',
  },
  {
    id: 'cosmic-nebula',
    title: 'Cosmic Nebula & Stars',
    desc: 'Espacio profundo con nebulosas y estrellas titilantes en movimiento.',
    gradient: 'from-blue-900 via-purple-950 to-neutral-950',
    tag: 'Inmersivo',
  },
  {
    id: 'sound-spectrum',
    title: 'Sound Spectrum Visualizer',
    desc: 'Barras rítmicas de ecualizador y pulsos circulares cibernéticos.',
    gradient: 'from-cyan-600 via-blue-700 to-slate-900',
    tag: 'Podcast / DJ',
  },
  {
    id: 'lofi-ambient',
    title: 'Lo-Fi Midnight Rain',
    desc: 'Lluvia nostálgica, luces bokeh suaves y viñeta cinematográfica.',
    gradient: 'from-slate-800 via-indigo-950 to-neutral-950',
    tag: 'Chill / Relajante',
  },
];

export const StudioInspector: React.FC<StudioInspectorProps> = ({
  activeTab,
  onChangeTab,
  subtitles,
  selectedCueId,
  selectedCueIds = [],
  onSelectCue,
  onSetSelectedCueIds,
  currentTime,
  duration,
  style,
  onChangeStyle,
  onUpdateCue,
  onBatchUpdateCues,
  onDeleteCue,
  onBatchDeleteCues,
  onAddCue,
  onMergeWithNext,
  onSplitCue,
  onSeek,
  onPlaySpan,
  onImportSrt,
  onOpenGenerate,
  onOpenExport,
  onApplyTimeShift,
  onRestoreSampleSubtitles,
  videoFile,
  videoUrl,
  language = 'es',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFullListModal, setShowFullListModal] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [timeShiftOffset, setTimeShiftOffset] = useState<number>(0.5);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [groqKey, setGroqKey] = useState<string>(() => localStorage.getItem('subcraft_groq_api_key') || '');

  // Batch Edit mode & controls state
  const [inspectorSubMode, setInspectorSubMode] = useState<'single' | 'batch'>('single');
  const [batchTimingTarget, setBatchTimingTarget] = useState<'both' | 'start' | 'end' | 'duration'>('both');
  const [batchOffsetInput, setBatchOffsetInput] = useState<string>('0.5');
  const [batchFixedDuration, setBatchFixedDuration] = useState<string>('2.5');
  const [batchRangeStart, setBatchRangeStart] = useState<string>('1');
  const [batchRangeEnd, setBatchRangeEnd] = useState<string>('5');
  const [batchSpeakerInput, setBatchSpeakerInput] = useState<string>('');
  const prevBatchCountRef = React.useRef<number>(selectedCueIds.length);

  React.useEffect(() => {
    if (selectedCueIds.length >= 2 && prevBatchCountRef.current < 2) {
      setInspectorSubMode('batch');
    }
    prevBatchCountRef.current = selectedCueIds.length;
  }, [selectedCueIds.length]);

  // Auto-Align Subtitles state
  const [isAligning, setIsAligning] = useState(false);
  const [alignProgress, setAlignProgress] = useState(0);
  const [alignStage, setAlignStage] = useState('');
  const [alignError, setAlignError] = useState<string | null>(null);
  const [alignReport, setAlignReport] = useState<{
    adjustedCount: number;
    averageShiftSeconds: number;
    speechSegmentsCount: number;
    summary: string;
  } | null>(null);
  const [previousCuesBackup, setPreviousCuesBackup] = useState<SubtitleCue[] | null>(null);

  const handleSaveGroqKey = (val: string) => {
    setGroqKey(val);
    localStorage.setItem('subcraft_groq_api_key', val.trim());
    setSuccessMsg('API Key de Groq guardada correctamente');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleAutoAlign = async () => {
    if (isAligning || subtitles.length === 0) return;

    setIsAligning(true);
    setAlignError(null);
    setAlignReport(null);
    setAlignProgress(8);
    setAlignStage('Iniciando análisis de la onda de audio...');

    try {
      const snapshotBefore = subtitles.map((c) => ({ ...c }));
      const result = await runAutoAlignSubtitles({
        subtitles,
        videoFile,
        videoUrl,
        duration,
        language,
        onProgress: (pct, stage) => {
          setAlignProgress(pct);
          setAlignStage(stage);
        },
      });

      setPreviousCuesBackup(snapshotBefore);
      onApplyTimeShift(result.alignedSubtitles);
      setAlignReport({
        adjustedCount: result.adjustedCount,
        averageShiftSeconds: result.averageShiftSeconds,
        speechSegmentsCount: result.speechSegmentsCount,
        summary: result.summary,
      });
      setSuccessMsg(`Auto-alineación completada (${result.adjustedCount} bloques ajustados)`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setAlignError(err?.message || 'No se pudo completar la auto-alineación con IA.');
    } finally {
      setIsAligning(false);
    }
  };

  const handleUndoAlign = () => {
    if (!previousCuesBackup) return;
    onApplyTimeShift(previousCuesBackup);
    setPreviousCuesBackup(null);
    setAlignReport(null);
    setSuccessMsg('Se restauraron los tiempos originales anteriores al alineado.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Web Audio API VAD (Voice Activity Detection) state & handlers
  const [isAnalyzingVad, setIsAnalyzingVad] = useState(false);
  const [vadProgress, setVadProgress] = useState(0);
  const [vadStage, setVadStage] = useState('');
  const [vadError, setVadError] = useState<string | null>(null);
  const [vadSensitivity, setVadSensitivity] = useState<'balanced' | 'strict' | 'sensitive'>('balanced');
  const [vadResult, setVadResult] = useState<VadAnalysisResult | null>(null);
  const [previousVadBackup, setPreviousVadBackup] = useState<SubtitleCue[] | null>(null);

  React.useEffect(() => {
    setVadResult(null);
    setVadError(null);
  }, [videoFile, videoUrl]);

  const vadComputedSuggestions = useMemo(() => {
    if (!vadResult) {
      return { suggestions: [] as SubtitleOffsetSuggestion[], recommendedGlobalOffsetSeconds: null as number | null };
    }
    return computeSubtitleOffsetSuggestions(
      subtitles,
      vadResult.silenceSegments,
      vadResult.voiceSegments,
      vadResult.duration || duration
    );
  }, [vadResult, subtitles, duration]);

  const handleRunVadAnalysis = async () => {
    if (isAnalyzingVad) return;
    setIsAnalyzingVad(true);
    setVadError(null);
    setVadProgress(8);
    setVadStage('Iniciando análisis VAD en el navegador...');

    try {
      const result = await analyzeVideoWithWebAudioVad({
        videoFile,
        videoUrl,
        subtitles,
        minSilenceDurationSec: 1.0,
        sensitivity: vadSensitivity,
        onProgress: (pct, stage) => {
          setVadProgress(pct);
          setVadStage(stage);
        },
      });
      setVadResult(result);
      setSuccessMsg(
        `VAD completado: ${result.silenceSegments.length} silencios > 1s detectados (${result.suggestions.length} ajustes sugeridos)`
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setVadError(err?.message || 'No se pudo analizar la pista de audio con Web Audio API.');
    } finally {
      setIsAnalyzingVad(false);
    }
  };

  const handleApplySingleVadSuggestion = (sug: SubtitleOffsetSuggestion) => {
    const snapshot = subtitles.map((c) => ({ ...c }));
    const maxDur = vadResult?.duration || duration || 3600;
    const updated = applyVadSuggestionsToCues(subtitles, [sug], maxDur);
    setPreviousVadBackup(snapshot);
    onApplyTimeShift(updated);
    onSelectCue?.(sug.cueId);
    onSeek(sug.suggestedStart);
    setSuccessMsg(`Ajuste aplicado al subtítulo #${sug.cueIndex} (${sug.offsetSeconds >= 0 ? '+' : ''}${sug.offsetSeconds.toFixed(2)}s)`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleApplyAllVadSuggestions = () => {
    if (vadComputedSuggestions.suggestions.length === 0) return;
    const snapshot = subtitles.map((c) => ({ ...c }));
    const maxDur = vadResult?.duration || duration || 3600;
    const updated = applyVadSuggestionsToCues(
      subtitles,
      vadComputedSuggestions.suggestions,
      maxDur
    );
    setPreviousVadBackup(snapshot);
    onApplyTimeShift(updated);
    setSuccessMsg(
      `Se aplicaron ${vadComputedSuggestions.suggestions.length} sugerencias de tiempo basadas en VAD.`
    );
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleApplyGlobalVadOffset = (offsetSeconds: number) => {
    if (!Number.isFinite(offsetSeconds) || subtitles.length === 0) return;
    const snapshot = subtitles.map((c) => ({ ...c }));
    const maxDur = vadResult?.duration || duration || 3600;
    const shifted = subtitles.map((cue) => {
      const start = Math.max(0, Math.min(maxDur - 0.35, Math.round((cue.start + offsetSeconds) * 100) / 100));
      const end = Math.max(start + 0.35, Math.min(maxDur, Math.round((cue.end + offsetSeconds) * 100) / 100));
      return { ...cue, start, end };
    });
    setPreviousVadBackup(snapshot);
    onApplyTimeShift(shifted);
    setSuccessMsg(
      `Desplazamiento global de ${offsetSeconds >= 0 ? '+' : ''}${offsetSeconds.toFixed(2)}s aplicado a todos los subtítulos.`
    );
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleUndoVadOffsets = () => {
    if (!previousVadBackup) return;
    onApplyTimeShift(previousVadBackup);
    setPreviousVadBackup(null);
    setSuccessMsg('Se restauraron los tiempos anteriores al ajuste VAD.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Active playing cue at currentTime
  const activePlayingCue = subtitles.find(
    (c) => currentTime >= c.start - 0.05 && currentTime <= c.end + 0.1
  );

  const selectedCue = useMemo(() => {
    if (subtitles.length === 0) return null;

    // 1. First priority: Respect explicit selection if user clicked a cue block or inspector cue
    if (selectedCueId !== null && selectedCueId !== undefined) {
      const explicit = subtitles.find((c) => String(c.id) === String(selectedCueId));
      if (explicit) {
        return explicit;
      }
    }

    // 2. Follow active playhead position if playing
    if (activePlayingCue) return activePlayingCue;

    // 3. Find the closest cue to currentTime
    let closest = subtitles[0];
    let minDiff = Infinity;
    for (const cue of subtitles) {
      const diff = Math.min(Math.abs(currentTime - cue.start), Math.abs(currentTime - cue.end));
      if (diff < minDiff) {
        minDiff = diff;
        closest = cue;
      }
    }
    return closest;
  }, [subtitles, selectedCueId, activePlayingCue, currentTime]);

  const selectedIndex = useMemo(() => {
    if (!selectedCue) return -1;
    const idx = subtitles.indexOf(selectedCue);
    if (idx !== -1) return idx;
    return subtitles.findIndex((c) => String(c.id) === String(selectedCue.id));
  }, [subtitles, selectedCue]);

  const handleTimeStep = (cue: SubtitleCue, field: 'start' | 'end', delta: number) => {
    const nextVal = Math.max(0, Math.round((cue[field] + delta) * 100) / 100);
    if (field === 'start' && nextVal >= cue.end) return;
    if (field === 'end' && nextVal <= cue.start) return;
    onUpdateCue({ ...cue, [field]: nextVal });
  };

  const handleSelectPreset = (presetKey: SubtitlePreset) => {
    const p = STYLE_PRESETS[presetKey];
    if (p) {
      onChangeStyle({
        ...style,
        ...p,
        preset: presetKey,
      });
    }
  };

  const updateStyle = <K extends keyof SubtitleStyle>(key: K, value: SubtitleStyle[K]) => {
    onChangeStyle({
      ...style,
      preset: 'custom',
      [key]: value,
    });
  };

  const handleApplyShift = (direction: 'forward' | 'backward') => {
    const shift = direction === 'forward' ? timeShiftOffset : -timeShiftOffset;
    const shifted = subtitles.map((cue) => ({
      ...cue,
      start: Math.max(0, Math.round((cue.start + shift) * 100) / 100),
      end: Math.max(0.1, Math.round((cue.end + shift) * 100) / 100),
    }));
    onApplyTimeShift(shifted);
    setSuccessMsg(`Tiempos ajustados en ${shift > 0 ? '+' : ''}${shift}s`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Effective batch selection: uses explicit selectedCueIds, or falls back to current selectedCue
  const effectiveBatchIds = useMemo(() => {
    if (selectedCueIds.length > 0) return selectedCueIds;
    if (selectedCue) return [selectedCue.id];
    return [];
  }, [selectedCueIds, selectedCue]);

  const effectiveBatchIdSet = useMemo(
    () => new Set(effectiveBatchIds.map((id) => String(id))),
    [effectiveBatchIds]
  );

  const batchSelectedCues = useMemo(
    () => subtitles.filter((cue) => effectiveBatchIdSet.has(String(cue.id))),
    [subtitles, effectiveBatchIdSet]
  );

  // Representative merged style for the first selected cue in the batch
  const batchSampleStyle = useMemo<SubtitleStyle>(() => {
    const first = batchSelectedCues[0];
    if (!first?.styleOverride) return style;
    return { ...style, ...first.styleOverride };
  }, [batchSelectedCues, style]);

  const showBatchToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const toggleBatchCueId = (id: string | number) => {
    if (!onSetSelectedCueIds) return;
    const strId = String(id);
    const exists = effectiveBatchIds.some((x) => String(x) === strId);
    if (exists) {
      const next = effectiveBatchIds.filter((x) => String(x) !== strId);
      onSetSelectedCueIds(next);
    } else {
      onSetSelectedCueIds([...effectiveBatchIds, id]);
    }
  };

  const handleApplyBatchRange = () => {
    if (!onSetSelectedCueIds || subtitles.length === 0) return;
    const from = Math.max(1, Math.min(subtitles.length, parseInt(batchRangeStart, 10) || 1));
    const to = Math.max(from, Math.min(subtitles.length, parseInt(batchRangeEnd, 10) || subtitles.length));
    const rangeIds = subtitles.slice(from - 1, to).map((c) => c.id);
    onSetSelectedCueIds(rangeIds);
  };

  const handleBatchTimingOffset = (deltaSeconds: number) => {
    if (!onBatchUpdateCues || effectiveBatchIds.length === 0 || Number.isNaN(deltaSeconds)) return;

    onBatchUpdateCues(effectiveBatchIds, (cue) => {
      if (batchTimingTarget === 'start') {
        const nextStart = Math.max(0, Math.round((cue.start + deltaSeconds) * 100) / 100);
        const safeStart = Math.min(nextStart, Math.round((cue.end - 0.1) * 100) / 100);
        return { ...cue, start: Math.max(0, safeStart) };
      }
      if (batchTimingTarget === 'end') {
        const nextEnd = Math.max(cue.start + 0.1, Math.round((cue.end + deltaSeconds) * 100) / 100);
        return { ...cue, end: nextEnd };
      }
      // both
      const dur = Math.max(0.1, cue.end - cue.start);
      const nextStart = Math.max(0, Math.round((cue.start + deltaSeconds) * 100) / 100);
      const nextEnd = Math.round((nextStart + dur) * 100) / 100;
      return { ...cue, start: nextStart, end: nextEnd };
    });

    showBatchToast(
      `${effectiveBatchIds.length} bloques ajustados (${deltaSeconds >= 0 ? '+' : ''}${deltaSeconds}s)`
    );
  };

  const handleBatchFixedDuration = () => {
    const dur = parseFloat(batchFixedDuration);
    if (!onBatchUpdateCues || effectiveBatchIds.length === 0 || Number.isNaN(dur) || dur < 0.2) return;
    const clampedDur = Math.round(dur * 100) / 100;
    onBatchUpdateCues(effectiveBatchIds, (cue) => ({
      ...cue,
      end: Math.round((cue.start + clampedDur) * 100) / 100,
    }));
    showBatchToast(`Duración fijada a ${clampedDur}s en ${effectiveBatchIds.length} bloques`);
  };

  const handleBatchStylePatch = (patch: Partial<SubtitleStyle>, label?: string) => {
    if (!onBatchUpdateCues || effectiveBatchIds.length === 0) return;
    onBatchUpdateCues(effectiveBatchIds, (cue) => ({
      ...cue,
      styleOverride: {
        ...(cue.styleOverride || {}),
        ...patch,
      },
    }));
    if (label) {
      showBatchToast(`${label} aplicado a ${effectiveBatchIds.length} bloques`);
    }
  };

  const handleBatchApplyPreset = (presetKey: SubtitlePreset) => {
    const preset = STYLE_PRESETS[presetKey];
    if (!preset) return;
    handleBatchStylePatch(
      {
        fontFamily: preset.fontFamily,
        fontSize: preset.fontSize,
        fontWeight: preset.fontWeight,
        textColor: preset.textColor,
        textTransform: preset.textTransform,
        letterSpacing: preset.letterSpacing,
        hasStroke: preset.hasStroke,
        strokeColor: preset.strokeColor,
        strokeWidth: preset.strokeWidth,
        hasBackground: preset.hasBackground,
        backgroundColor: preset.backgroundColor,
        backgroundOpacity: preset.backgroundOpacity,
        backgroundPadding: preset.backgroundPadding,
        backgroundRounded: preset.backgroundRounded,
        hasShadow: preset.hasShadow,
        shadowColor: preset.shadowColor,
        shadowBlur: preset.shadowBlur,
        shadowOffsetX: preset.shadowOffsetX,
        shadowOffsetY: preset.shadowOffsetY,
        position: preset.position,
        verticalOffset: preset.verticalOffset,
        textAlign: preset.textAlign,
      },
      `Preset "${presetKey}"`
    );
  };

  const handleBatchResetStyle = () => {
    if (!onBatchUpdateCues || effectiveBatchIds.length === 0) return;
    onBatchUpdateCues(effectiveBatchIds, (cue) => {
      const { styleOverride: _removed, ...rest } = cue;
      return rest;
    });
    showBatchToast(`Estilo global restaurado en ${effectiveBatchIds.length} bloques`);
  };

  const handleBatchSpeakerApply = () => {
    if (!onBatchUpdateCues || effectiveBatchIds.length === 0) return;
    const trimmed = batchSpeakerInput.trim();
    onBatchUpdateCues(effectiveBatchIds, (cue) => ({
      ...cue,
      speaker: trimmed,
    }));
    showBatchToast(
      trimmed
        ? `Locutor "${trimmed}" aplicado a ${effectiveBatchIds.length} bloques`
        : `Locutor limpiado en ${effectiveBatchIds.length} bloques`
    );
  };

  return (
    <div className="bg-white dark:bg-[#0e1017] flex flex-col h-full min-h-0 overflow-hidden select-none">
      {/* Docked 40px Tab Ribbon (Aligned horizontally with Script & Monitor Headers) */}
      <div className="h-10 px-1.5 bg-neutral-50 dark:bg-[#0b0c10] border-b border-neutral-200 dark:border-neutral-800/90 flex items-center gap-1 shrink-0">
        <button
          onClick={() => onChangeTab('subtitles')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all cursor-pointer ${
            activeTab === 'subtitles'
              ? 'bg-white dark:bg-[#151823] text-neutral-950 dark:text-white shadow-xs font-semibold border border-neutral-200/80 dark:border-neutral-800'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
          title="Edición del bloque seleccionado"
        >
          <Subtitles className="w-3.5 h-3.5 text-indigo-500" />
          <span className="truncate">Bloque</span>
        </button>

        <button
          onClick={() => onChangeTab('style')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all cursor-pointer ${
            activeTab === 'style'
              ? 'bg-white dark:bg-[#151823] text-neutral-950 dark:text-white shadow-xs font-semibold border border-neutral-200/80 dark:border-neutral-800'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
          title="Tipografía y Estilos Visuales"
        >
          <Palette className="w-3.5 h-3.5 text-violet-500" />
          <span className="truncate">Estilo</span>
        </button>

        <button
          onClick={() => onChangeTab('loops')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all cursor-pointer ${
            activeTab === 'loops'
              ? 'bg-white dark:bg-[#151823] text-neutral-950 dark:text-white shadow-xs font-semibold border border-neutral-200/80 dark:border-neutral-800'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
          title="Modo Audio y Fondos en Bucle"
        >
          <Radio className="w-3.5 h-3.5 text-pink-500" />
          <span className="truncate">Fondos</span>
          {style.isAudioMode && (
            <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => onChangeTab('tools')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all cursor-pointer ${
            activeTab === 'tools'
              ? 'bg-white dark:bg-[#151823] text-neutral-950 dark:text-white shadow-xs font-semibold border border-neutral-200/80 dark:border-neutral-800'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
          title="Subtítulos automáticos IA y ajustes de sincronización"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="truncate">IA & Sinc</span>
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-4 py-2 text-xs flex items-center gap-2 border-b border-emerald-200 dark:border-emerald-800 shrink-0">
          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* TAB 1: SINGLE OR BATCH SUBTITLE CUE INSPECTOR */}
      {activeTab === 'subtitles' && (
        <div className="flex-1 flex flex-col min-h-0 p-3.5 overflow-y-auto space-y-3">
          {subtitles.length > 0 && (
            <div className="flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-[#0b0c10] border border-neutral-200 dark:border-neutral-800 shrink-0">
              <button
                type="button"
                onClick={() => setInspectorSubMode('single')}
                className={`flex-1 py-1.5 px-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  inspectorSubMode === 'single'
                    ? 'bg-white dark:bg-[#151823] text-neutral-950 dark:text-white shadow-xs font-semibold border border-neutral-200/80 dark:border-neutral-800'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                Bloque individual
              </button>
              <button
                type="button"
                onClick={() => setInspectorSubMode('batch')}
                className={`flex-1 py-1.5 px-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
                  inspectorSubMode === 'batch'
                    ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span>Edición por lote</span>
                <span className="font-mono tabular-nums text-[11px] opacity-85">
                  ({effectiveBatchIds.length})
                </span>
              </button>
            </div>
          )}

          {subtitles.length === 0 ? (
            <div className="py-16 text-center text-neutral-400 text-xs">
              <Subtitles className="w-12 h-12 mx-auto text-indigo-500 mb-3 opacity-80" />
              <p className="font-extrabold text-sm text-neutral-800 dark:text-neutral-200 mb-1">
                No hay subtítulos en el proyecto
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs mx-auto mb-5">
                Genera subtítulos automáticos o añade bloques vacíos para comenzar a editar.
              </p>
              <button
                onClick={onOpenGenerate}
                className="px-5 py-2.5 text-xs font-bold rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                Ejecutar Generador Algorítmico
              </button>
            </div>
          ) : inspectorSubMode === 'batch' ? (
            /* BATCH EDITING WORKSPACE */
            <div className="space-y-3">
              {/* 1. Multi-Cue Selection Panel */}
              <div className="p-3 rounded-xl bg-white dark:bg-[#141620] border border-neutral-200/80 dark:border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    Selección múltiple
                  </span>
                  <span className="font-mono tabular-nums text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                    {effectiveBatchIds.length} de {subtitles.length}
                  </span>
                </div>

                {/* Quick Selection Actions */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSetSelectedCueIds?.(subtitles.map((c) => c.id))}
                    className="px-2 py-1 text-[11px] font-medium rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 cursor-pointer transition-colors whitespace-nowrap"
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const startIdx = Math.max(0, selectedIndex);
                      onSetSelectedCueIds?.(subtitles.slice(startIdx).map((c) => c.id));
                    }}
                    className="px-2 py-1 text-[11px] font-medium rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 cursor-pointer transition-colors whitespace-nowrap"
                  >
                    Desde #{Math.max(1, selectedIndex + 1)} al fin
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetSelectedCueIds?.(selectedCue ? [selectedCue.id] : [])}
                    className="px-2 py-1 text-[11px] font-medium rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 cursor-pointer transition-colors whitespace-nowrap"
                  >
                    Solo actual
                  </button>
                </div>

                {/* Range Selector */}
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-neutral-500 shrink-0">Rango #</span>
                  <input
                    type="number"
                    min={1}
                    max={subtitles.length}
                    value={batchRangeStart}
                    onChange={(e) => setBatchRangeStart(e.target.value)}
                    className="w-12 px-1.5 py-1 rounded bg-neutral-50 dark:bg-[#0c0d12] border border-neutral-200 dark:border-neutral-800 font-mono tabular-nums text-center text-xs outline-none focus:border-indigo-500"
                  />
                  <span className="text-neutral-500">a</span>
                  <input
                    type="number"
                    min={1}
                    max={subtitles.length}
                    value={batchRangeEnd}
                    onChange={(e) => setBatchRangeEnd(e.target.value)}
                    className="w-12 px-1.5 py-1 rounded bg-neutral-50 dark:bg-[#0c0d12] border border-neutral-200 dark:border-neutral-800 font-mono tabular-nums text-center text-xs outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleApplyBatchRange}
                    className="px-2.5 py-1 rounded bg-indigo-600/15 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-400 hover:text-white font-semibold transition-colors cursor-pointer whitespace-nowrap ml-auto"
                  >
                    Seleccionar rango
                  </button>
                </div>

                {/* Scrollable Multi-Select Cue Checklist */}
                <div className="max-h-32 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/70 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#0b0c10]">
                  {subtitles.map((cue, idx) => {
                    const checked = effectiveBatchIdSet.has(String(cue.id));
                    return (
                      <button
                        key={cue.id}
                        type="button"
                        onClick={() => toggleBatchCueId(cue.id)}
                        className={`w-full px-2.5 py-1.5 text-left flex items-center gap-2 text-[11px] transition-colors cursor-pointer ${
                          checked
                            ? 'bg-indigo-500/10 text-neutral-900 dark:text-white'
                            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/50'
                        }`}
                      >
                        {checked ? (
                          <CheckSquare className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        )}
                        <span className="font-mono tabular-nums font-bold shrink-0">#{idx + 1}</span>
                        <span className="font-mono tabular-nums text-[10px] text-neutral-500 shrink-0">
                          {formatTimeDisplay(cue.start, true)}
                        </span>
                        <span className="truncate flex-1">{cue.text || '(Vacío)'}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-neutral-500">
                  Tip: también puedes usar <span className="font-semibold">Shift+Clic</span> o <span className="font-semibold">Ctrl+Clic</span> en el Guion o la Línea de Tiempo.
                </p>
              </div>

              {/* 2. Batch Timing Offsets */}
              <div className="p-3 rounded-xl bg-white dark:bg-[#141620] border border-neutral-200/80 dark:border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Desfase de tiempos</span>
                  </span>
                  {batchSelectedCues[0] && (
                    <span className="text-[10px] font-mono tabular-nums text-neutral-500">
                      #{subtitles.indexOf(batchSelectedCues[0]) + 1}: {formatTimeDisplay(batchSelectedCues[0].start, true)} – {formatTimeDisplay(batchSelectedCues[0].end, true)}
                    </span>
                  )}
                </div>

                {/* Timing Target Selector */}
                <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-[#0c0d12] border border-neutral-200 dark:border-neutral-800">
                  {[
                    { id: 'both', label: 'Ambos' },
                    { id: 'start', label: 'Inicio' },
                    { id: 'end', label: 'Fin' },
                    { id: 'duration', label: 'Duración' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setBatchTimingTarget(item.id as 'both' | 'start' | 'end' | 'duration')}
                      className={`py-1 px-1.5 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        batchTimingTarget === item.id
                          ? 'bg-white dark:bg-[#1a1e2b] text-neutral-950 dark:text-white font-semibold shadow-xs'
                          : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {batchTimingTarget === 'duration' ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={0.1}
                      min={0.2}
                      value={batchFixedDuration}
                      onChange={(e) => setBatchFixedDuration(e.target.value)}
                      className="w-24 px-2.5 py-1.5 rounded-lg bg-neutral-50 dark:bg-[#0c0d12] border border-neutral-200 dark:border-neutral-800 text-xs font-mono tabular-nums outline-none focus:border-indigo-500"
                    />
                    <span className="text-xs text-neutral-500">seg</span>
                    <button
                      type="button"
                      disabled={effectiveBatchIds.length === 0}
                      onClick={handleBatchFixedDuration}
                      className="ml-auto px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Aplicar duración
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-6 gap-1">
                      {[-1.0, -0.5, -0.1, 0.1, 0.5, 1.0].map((val) => (
                        <button
                          key={val}
                          type="button"
                          disabled={effectiveBatchIds.length === 0}
                          onClick={() => handleBatchTimingOffset(val)}
                          className="py-1.5 rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-40 text-[11px] font-mono tabular-nums font-semibold text-neutral-800 dark:text-neutral-200 cursor-pointer transition-colors"
                        >
                          {val > 0 ? `+${val}` : val}s
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step={0.05}
                        value={batchOffsetInput}
                        onChange={(e) => setBatchOffsetInput(e.target.value)}
                        placeholder="0.50"
                        className="w-24 px-2.5 py-1.5 rounded-lg bg-neutral-50 dark:bg-[#0c0d12] border border-neutral-200 dark:border-neutral-800 text-xs font-mono tabular-nums outline-none focus:border-indigo-500"
                      />
                      <span className="text-[11px] text-neutral-500">seg (±)</span>
                      <button
                        type="button"
                        disabled={effectiveBatchIds.length === 0}
                        onClick={() => handleBatchTimingOffset(parseFloat(batchOffsetInput) || 0)}
                        className="ml-auto px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Aplicar desfase
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* 3. Batch Text Style Overrides */}
              <div className="p-3 rounded-xl bg-white dark:bg-[#141620] border border-neutral-200/80 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-violet-500" />
                    <span>Estilo de texto por lote</span>
                  </span>
                  <button
                    type="button"
                    disabled={effectiveBatchIds.length === 0}
                    onClick={handleBatchResetStyle}
                    className="text-[11px] text-neutral-500 hover:text-indigo-500 disabled:opacity-40 flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                    title="Quitar estilos individuales y volver al estilo global del proyecto"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restablecer global</span>
                  </button>
                </div>

                {/* Preset Swatches */}
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(STYLE_PRESETS) as SubtitlePreset[]).map((presetKey) => {
                    const p = STYLE_PRESETS[presetKey];
                    return (
                      <button
                        key={presetKey}
                        type="button"
                        disabled={effectiveBatchIds.length === 0}
                        onClick={() => handleBatchApplyPreset(presetKey)}
                        className="px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#0c0d12] hover:border-indigo-500 text-left transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <span className="text-[10px] font-semibold block truncate capitalize text-neutral-700 dark:text-neutral-300">
                          {presetKey.replace('-', ' ')}
                        </span>
                        <span
                          style={{ color: p.textColor, fontFamily: p.fontFamily }}
                          className="text-[11px] font-bold block truncate"
                        >
                          Muestra
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Font & Size */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] font-semibold text-neutral-500 block mb-1">Fuente</label>
                    <select
                      disabled={effectiveBatchIds.length === 0}
                      value={batchSampleStyle.fontFamily}
                      onChange={(e) => handleBatchStylePatch({ fontFamily: e.target.value }, 'Fuente')}
                      className="w-full text-xs px-2 py-1.5 rounded-lg bg-neutral-50 dark:bg-[#0c0d12] border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none"
                    >
                      {FONT_OPTIONS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-neutral-500 block mb-1">Tamaño</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={14}
                        max={76}
                        disabled={effectiveBatchIds.length === 0}
                        value={batchSampleStyle.fontSize}
                        onChange={(e) => {
                          const v = Math.max(14, Math.min(76, parseInt(e.target.value, 10) || 24));
                          handleBatchStylePatch({ fontSize: v });
                        }}
                        className="w-full text-xs font-mono tabular-nums px-2 py-1.5 rounded-lg bg-neutral-50 dark:bg-[#0c0d12] border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Text Color */}
                <div>
                  <label className="text-[10px] font-semibold text-neutral-500 block mb-1.5">Color de texto</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {COLOR_SWATCHES.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        disabled={effectiveBatchIds.length === 0}
                        onClick={() => handleBatchStylePatch({ textColor: hex }, 'Color')}
                        style={{ backgroundColor: hex }}
                        className={`w-6 h-6 rounded-md border transition-transform cursor-pointer disabled:opacity-40 ${
                          batchSampleStyle.textColor.toUpperCase() === hex.toUpperCase()
                            ? 'ring-2 ring-indigo-500 scale-110 border-white'
                            : 'border-neutral-300 dark:border-neutral-600 hover:scale-105'
                        }`}
                        title={hex}
                      />
                    ))}
                    <input
                      type="color"
                      disabled={effectiveBatchIds.length === 0}
                      value={batchSampleStyle.textColor}
                      onChange={(e) => handleBatchStylePatch({ textColor: e.target.value })}
                      className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                      title="Color personalizado"
                    />
                  </div>
                </div>

                {/* Transform & Position */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-neutral-500 block mb-1">Formato</label>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'none', label: 'Aa' },
                        { id: 'uppercase', label: 'AA' },
                        { id: 'capitalize', label: 'Ab' },
                      ].map((tr) => (
                        <button
                          key={tr.id}
                          type="button"
                          disabled={effectiveBatchIds.length === 0}
                          onClick={() =>
                            handleBatchStylePatch(
                              { textTransform: tr.id as 'none' | 'uppercase' | 'capitalize' },
                              'Formato'
                            )
                          }
                          className={`py-1 rounded text-[11px] font-semibold border cursor-pointer transition-colors ${
                            batchSampleStyle.textTransform === tr.id
                              ? 'border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                              : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                          }`}
                        >
                          {tr.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-neutral-500 block mb-1">Posición</label>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'top', label: 'Arriba' },
                        { id: 'middle', label: 'Centro' },
                        { id: 'bottom', label: 'Abajo' },
                      ].map((pos) => (
                        <button
                          key={pos.id}
                          type="button"
                          disabled={effectiveBatchIds.length === 0}
                          onClick={() =>
                            handleBatchStylePatch(
                              { position: pos.id as 'top' | 'middle' | 'bottom' },
                              'Posición'
                            )
                          }
                          className={`py-1 rounded text-[11px] font-medium border cursor-pointer transition-colors ${
                            batchSampleStyle.position === pos.id
                              ? 'border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 font-semibold'
                              : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                          }`}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Stroke & Background Toggles */}
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    disabled={effectiveBatchIds.length === 0}
                    onClick={() =>
                      handleBatchStylePatch(
                        { hasStroke: !batchSampleStyle.hasStroke },
                        !batchSampleStyle.hasStroke ? 'Contorno activado' : 'Contorno desactivado'
                      )
                    }
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium border cursor-pointer transition-colors ${
                      batchSampleStyle.hasStroke
                        ? 'border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 font-semibold'
                        : 'border-neutral-200 dark:border-neutral-800 text-neutral-500'
                    }`}
                  >
                    Contorno: {batchSampleStyle.hasStroke ? 'Sí' : 'No'}
                  </button>
                  <button
                    type="button"
                    disabled={effectiveBatchIds.length === 0}
                    onClick={() =>
                      handleBatchStylePatch(
                        { hasBackground: !batchSampleStyle.hasBackground },
                        !batchSampleStyle.hasBackground ? 'Fondo activado' : 'Fondo desactivado'
                      )
                    }
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium border cursor-pointer transition-colors ${
                      batchSampleStyle.hasBackground
                        ? 'border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 font-semibold'
                        : 'border-neutral-200 dark:border-neutral-800 text-neutral-500'
                    }`}
                  >
                    Caja fondo: {batchSampleStyle.hasBackground ? 'Sí' : 'No'}
                  </button>
                </div>
              </div>

              {/* 4. Batch Speaker & Delete */}
              <div className="p-3 rounded-xl bg-white dark:bg-[#141620] border border-neutral-200/80 dark:border-neutral-800 space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Asignar locutor al lote..."
                    value={batchSpeakerInput}
                    onChange={(e) => setBatchSpeakerInput(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-neutral-50 dark:bg-[#0c0d12] border border-neutral-200 dark:border-neutral-800 text-xs outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    disabled={effectiveBatchIds.length === 0}
                    onClick={handleBatchSpeakerApply}
                    className="px-2.5 py-1.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold disabled:opacity-40 cursor-pointer whitespace-nowrap"
                  >
                    Aplicar
                  </button>
                </div>

                {onBatchDeleteCues && effectiveBatchIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onBatchDeleteCues(effectiveBatchIds)}
                    className="w-full py-1.5 px-3 rounded-lg bg-red-500/10 hover:bg-red-600 text-red-600 dark:text-red-400 hover:text-white border border-red-500/20 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar {effectiveBatchIds.length} bloques seleccionados</span>
                  </button>
                )}
              </div>
            </div>
          ) : selectedCue ? (
            <div className="space-y-3">
              {/* SECCIÓN A: Navegador y Posición del Bloque */}
              <div className="p-2.5 bg-neutral-50 dark:bg-[#151823] rounded-lg border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
                <button
                  disabled={selectedIndex <= 0}
                  onClick={() => {
                    const prev = subtitles[selectedIndex - 1];
                    if (prev) {
                      onSelectCue?.(prev.id);
                    }
                  }}
                  className="px-2.5 py-1 rounded-md text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-neutral-800 disabled:opacity-30 cursor-pointer flex items-center gap-1 text-xs font-medium transition-colors"
                  title="Subtítulo anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>

                <div className="text-center px-2">
                  <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    Bloque {selectedIndex + 1} de {subtitles.length}
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                    {formatTimeDisplay(selectedCue.start, true)} ➔ {formatTimeDisplay(selectedCue.end, true)}
                  </div>
                </div>

                <button
                  disabled={selectedIndex >= subtitles.length - 1}
                  onClick={() => {
                    const next = subtitles[selectedIndex + 1];
                    if (next) {
                      onSelectCue?.(next.id);
                    }
                  }}
                  className="px-2.5 py-1 rounded-md text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-neutral-800 disabled:opacity-30 cursor-pointer flex items-center gap-1 text-xs font-medium transition-colors"
                  title="Subtítulo siguiente"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* SECCIÓN B: Editor del Contenido y Locutor */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#141620] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Texto del Subtítulo</span>
                  </span>

                  <span className="text-[11px] text-neutral-500 font-mono">
                    {selectedCue.text.length} carácteres
                  </span>
                </div>

                <textarea
                  value={selectedCue.text}
                  onChange={(e) => onUpdateCue({ ...selectedCue, text: e.target.value })}
                  rows={3}
                  placeholder="Escribe o edita el texto del subtítulo..."
                  className="w-full p-2.5 text-xs font-medium rounded-lg bg-neutral-50 dark:bg-[#0c0d12] border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none leading-relaxed transition-all"
                />

                <div className="flex items-center gap-2 bg-neutral-50 dark:bg-[#0c0d12] px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
                  <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Locutor (opcional)"
                    value={selectedCue.speaker || ''}
                    onChange={(e) => onUpdateCue({ ...selectedCue, speaker: e.target.value })}
                    className="w-full text-xs bg-transparent outline-none text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 font-medium"
                  />
                </div>
              </div>

              {/* SECCIÓN C: Calibración Precisa de Tiempos */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#141620] border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Sincronización</span>
                  </span>
                  <span className="text-[11px] font-mono text-neutral-500">
                    Duración: {Math.round((selectedCue.end - selectedCue.start) * 10) / 10}s
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Start time */}
                  <div className="p-2 rounded-lg bg-neutral-50 dark:bg-[#0c0d12] border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider block font-semibold">Inicio</span>
                      <span
                        onClick={() => onSeek(selectedCue.start + 0.05)}
                        className="text-xs font-mono font-bold text-neutral-900 dark:text-neutral-100 cursor-pointer hover:text-indigo-500"
                        title="Ir a este segundo"
                      >
                        {formatTimeDisplay(selectedCue.start, true)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleTimeStep(selectedCue, 'start', -0.1)}
                        className="w-6 h-6 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-bold text-neutral-700 dark:text-neutral-200 text-xs hover:bg-neutral-100 cursor-pointer flex items-center justify-center"
                        title="Restar 0.1s"
                      >
                        -
                      </button>
                      <button
                        onClick={() => handleTimeStep(selectedCue, 'start', 0.1)}
                        className="w-6 h-6 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-bold text-neutral-700 dark:text-neutral-200 text-xs hover:bg-neutral-100 cursor-pointer flex items-center justify-center"
                        title="Sumar 0.1s"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* End time */}
                  <div className="p-2 rounded-lg bg-neutral-50 dark:bg-[#0c0d12] border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider block font-semibold">Fin</span>
                      <span
                        onClick={() => onSeek(Math.max(selectedCue.start, selectedCue.end - 0.2))}
                        className="text-xs font-mono font-bold text-neutral-900 dark:text-neutral-100 cursor-pointer hover:text-indigo-500"
                        title="Ir al final de este bloque"
                      >
                        {formatTimeDisplay(selectedCue.end, true)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleTimeStep(selectedCue, 'end', -0.1)}
                        className="w-6 h-6 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-bold text-neutral-700 dark:text-neutral-200 text-xs hover:bg-neutral-100 cursor-pointer flex items-center justify-center"
                        title="Restar 0.1s"
                      >
                        -
                      </button>
                      <button
                        onClick={() => handleTimeStep(selectedCue, 'end', 0.1)}
                        className="w-6 h-6 rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-bold text-neutral-700 dark:text-neutral-200 text-xs hover:bg-neutral-100 cursor-pointer flex items-center justify-center"
                        title="Sumar 0.1s"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECCIÓN D: Barra de Acciones del Bloque */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                <button
                  onClick={() => onPlaySpan(selectedCue.start, selectedCue.end)}
                  className="py-2 px-2.5 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                  title="Reproducir este subtítulo"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Escuchar</span>
                </button>

                <button
                  onClick={() => {
                    const newCue: SubtitleCue = {
                      id: Date.now(),
                      start: Math.round(selectedCue.end * 100) / 100,
                      end: Math.round((selectedCue.end + 2.5) * 100) / 100,
                      text: 'Nuevo subtítulo...',
                    };
                    onAddCue(newCue, selectedIndex + 1);
                  }}
                  className="py-2 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                  title="Añadir nuevo bloque después de este"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ Bloque</span>
                </button>

                <button
                  onClick={() => onSplitCue(selectedIndex)}
                  className="py-2 px-2.5 rounded-lg bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  title="Dividir en 2 partes por el medio"
                >
                  <Scissors className="w-3 h-3 text-amber-500" />
                  <span>Dividir</span>
                </button>

                <button
                  onClick={() => onDeleteCue(selectedCue.id)}
                  className="py-2 px-2.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-500/20 border border-transparent text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  title="Eliminar este subtítulo"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Eliminar</span>
                </button>
              </div>

              {/* SECCIÓN E: Accesos Directos SRT / Lista (Solo móvil/tablet donde la barra lateral izquierda está oculta) */}
              <div className="lg:hidden pt-2 border-t border-neutral-200/80 dark:border-neutral-800/80 flex items-center justify-between text-xs text-neutral-500">
                <button
                  onClick={() => setShowFullListModal(true)}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 font-medium cursor-pointer"
                >
                  <ListFilter className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Ver todos ({subtitles.length})</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 font-medium cursor-pointer"
                  title="Cargar archivo .SRT externo"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Importar .SRT</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".srt"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onImportSrt(f);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
          ) : null}

          {/* Collapsible Full List Drawer Modal */}
          {showFullListModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-xl w-full max-h-[85vh] shadow-2xl overflow-hidden flex flex-col">
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sm text-neutral-900 dark:text-neutral-100">
                    <ListFilter className="w-5 h-5 text-indigo-500" />
                    <span>Lista Completa de Subtítulos ({subtitles.length})</span>
                  </div>
                  <button
                    onClick={() => setShowFullListModal(false)}
                    className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar subtítulo por palabra..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 border-none outline-none text-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                  {subtitles
                    .filter((c) => c.text.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((cue, idx) => (
                      <div
                        key={cue.id}
                        onClick={() => {
                          onSelectCue?.(cue.id);
                          setShowFullListModal(false);
                        }}
                        className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all flex items-start justify-between gap-3 ${
                          selectedCue?.id === cue.id
                            ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/60 font-bold'
                            : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/50'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-mono mb-1">
                            <span className="font-bold text-neutral-800 dark:text-neutral-200">#{idx + 1}</span>
                            <span>•</span>
                            <span>{formatTimeDisplay(cue.start, true)} ➔ {formatTimeDisplay(cue.end, true)}</span>
                          </div>
                          <p className="text-neutral-900 dark:text-neutral-100 leading-snug line-clamp-2">
                            {cue.text}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-neutral-400 shrink-0 mt-2" />
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STYLE EDITOR */}
      {activeTab === 'style' && (
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <label className="text-xs font-extrabold text-neutral-800 dark:text-neutral-200 block mb-2.5 uppercase tracking-wider">
              Presets Profesionales
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {(Object.keys(STYLE_PRESETS) as SubtitlePreset[]).map((presetKey) => {
                const isSelected = style.preset === presetKey;
                const p = STYLE_PRESETS[presetKey];
                return (
                  <button
                    key={presetKey}
                    onClick={() => handleSelectPreset(presetKey)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 shadow-sm ring-1 ring-indigo-500'
                        : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/40'
                    }`}
                  >
                    <span className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200 capitalize truncate">
                      {presetKey.replace('-', ' ')}
                    </span>
                    <span
                      style={{
                        color: p.textColor,
                        fontFamily: p.fontFamily,
                      }}
                      className="text-xs font-extrabold mt-1 truncate"
                    >
                      TEXTO DEMO
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-neutral-200 dark:bg-neutral-800" />

          <div className="space-y-3.5">
            <h4 className="text-xs font-extrabold text-neutral-800 dark:text-neutral-200 flex items-center gap-2 uppercase tracking-wider">
              <Type className="w-4 h-4 text-indigo-500" />
              <span>Tipografía</span>
            </h4>

            <div>
              <label className="text-[11px] font-semibold text-neutral-500 block mb-1">Fuente</label>
              <select
                value={style.fontFamily}
                onChange={(e) => updateStyle('fontFamily', e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100 outline-none"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-semibold text-neutral-500 mb-1">
                <span>Tamaño de Letra</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{style.fontSize}px</span>
              </div>
              <input
                type="range"
                min={14}
                max={76}
                value={style.fontSize}
                onChange={(e) => updateStyle('fontSize', parseInt(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex items-center justify-between gap-1 mt-1.5">
                {[
                  { label: 'Normal (22px)', val: 22 },
                  { label: 'Medio (30px)', val: 30 },
                  { label: 'Grande (40px)', val: 40 },
                  { label: 'Gigante (56px)', val: 56 },
                ].map((s) => (
                  <button
                    key={s.val}
                    type="button"
                    onClick={() => updateStyle('fontSize', s.val)}
                    className={`px-1.5 py-0.5 text-[9px] rounded-md font-medium transition-colors cursor-pointer ${
                      style.fontSize === s.val
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-neutral-500 block mb-1.5">Color del Texto</label>
              <div className="flex items-center gap-2">
                {COLOR_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    onClick={() => updateStyle('textColor', hex)}
                    style={{ backgroundColor: hex }}
                    className={`w-7 h-7 rounded-xl border transition-transform cursor-pointer ${
                      style.textColor.toUpperCase() === hex.toUpperCase()
                        ? 'ring-2 ring-indigo-500 scale-110 border-white'
                        : 'border-neutral-300 dark:border-neutral-600 hover:scale-105'
                    }`}
                  />
                ))}
                <input
                  type="color"
                  value={style.textColor}
                  onChange={(e) => updateStyle('textColor', e.target.value)}
                  className="w-8 h-8 rounded-xl cursor-pointer border-0 bg-transparent p-0"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-neutral-200 dark:bg-neutral-800" />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
                Borde / Trazo (Outline)
              </label>
              <input
                type="checkbox"
                checked={style.hasStroke}
                onChange={(e) => updateStyle('hasStroke', e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
              />
            </div>
            {style.hasStroke && (
              <div className="space-y-2 pl-3 border-l-2 border-indigo-500">
                <div className="flex justify-between text-[11px] text-neutral-500">
                  <span>Grosor</span>
                  <span className="font-mono">{style.strokeWidth}px</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={style.strokeWidth}
                  onChange={(e) => updateStyle('strokeWidth', parseInt(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            )}
          </div>

          <div className="h-px bg-neutral-200 dark:bg-neutral-800" />

          {/* POSITION & ALIGNMENT CONTROLS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider block">
                Ubicación del Texto en Pantalla
              </label>
              <span className="text-[10px] font-mono text-indigo-500 font-bold uppercase">
                {style.position === 'top' ? 'Arriba' : style.position === 'middle' ? 'Centro' : 'Abajo'} - {style.textAlign === 'left' ? 'Izq' : style.textAlign === 'right' ? 'Der' : 'Centro'}
              </span>
            </div>

            {/* Quick 9-Grid Position Selector Matrix */}
            <div className="bg-neutral-50 dark:bg-neutral-900/80 p-2.5 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <span className="text-[10px] font-bold text-neutral-500 block mb-2 text-center uppercase tracking-wider">
                Matriz de Posicionamiento (9 Puntos)
              </span>
              <div className="grid grid-cols-3 gap-1.5 max-w-[240px] mx-auto">
                {[
                  { pos: 'top', align: 'left', label: '↖', title: 'Arriba Izquierda' },
                  { pos: 'top', align: 'center', label: '↑', title: 'Arriba Centro' },
                  { pos: 'top', align: 'right', label: '↗', title: 'Arriba Derecha' },
                  { pos: 'middle', align: 'left', label: '←', title: 'Centro Izquierda' },
                  { pos: 'middle', align: 'center', label: '•', title: 'Centro Absoluto' },
                  { pos: 'middle', align: 'right', label: '→', title: 'Centro Derecha' },
                  { pos: 'bottom', align: 'left', label: '↙', title: 'Abajo Izquierda' },
                  { pos: 'bottom', align: 'center', label: '↓', title: 'Abajo Centro' },
                  { pos: 'bottom', align: 'right', label: '↘', title: 'Abajo Derecha' },
                ].map((item) => {
                  const isSelected = style.position === item.pos && style.textAlign === item.align;
                  return (
                    <button
                      key={`${item.pos}-${item.align}`}
                      type="button"
                      title={item.title}
                      onClick={() => {
                        onChangeStyle({
                          ...style,
                          preset: 'custom',
                          position: item.pos as 'top' | 'middle' | 'bottom',
                          textAlign: item.align as 'left' | 'center' | 'right',
                        });
                      }}
                      className={`h-9 rounded-xl font-black text-xs transition-all flex items-center justify-center cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105 border-2 border-indigo-400'
                          : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-200/80 dark:border-neutral-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vertical Position Buttons */}
            <div>
              <span className="text-[11px] font-semibold text-neutral-500 block mb-1.5">
                Posición Vertical
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(['top', 'middle', 'bottom'] as const).map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => updateStyle('position', pos)}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer capitalize ${
                      style.position === pos
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 shadow-xs'
                        : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    {pos === 'top' ? 'Arriba' : pos === 'middle' ? 'Centro' : 'Abajo'}
                  </button>
                ))}
              </div>
            </div>

            {/* Horizontal Alignment Buttons */}
            <div>
              <span className="text-[11px] font-semibold text-neutral-500 block mb-1.5">
                Alineación Horizontal
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'left', label: 'Izquierda', icon: AlignLeft },
                  { id: 'center', label: 'Centro', icon: AlignCenter },
                  { id: 'right', label: 'Derecha', icon: AlignRight },
                ].map((align) => {
                  const Icon = align.icon;
                  const isSelected = style.textAlign === align.id;
                  return (
                    <button
                      key={align.id}
                      type="button"
                      onClick={() => updateStyle('textAlign', align.id as 'left' | 'center' | 'right')}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 shadow-xs'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{align.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BACKGROUND LOOPS */}
      {activeTab === 'loops' && (
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="p-4 rounded-2xl border border-pink-500/30 bg-pink-50/50 dark:bg-pink-950/20">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-pink-500" />
                  <span>Modo Solo Audio</span>
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Reemplaza el video con fondos animados en bucle a 60 FPS
                </p>
              </div>
              <input
                type="checkbox"
                checked={style.isAudioMode || false}
                onChange={(e) => {
                  onChangeStyle({
                    ...style,
                    isAudioMode: e.target.checked,
                    backgroundLoop: style.backgroundLoop || 'aurora-gradient',
                  });
                }}
                className="w-5 h-5 text-pink-600 rounded cursor-pointer"
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <Maximize2 className="w-4 h-4 text-indigo-500" />
                  <span>Subtítulos en Pantalla Completa</span>
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Centrado dinámico para podcasts y reels líricos
                </p>
              </div>
              <input
                type="checkbox"
                checked={style.fullScreenSubtitle || false}
                onChange={(e) => updateStyle('fullScreenSubtitle', e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-extrabold text-neutral-800 dark:text-neutral-200 block mb-3 uppercase tracking-wider">
              Seleccionar Fondo Animado (60 FPS)
            </label>
            <div className="space-y-2.5">
              {LOOP_OPTIONS.map((loop) => {
                const isSelected = (style.backgroundLoop || 'aurora-gradient') === loop.id;
                return (
                  <div
                    key={loop.id}
                    onClick={() => {
                      onChangeStyle({
                        ...style,
                        isAudioMode: true,
                        backgroundLoop: loop.id,
                      });
                    }}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 ring-1 ring-indigo-500 shadow-sm'
                        : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${loop.gradient} shadow-sm shrink-0`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-xs text-neutral-900 dark:text-neutral-100">
                            {loop.title}
                          </h5>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                            {loop.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                          {loop.desc}
                        </p>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-indigo-500 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TOOLS & ALGORITHMIC GENERATOR */}
      {activeTab === 'tools' && (
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* AI & Algorithmic Subtitle Generator Card */}
          <div className="p-5 rounded-3xl border border-indigo-200 dark:border-indigo-800/60 bg-gradient-to-br from-indigo-600 via-violet-600 to-amber-500 text-white shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md">
                <Sparkles className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white">Subtítulos Automáticos con IA</h4>
                <p className="text-xs text-indigo-100">Groq Whisper LPU + Gemini 2.5 para todo el video</p>
              </div>
            </div>
            <button
              onClick={onOpenGenerate}
              className="w-full py-3 px-4 text-xs font-extrabold rounded-2xl bg-white hover:bg-neutral-100 text-indigo-950 transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Abrir Generador de Subtítulos IA</span>
            </button>
          </div>

          {/* Groq Whisper API Key Manager Card */}
          <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>API de Groq (Whisper AI)</span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                groqKey ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
              }`}>
                {groqKey ? 'Conectada' : 'No configurada'}
              </span>
            </div>

            <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
              Guarda tu API Key de Groq (<code className="text-amber-500 font-mono">gsk_...</code>) para que todos los subtítulos automáticos se generen con Whisper LPU:
            </p>

            <div className="flex gap-2">
              <input
                type="password"
                value={groqKey}
                onChange={(e) => handleSaveGroqKey(e.target.value)}
                placeholder="gsk_xxxxxxxxxxxxxxxxxxxx"
                className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-amber-400/40 dark:border-amber-500/30 text-xs font-mono text-neutral-900 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-amber-500"
              />
              {groqKey && (
                <button
                  type="button"
                  onClick={() => handleSaveGroqKey('')}
                  className="px-2 py-1 text-[11px] text-red-500 hover:text-red-700 cursor-pointer font-bold"
                >
                  Borrar
                </button>
              )}
            </div>
          </div>

          {/* Auto-Align Subtitles (AI + Waveform Peak Analysis) */}
          <div className="space-y-3 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/40 dark:bg-[#131624]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-extrabold text-xs text-neutral-900 dark:text-neutral-100 flex items-center gap-2 uppercase tracking-wider">
                  <AudioLines className="w-4 h-4 text-indigo-500" />
                  <span>Auto-Align Subtitles</span>
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                  Analiza con IA los picos de energía de la onda de audio para ajustar automáticamente el inicio y fin de cada subtítulo al habla real.
                </p>
              </div>
              {previousCuesBackup && !isAligning && (
                <button
                  type="button"
                  onClick={handleUndoAlign}
                  className="px-2 py-1 rounded-lg text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                  title="Deshacer último auto-alineado"
                >
                  <Undo2 className="w-3 h-3" />
                  <span>Deshacer</span>
                </button>
              )}
            </div>

            {isAligning && (
              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center justify-between text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                  <span className="truncate pr-2">{alignStage}</span>
                  <span className="font-mono shrink-0">{alignProgress}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 dark:bg-indigo-400 transition-all duration-300"
                    style={{ width: `${alignProgress}%` }}
                  />
                </div>
              </div>
            )}

            {alignReport && !isAligning && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] text-emerald-700 dark:text-emerald-300 space-y-1">
                <p className="font-semibold">{alignReport.summary}</p>
                <p className="font-mono text-[10px] opacity-85">
                  {alignReport.adjustedCount} bloques ajustados · {alignReport.speechSegmentsCount} picos de voz · Desfase medio {alignReport.averageShiftSeconds}s
                </p>
              </div>
            )}

            {alignError && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-[11px] text-red-600 dark:text-red-400 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{alignError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleAutoAlign}
              disabled={isAligning || subtitles.length === 0 || (!videoFile && !videoUrl)}
              className="w-full py-2.5 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-45 text-white text-xs font-bold transition-all shadow-xs active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              {isAligning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Analizando onda y alineando...</span>
                </>
              ) : (
                <>
                  <AudioLines className="w-3.5 h-3.5" />
                  <span>Auto-Alinear {subtitles.length} Subtítulos</span>
                </>
              )}
            </button>
          </div>

          {/* Frontend Web Audio API VAD (Silence > 1s Detector & Offset Suggestions) */}
          <div className="space-y-3 p-4 rounded-2xl border border-cyan-200 dark:border-cyan-900/60 bg-cyan-50/40 dark:bg-[#0f1722]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-extrabold text-xs text-neutral-900 dark:text-neutral-100 flex items-center gap-2 uppercase tracking-wider">
                  <Activity className="w-4 h-4 text-cyan-500" />
                  <span>Detector de Silencios (VAD · Web Audio)</span>
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                  Analiza la onda de audio en tu navegador para detectar silencios &gt; 1s y sugerir desplazamientos de tiempo exactos.
                </p>
              </div>
              {previousVadBackup && !isAnalyzingVad && (
                <button
                  type="button"
                  onClick={handleUndoVadOffsets}
                  className="px-2 py-1 rounded-lg text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                  title="Deshacer ajustes aplicados desde VAD"
                >
                  <Undo2 className="w-3 h-3" />
                  <span>Deshacer</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 shrink-0">
                Sensibilidad:
              </label>
              <select
                value={vadSensitivity}
                onChange={(e) => setVadSensitivity(e.target.value as 'balanced' | 'strict' | 'sensitive')}
                disabled={isAnalyzingVad}
                className="flex-1 text-[11px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 outline-none font-semibold"
              >
                <option value="balanced">Equilibrada (Estándar)</option>
                <option value="strict">Estricta (Ignorar ruido de fondo)</option>
                <option value="sensitive">Sensible (Voces suaves)</option>
              </select>
            </div>

            {isAnalyzingVad && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-cyan-600 dark:text-cyan-400 font-medium">
                  <span className="truncate pr-2">{vadStage}</span>
                  <span className="font-mono shrink-0">{vadProgress}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 transition-all duration-200"
                    style={{ width: `${vadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {vadError && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-[11px] text-red-600 dark:text-red-400 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{vadError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleRunVadAnalysis}
              disabled={isAnalyzingVad || (!videoFile && !videoUrl)}
              className="w-full py-2.5 px-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-45 text-white text-xs font-bold transition-all shadow-xs active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              {isAnalyzingVad ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Analizando onda con Web Audio...</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>Detectar Silencios (&gt; 1s) y Sugerir Ajustes</span>
                </>
              )}
            </button>

            {vadResult && !isAnalyzingVad && (
              <div className="space-y-3 pt-1">
                {/* Interactive VAD Envelope Strip */}
                <div className="p-2.5 rounded-xl bg-white/80 dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
                    <span>
                      {vadResult.silenceSegments.length} silencios &gt; 1s ({vadResult.totalSilenceDuration}s)
                    </span>
                    <span>Piso ruido: {vadResult.noiseFloorDb} dBFS</span>
                  </div>

                  <div
                    className="relative h-10 w-full flex items-end gap-[1px] rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-950 px-1 py-1 cursor-pointer"
                    title="Haz clic en la onda para saltar a ese instante"
                  >
                    {vadResult.waveformPreview.map((val, idx) => {
                      const barTime =
                        ((idx + 0.5) / Math.max(1, vadResult.waveformPreview.length)) *
                        vadResult.duration;
                      const isSilent = vadResult.silenceSegments.some(
                        (s) => barTime >= s.start && barTime <= s.end
                      );
                      return (
                        <div
                          key={idx}
                          onClick={() => onSeek(Math.round(barTime * 100) / 100)}
                          className={`flex-1 rounded-t-xs transition-opacity hover:opacity-80 ${
                            isSilent
                              ? 'bg-rose-500/45 dark:bg-rose-500/50'
                              : 'bg-cyan-500 dark:bg-cyan-400'
                          }`}
                          style={{ height: `${Math.max(10, Math.min(100, val))}%` }}
                          title={`${formatTimeDisplay(barTime)} · ${isSilent ? 'Silencio >1s' : 'Voz activa'}`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Detected Silence Intervals > 1s */}
                {vadResult.silenceSegments.length > 0 ? (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">
                      Segmentos de silencio detectados (&gt; 1s)
                    </span>
                    <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                      {vadResult.silenceSegments.map((sil) => (
                        <div
                          key={sil.id}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/70 dark:bg-neutral-900/70 border border-neutral-200/80 dark:border-neutral-800 text-[11px]"
                        >
                          <div className="flex items-center gap-2 font-mono text-neutral-700 dark:text-neutral-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                            <span>
                              {formatTimeDisplay(sil.start)} – {formatTimeDisplay(sil.end)}
                            </span>
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                              ({sil.duration.toFixed(1)}s)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onSeek(sil.start)}
                            className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                          >
                            Ir
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    No se detectaron silencios mayores a 1 segundo en esta pista.
                  </p>
                )}

                {/* Global Offset Suggestion Banner */}
                {vadComputedSuggestions.recommendedGlobalOffsetSeconds !== null && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2">
                    <div className="text-[11px]">
                      <p className="font-bold text-amber-700 dark:text-amber-300">
                        Desfase sistemático detectado:{' '}
                        <span className="font-mono">
                          {vadComputedSuggestions.recommendedGlobalOffsetSeconds >= 0 ? '+' : ''}
                          {vadComputedSuggestions.recommendedGlobalOffsetSeconds.toFixed(2)}s
                        </span>
                      </p>
                      <p className="text-[10px] text-neutral-600 dark:text-neutral-400">
                        Mueve todos los subtítulos juntos para alinearlos al inicio de voz.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleApplyGlobalVadOffset(
                          vadComputedSuggestions.recommendedGlobalOffsetSeconds as number
                        )
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-neutral-950 font-extrabold text-[10px] shrink-0 cursor-pointer"
                    >
                      Aplicar Global
                    </button>
                  </div>
                )}

                {/* Per-Cue Offset Suggestions */}
                {vadComputedSuggestions.suggestions.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                        {vadComputedSuggestions.suggestions.length} sugerencias de tiempo
                      </span>
                      <button
                        type="button"
                        onClick={handleApplyAllVadSuggestions}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer"
                      >
                        Aplicar Todas ({vadComputedSuggestions.suggestions.length})
                      </button>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {vadComputedSuggestions.suggestions.map((sug) => (
                        <div
                          key={sug.id}
                          className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                onSelectCue?.(sug.cueId);
                                onSeek(sug.currentStart);
                              }}
                              className="text-left min-w-0 flex-1 cursor-pointer group"
                            >
                              <span className="text-[11px] font-bold text-neutral-900 dark:text-neutral-100 block truncate group-hover:text-cyan-500">
                                #{sug.cueIndex} · {sug.cueText}
                              </span>
                            </button>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 shrink-0">
                              {sug.offsetSeconds >= 0 ? '+' : ''}
                              {sug.offsetSeconds.toFixed(2)}s
                            </span>
                          </div>

                          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-snug">
                            {sug.reason}
                          </p>

                          <div className="flex items-center justify-between gap-2 pt-0.5">
                            <span className="text-[10px] font-mono text-neutral-500">
                              {sug.currentStart.toFixed(2)}s→{sug.currentEnd.toFixed(2)}s{' '}
                              <strong className="text-emerald-600 dark:text-emerald-400">
                                ⇒ {sug.suggestedStart.toFixed(2)}s→{sug.suggestedEnd.toFixed(2)}s
                              </strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleApplySingleVadSuggestion(sug)}
                              className="px-2 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-[10px] font-bold cursor-pointer shrink-0"
                            >
                              Aplicar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    ✓ Todos los subtítulos actuales ya evitan los silencios &gt; 1s detectados.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Time Shift Sincronizador */}
          <div className="space-y-3 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
            <h4 className="font-extrabold text-xs text-neutral-900 dark:text-neutral-100 flex items-center gap-2 uppercase tracking-wider">
              <Clock className="w-4 h-4 text-indigo-500" />
              <span>Desplazamiento de Tiempos (Time Shift)</span>
            </h4>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Corrige desfases globales desplazando todos los subtítulos hacia adelante o atrás.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleApplyShift('backward')}
                className="flex-1 py-2 px-3 rounded-xl bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-xs font-bold cursor-pointer"
              >
                - {timeShiftOffset}s
              </button>
              <select
                value={timeShiftOffset}
                onChange={(e) => setTimeShiftOffset(parseFloat(e.target.value))}
                className="text-xs p-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 outline-none font-mono"
              >
                <option value={0.1}>0.1s</option>
                <option value={0.25}>0.25s</option>
                <option value={0.5}>0.5s</option>
                <option value={1.0}>1.0s</option>
                <option value={2.0}>2.0s</option>
              </select>
              <button
                onClick={() => handleApplyShift('forward')}
                className="flex-1 py-2 px-3 rounded-xl bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-xs font-bold cursor-pointer"
              >
                + {timeShiftOffset}s
              </button>
            </div>
          </div>

          {/* Restore Original 62 Song Cues Card */}
          {onRestoreSampleSubtitles && (
            <div className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-950/30 flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-xs text-indigo-900 dark:text-indigo-200 mb-0.5 flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Restaurar 62 Subtítulos de Canción</span>
                </h4>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Restaura los 62 bloques completos de "Digno Es El Cordero"
                </p>
              </div>
              <button
                onClick={onRestoreSampleSubtitles}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs active:scale-95 cursor-pointer shrink-0"
              >
                Restaurar 62
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
