import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  UploadCloud,
  Plus,
  ListVideo,
  User,
} from 'lucide-react';
import { SubtitleCue } from '../types/subtitle';
import { formatTimeDisplay } from '../utils/subtitleFormats';

interface TranscriptPanelProps {
  subtitles: SubtitleCue[];
  selectedCueId: string | number | null;
  currentTime: number;
  onSelectCue: (id: string | number) => void;
  onAddCueAtTime: (time: number) => void;
  onImportSrt: (file: File) => void;
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  subtitles,
  selectedCueId,
  currentTime,
  onSelectCue,
  onAddCueAtTime,
  onImportSrt,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Determine the active cue (explicitly selected or at playhead)
  const activeCue =
    subtitles.find((c) => selectedCueId !== null && selectedCueId !== undefined && String(c.id) === String(selectedCueId)) ||
    subtitles.find((c) => currentTime >= c.start - 0.05 && currentTime <= c.end + 0.05) ||
    null;

  // Smoothly keep the selected/active cue visible in the left script rail
  useEffect(() => {
    if (!activeCue || searchQuery.trim()) return;
    const el = itemRefs.current[String(activeCue.id)];
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeCue?.id, searchQuery]);

  const filteredSubtitles = subtitles.filter((cue) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      cue.text.toLowerCase().includes(q) ||
      (cue.speaker && cue.speaker.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-[#0e1017] select-none">
      {/* Header */}
      <div className="h-10 px-3 border-b border-neutral-200 dark:border-neutral-800/90 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ListVideo className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
            Guion
          </span>
          <span className="text-[11px] font-mono text-neutral-500">
            · {subtitles.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-md text-neutral-500 hover:text-indigo-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Importar archivo .SRT"
          >
            <UploadCloud className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onAddCueAtTime(currentTime)}
            className="p-1.5 rounded-md text-neutral-500 hover:text-indigo-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Añadir bloque en posición actual"
          >
            <Plus className="w-3.5 h-3.5" />
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

      {/* Search Bar */}
      <div className="p-2 border-b border-neutral-200/70 dark:border-neutral-800/80 shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            data-no-global-undo="true"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en el guion..."
            className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-md bg-neutral-100 dark:bg-[#08090d] border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Scrollable Cues List */}
      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/50">
        {subtitles.length === 0 ? (
          <div className="p-6 text-center text-xs text-neutral-500 space-y-2">
            <p className="font-medium text-neutral-700 dark:text-neutral-300">Guion vacío</p>
            <p className="text-[11px] leading-relaxed">
              Importa un archivo .SRT o genera subtítulos automáticos en la pestaña IA & Sinc.
            </p>
          </div>
        ) : filteredSubtitles.length === 0 ? (
          <div className="p-6 text-center text-xs text-neutral-500">
            Sin coincidencias para "{searchQuery}"
          </div>
        ) : (
          filteredSubtitles.map((cue) => {
            const globalIndex = subtitles.findIndex((c) => String(c.id) === String(cue.id));
            const isSelected = activeCue && String(activeCue.id) === String(cue.id);
            const isPlayheadInside = currentTime >= cue.start - 0.05 && currentTime <= cue.end + 0.05;

            return (
              <button
                key={cue.id}
                ref={(el) => {
                  itemRefs.current[String(cue.id)] = el;
                }}
                onClick={() => onSelectCue(cue.id)}
                className={`w-full text-left px-3 py-2.5 transition-colors cursor-pointer border-l-2 flex flex-col gap-1 ${
                  isSelected
                    ? 'bg-indigo-50/90 dark:bg-indigo-950/35 border-l-indigo-500'
                    : isPlayheadInside
                    ? 'bg-neutral-50 dark:bg-neutral-900/60 border-l-amber-400'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/40 border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                  <span
                    className={`font-bold ${
                      isSelected
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    #{globalIndex + 1}
                  </span>

                  <span className="text-neutral-500 dark:text-neutral-400">
                    {formatTimeDisplay(cue.start, true)} – {formatTimeDisplay(cue.end, true)}
                  </span>
                </div>

                <p
                  className={`text-xs leading-snug line-clamp-2 ${
                    isSelected
                      ? 'font-semibold text-neutral-950 dark:text-white'
                      : 'text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  {cue.text || <span className="italic text-neutral-400">(Vacío)</span>}
                </p>

                {cue.speaker && (
                  <div className="flex items-center gap-1 text-[10px] text-neutral-400 mt-0.5">
                    <User className="w-2.5 h-2.5" />
                    <span className="truncate">{cue.speaker}</span>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
