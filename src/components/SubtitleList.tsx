import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Play,
  Scissors,
  Layers,
  Sparkles,
  Clock,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  UploadCloud,
  Wand2,
  Check,
} from 'lucide-react';
import { SubtitleCue } from '../types/subtitle';
import { formatTimeDisplay, parseTimeToSeconds } from '../utils/subtitleFormats';

interface SubtitleListProps {
  subtitles: SubtitleCue[];
  currentTime: number;
  onUpdateCue: (updatedCue: SubtitleCue) => void;
  onDeleteCue: (id: string | number) => void;
  onAddCue: (cue: SubtitleCue, index?: number) => void;
  onMergeWithNext: (index: number) => void;
  onSplitCue: (index: number) => void;
  onSeek: (time: number) => void;
  onPlaySpan: (start: number, end: number) => void;
  onOpenAiPolish: () => void;
  onOpenTimeShift: () => void;
  onImportSrt: (file: File) => void;
}

export const SubtitleList: React.FC<SubtitleListProps> = ({
  subtitles,
  currentTime,
  onUpdateCue,
  onDeleteCue,
  onAddCue,
  onMergeWithNext,
  onSplitCue,
  onSeek,
  onPlaySpan,
  onOpenAiPolish,
  onOpenTimeShift,
  onImportSrt,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeCardRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Active cue index
  const activeCue = subtitles.find((c) => currentTime >= c.start && currentTime <= c.end);

  // Auto-scroll to active cue if enabled
  useEffect(() => {
    if (autoScroll && activeCardRef.current && listContainerRef.current) {
      activeCardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [activeCue?.id, autoScroll]);

  // Filter cues based on search
  const filteredCues = subtitles.filter((cue) =>
    cue.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (cue.speaker && cue.speaker.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleTimeChange = (cue: SubtitleCue, field: 'start' | 'end', delta: number) => {
    const nextVal = Math.max(0, Math.round((cue[field] + delta) * 100) / 100);
    if (field === 'start' && nextVal >= cue.end) return;
    if (field === 'end' && nextVal <= cue.start) return;

    onUpdateCue({
      ...cue,
      [field]: nextVal,
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportSrt(file);
      e.target.value = '';
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col h-full shadow-sm overflow-hidden select-none">
      {/* Top Header & Search */}
      <div className="p-3.5 border-b border-neutral-200 dark:border-neutral-800 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <span>Editor de Subtítulos</span>
              <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                {subtitles.length}
              </span>
            </h3>
          </div>

          <div className="flex items-center gap-1.5">
            {/* AI Polish */}
            <button
              onClick={onOpenAiPolish}
              className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
              title="Perfeccionar y corregir subtítulos con IA"
            >
              <Sparkles className="w-4 h-4" />
            </button>

            {/* Time Shift */}
            <button
              onClick={onOpenTimeShift}
              className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Ajustar desfase de tiempo para todos los subtítulos"
            >
              <Clock className="w-4 h-4" />
            </button>

            {/* Import SRT */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Importar archivo .SRT existente"
            >
              <UploadCloud className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".srt"
              className="hidden"
              onChange={handleFileInputChange}
            />

            {/* Auto-scroll toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                autoScroll
                  ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40'
                  : 'text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
              title="Seguimiento automático de reproducción"
            >
              Auto-Scroll
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar en el texto de los subtítulos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-100 dark:bg-neutral-800/60 rounded-xl border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-neutral-800 outline-none transition-all text-neutral-800 dark:text-neutral-200"
          />
          {searchQuery && (
            <span className="absolute right-3 top-2 text-[10px] text-neutral-400">
              {filteredCues.length} resultado(s)
            </span>
          )}
        </div>
      </div>

      {/* Subtitles Scrollable List */}
      <div
        ref={listContainerRef}
        className="flex-1 overflow-y-auto p-3 space-y-2.5 divide-y divide-neutral-100 dark:divide-neutral-800/60"
      >
        {filteredCues.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-neutral-400 dark:text-neutral-500">
            <p className="text-sm">
              {searchQuery ? 'No se encontraron subtítulos coincidentes.' : 'Aún no hay subtítulos.'}
            </p>
            <button
              onClick={() =>
                onAddCue({
                  id: Date.now(),
                  start: Math.max(0, currentTime),
                  end: Math.max(0, currentTime) + 3,
                  text: 'Nuevo subtítulo...',
                })
              }
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir subtítulo</span>
            </button>
          </div>
        ) : (
          filteredCues.map((cue, index) => {
            const isActive = activeCue?.id === cue.id;
            const duration = Math.max(0, cue.end - cue.start);
            const isTooFast = duration > 0 && cue.text.length / duration > 24;

            return (
              <div
                key={cue.id}
                ref={isActive ? activeCardRef : null}
                className={`pt-2.5 transition-all duration-150 ${
                  isActive
                    ? 'p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 shadow-xs'
                    : 'p-2 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/40 border border-transparent'
                }`}
              >
                {/* Header row: Index, Time steppers, Play & actions */}
                <div className="flex items-center justify-between text-xs mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-[11px] font-mono font-bold text-neutral-400 dark:text-neutral-500">
                      #{index + 1}
                    </span>

                    {/* Time Start with steppers */}
                    <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
                      <span>{formatTimeDisplay(cue.start, true)}</span>
                      <div className="flex flex-col ml-0.5">
                        <button
                          onClick={() => handleTimeChange(cue, 'start', 0.1)}
                          className="hover:text-indigo-500"
                          title="+0.1s"
                        >
                          <ChevronUp className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => handleTimeChange(cue, 'start', -0.1)}
                          className="hover:text-indigo-500"
                          title="-0.1s"
                        >
                          <ChevronDown className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>

                    <ArrowRight className="w-3 h-3 text-neutral-400" />

                    {/* Time End with steppers */}
                    <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
                      <span>{formatTimeDisplay(cue.end, true)}</span>
                      <div className="flex flex-col ml-0.5">
                        <button
                          onClick={() => handleTimeChange(cue, 'end', 0.1)}
                          className="hover:text-indigo-500"
                          title="+0.1s"
                        >
                          <ChevronUp className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => handleTimeChange(cue, 'end', -0.1)}
                          className="hover:text-indigo-500"
                          title="-0.1s"
                        >
                          <ChevronDown className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>

                    {/* Duration badge */}
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        isTooFast
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 font-bold'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                      }`}
                      title={isTooFast ? 'Mucho texto para poca duración (lectura rápida)' : 'Duración del subtítulo'}
                    >
                      {duration.toFixed(1)}s
                    </span>
                  </div>

                  {/* Actions for this cue */}
                  <div className="flex items-center gap-1">
                    {/* Play Span */}
                    <button
                      onClick={() => onPlaySpan(cue.start, cue.end)}
                      className="p-1 rounded text-neutral-500 hover:text-indigo-600 dark:text-neutral-400 dark:hover:text-indigo-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                      title="Reproducir este subtítulo"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>

                    {/* Split Cue */}
                    <button
                      onClick={() => onSplitCue(index)}
                      className="p-1 rounded text-neutral-500 hover:text-indigo-600 dark:text-neutral-400 dark:hover:text-indigo-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                      title="Dividir en 2 subtítulos"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                    </button>

                    {/* Merge with next */}
                    {index < subtitles.length - 1 && (
                      <button
                        onClick={() => onMergeWithNext(index)}
                        className="p-1 rounded text-neutral-500 hover:text-indigo-600 dark:text-neutral-400 dark:hover:text-indigo-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                        title="Unir con el siguiente subtítulo"
                      >
                        <Layers className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => onDeleteCue(cue.id)}
                      className="p-1 rounded text-neutral-400 hover:text-red-500 dark:text-neutral-500 dark:hover:text-red-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                      title="Eliminar subtítulo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Subtitle Textarea */}
                <div className="relative">
                  <textarea
                    value={cue.text}
                    onChange={(e) => onUpdateCue({ ...cue, text: e.target.value })}
                    onFocus={() => onSeek(cue.start)}
                    rows={2}
                    className="w-full text-xs sm:text-sm p-2 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-neutral-900 dark:text-neutral-100 resize-none transition-all leading-relaxed"
                    placeholder="Escribe el subtítulo aquí..."
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Footer: Add cue button */}
      <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between">
        <span className="text-[11px] text-neutral-400">
          Posición actual: <strong className="font-mono text-neutral-600 dark:text-neutral-300">{formatTimeDisplay(currentTime, true)}</strong>
        </span>

        <button
          onClick={() => {
            const nextStart = Math.max(0, currentTime);
            onAddCue({
              id: Date.now(),
              start: nextStart,
              end: nextStart + 3,
              text: 'Nuevo subtítulo...',
            });
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Insertar aquí</span>
        </button>
      </div>
    </div>
  );
};
