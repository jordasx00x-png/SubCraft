import React, { useState } from 'react';
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
} from 'lucide-react';
import {
  SubtitleCue,
  SubtitleStyle,
  STYLE_PRESETS,
  SubtitlePreset,
  BackgroundLoopType,
} from '../types/subtitle';
import { formatTimeDisplay } from '../utils/subtitleFormats';

export type StudioTab = 'subtitles' | 'style' | 'loops' | 'tools';

interface StudioInspectorProps {
  activeTab: StudioTab;
  onChangeTab: (tab: StudioTab) => void;
  subtitles: SubtitleCue[];
  selectedCueId?: string | number | null;
  onSelectCue?: (id: string | number) => void;
  currentTime: number;
  duration: number;
  style: SubtitleStyle;
  onChangeStyle: (newStyle: SubtitleStyle) => void;
  onUpdateCue: (updatedCue: SubtitleCue) => void;
  onDeleteCue: (id: string | number) => void;
  onAddCue: (cue: SubtitleCue, index?: number) => void;
  onMergeWithNext: (index: number) => void;
  onSplitCue: (index: number) => void;
  onSeek: (time: number) => void;
  onPlaySpan: (start: number, end: number) => void;
  onImportSrt: (file: File) => void;
  onOpenGenerate: () => void;
  onOpenExport: () => void;
  onApplyTimeShift: (cues: SubtitleCue[]) => void;
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
  onSelectCue,
  currentTime,
  duration,
  style,
  onChangeStyle,
  onUpdateCue,
  onDeleteCue,
  onAddCue,
  onMergeWithNext,
  onSplitCue,
  onSeek,
  onPlaySpan,
  onImportSrt,
  onOpenGenerate,
  onOpenExport,
  onApplyTimeShift,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFullListModal, setShowFullListModal] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [timeShiftOffset, setTimeShiftOffset] = useState<number>(0.5);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const selectedCue =
    subtitles.find((c) => c.id === selectedCueId) ||
    subtitles.find((c) => currentTime >= c.start && currentTime <= c.end) ||
    subtitles[0] ||
    null;

  const selectedIndex = selectedCue ? subtitles.findIndex((c) => c.id === selectedCue.id) : -1;

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

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl flex flex-col h-full shadow-lg overflow-hidden select-none">
      {/* Tab Navigation Ribbon */}
      <div className="p-1.5 bg-neutral-100 dark:bg-neutral-950/80 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-1">
        <button
          onClick={() => onChangeTab('subtitles')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'subtitles'
              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm border border-neutral-200/80 dark:border-neutral-700/80'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
          title="Lista y edición de subtítulos"
        >
          <Subtitles className="w-4 h-4 text-indigo-500" />
          <span className="truncate">Subtítulos</span>
          <span className="text-[10px] text-neutral-400 font-mono">({subtitles.length})</span>
        </button>

        <button
          onClick={() => onChangeTab('style')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'style'
              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm border border-neutral-200/80 dark:border-neutral-700/80'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
          title="Tipografía y Estilos Visuales"
        >
          <Palette className="w-4 h-4 text-violet-500" />
          <span className="truncate">Estilo</span>
        </button>

        <button
          onClick={() => onChangeTab('loops')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'loops'
              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm border border-neutral-200/80 dark:border-neutral-700/80'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
          title="Modo Audio y Fondos en Bucle"
        >
          <Radio className="w-4 h-4 text-pink-500" />
          <span className="truncate">Fondos</span>
          {style.isAudioMode && (
            <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => onChangeTab('tools')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'tools'
              ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm border border-neutral-200/80 dark:border-neutral-700/80'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
          title="Herramientas y Motor Algorítmico"
        >
          <Cpu className="w-4 h-4 text-emerald-500" />
          <span className="truncate">Herramientas</span>
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-4 py-2 text-xs flex items-center gap-2 border-b border-emerald-200 dark:border-emerald-800">
          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* TAB 1: SINGLE SELECTED SUBTITLE CUE INSPECTOR */}
      {activeTab === 'subtitles' && (
        <div className="flex-1 flex flex-col min-h-0 bg-neutral-50/50 dark:bg-neutral-900/40 p-4 overflow-y-auto space-y-4">
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
          ) : selectedCue ? (
            <div className="space-y-2.5">
              {/* Cue Selector & Navigation Ribbon */}
              <div className="p-2 bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 flex items-center justify-between shadow-2xs">
                <button
                  disabled={selectedIndex <= 0}
                  onClick={() => {
                    const prev = subtitles[selectedIndex - 1];
                    if (prev) {
                      onSeek(prev.start);
                      onSelectCue?.(prev.id);
                    }
                  }}
                  className="px-2 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 disabled:opacity-30 cursor-pointer flex items-center gap-1 text-[11px] font-bold text-neutral-700 dark:text-neutral-200 transition-colors"
                  title="Subtítulo anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>

                <div className="text-center">
                  <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 block uppercase tracking-wider">
                    Subtítulo #{selectedIndex + 1} de {subtitles.length}
                  </span>
                  <span className="text-[9px] text-neutral-500 dark:text-neutral-400 font-mono">
                    {formatTimeDisplay(selectedCue.start, true)} ➔ {formatTimeDisplay(selectedCue.end, true)}
                  </span>
                </div>

                <button
                  disabled={selectedIndex >= subtitles.length - 1}
                  onClick={() => {
                    const next = subtitles[selectedIndex + 1];
                    if (next) {
                      onSeek(next.start);
                      onSelectCue?.(next.id);
                    }
                  }}
                  className="px-2 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 disabled:opacity-30 cursor-pointer flex items-center gap-1 text-[11px] font-bold text-neutral-700 dark:text-neutral-200 transition-colors"
                  title="Subtítulo siguiente"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Selected Cue Text Editor Card */}
              <div className="p-3 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 font-bold text-neutral-800 dark:text-neutral-200">
                    <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Texto del Subtítulo</span>
                  </div>

                  <span className={`font-mono text-[9px] px-2 py-0.5 rounded-full ${
                    selectedCue.text.length > 45
                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-bold'
                      : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500'
                  }`}>
                    {selectedCue.text.length} chars
                  </span>
                </div>

                <textarea
                  value={selectedCue.text}
                  onChange={(e) => onUpdateCue({ ...selectedCue, text: e.target.value })}
                  rows={2}
                  placeholder="Escribe aquí el texto del subtítulo..."
                  className="w-full p-2.5 text-xs font-medium rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none resize-none leading-normal transition-all"
                />

                {/* Speaker Tag Field */}
                <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-900 p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <User className="w-3 h-3 text-neutral-400 shrink-0 ml-1" />
                  <input
                    type="text"
                    placeholder="Hablante (opcional)"
                    value={selectedCue.speaker || ''}
                    onChange={(e) => onUpdateCue({ ...selectedCue, speaker: e.target.value })}
                    className="w-full text-[10px] bg-transparent outline-none text-neutral-800 dark:text-neutral-200 placeholder-neutral-400"
                  />
                </div>
              </div>

              {/* Timing Step Controls */}
              <div className="p-3 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-neutral-800 dark:text-neutral-200">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Control de Tiempos</span>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-500">
                    Duración: {Math.round((selectedCue.end - selectedCue.start) * 10) / 10}s
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Start time */}
                  <div className="p-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-neutral-500">Inicio</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleTimeStep(selectedCue, 'start', -0.1)}
                        className="w-5 h-5 rounded bg-white dark:bg-neutral-800 font-bold text-neutral-700 dark:text-neutral-200 text-[10px] hover:bg-indigo-50"
                      >
                        -
                      </button>
                      <span
                        onClick={() => onSeek(selectedCue.start)}
                        className="text-[11px] font-mono font-bold text-neutral-800 dark:text-neutral-200 cursor-pointer hover:underline"
                      >
                        {formatTimeDisplay(selectedCue.start, true)}
                      </span>
                      <button
                        onClick={() => handleTimeStep(selectedCue, 'start', 0.1)}
                        className="w-5 h-5 rounded bg-white dark:bg-neutral-800 font-bold text-neutral-700 dark:text-neutral-200 text-[10px] hover:bg-indigo-50"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* End time */}
                  <div className="p-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-neutral-500">Fin</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleTimeStep(selectedCue, 'end', -0.1)}
                        className="w-5 h-5 rounded bg-white dark:bg-neutral-800 font-bold text-neutral-700 dark:text-neutral-200 text-[10px] hover:bg-indigo-50"
                      >
                        -
                      </button>
                      <span
                        onClick={() => onSeek(selectedCue.end)}
                        className="text-[11px] font-mono font-bold text-neutral-800 dark:text-neutral-200 cursor-pointer hover:underline"
                      >
                        {formatTimeDisplay(selectedCue.end, true)}
                      </span>
                      <button
                        onClick={() => handleTimeStep(selectedCue, 'end', 0.1)}
                        className="w-5 h-5 rounded bg-white dark:bg-neutral-800 font-bold text-neutral-700 dark:text-neutral-200 text-[10px] hover:bg-indigo-50"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  onClick={() => onPlaySpan(selectedCue.start, selectedCue.end)}
                  className="py-1.5 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  title="Escuchar Segmento"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Play</span>
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
                  className="py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  title="Añadir subtítulo siguiente"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">+Nuevo</span>
                </button>

                <button
                  onClick={() => onSplitCue(selectedIndex)}
                  className="py-1.5 px-2 rounded-xl bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-100 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  title="Dividir subtítulo"
                >
                  <Scissors className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden sm:inline">Dividir</span>
                </button>

                <button
                  onClick={() => onDeleteCue(selectedCue.id)}
                  className="py-1.5 px-2 rounded-xl bg-red-100 dark:bg-red-950/60 hover:bg-red-200 dark:hover:bg-red-900 text-red-600 dark:text-red-300 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                  title="Eliminar subtítulo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Borrar</span>
                </button>
              </div>

              {/* Bottom Drawer Toggle for Full List */}
              <div className="pt-1.5 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500">
                <button
                  onClick={() => setShowFullListModal(true)}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 font-bold cursor-pointer"
                >
                  <ListFilter className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Ver lista completa SRT ({subtitles.length})</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 font-medium cursor-pointer"
                >
                  <UploadCloud className="w-3 h-3" />
                  <span>SRT</span>
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
                          onSeek(cue.start);
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
                <span>Tamaño</span>
                <span className="font-mono text-neutral-800 dark:text-neutral-200">{style.fontSize}px</span>
              </div>
              <input
                type="range"
                min={16}
                max={44}
                value={style.fontSize}
                onChange={(e) => updateStyle('fontSize', parseInt(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
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

          <div className="space-y-2.5">
            <label className="text-xs font-extrabold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider block">
              Posición Vertical
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['top', 'middle', 'bottom'] as const).map((pos) => (
                <button
                  key={pos}
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
          {/* Algorithmic Generator Trigger */}
          <div className="p-5 rounded-3xl border border-indigo-200 dark:border-indigo-800/60 bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-md">
                <Cpu className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white">Generador Algorítmico Automático</h4>
                <p className="text-xs text-indigo-100">Sincronización rítmica instantánea sin IA</p>
              </div>
            </div>
            <button
              onClick={onOpenGenerate}
              className="w-full py-3 px-4 text-xs font-extrabold rounded-2xl bg-white hover:bg-neutral-100 text-indigo-950 transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Ejecutar Generador Algorítmico</span>
            </button>
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

          {/* Export Hub Shortcut */}
          <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex items-center justify-between">
            <div>
              <h4 className="font-extrabold text-xs text-neutral-900 dark:text-neutral-100 mb-0.5">
                Exportar Proyecto
              </h4>
              <p className="text-[11px] text-neutral-500">
                Descarga en .SRT, .VTT o quema en video HD
              </p>
            </div>
            <button
              onClick={onOpenExport}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md active:scale-95 cursor-pointer"
            >
              Exportar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
