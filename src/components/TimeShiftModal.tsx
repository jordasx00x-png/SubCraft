import React, { useState } from 'react';
import { Clock, X, Check, FastForward, Rewind } from 'lucide-react';
import { SubtitleCue } from '../types/subtitle';

interface TimeShiftModalProps {
  subtitles: SubtitleCue[];
  onApplyTimeShift: (shiftedCues: SubtitleCue[]) => void;
  onClose: () => void;
}

export const TimeShiftModal: React.FC<TimeShiftModalProps> = ({
  subtitles,
  onApplyTimeShift,
  onClose,
}) => {
  const [offsetSec, setOffsetSec] = useState<number>(0.5);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  const handleApply = () => {
    const shift = direction === 'forward' ? offsetSec : -offsetSec;
    const shifted = subtitles.map((cue) => {
      const nextStart = Math.max(0, Math.round((cue.start + shift) * 100) / 100);
      const nextEnd = Math.max(nextStart + 0.5, Math.round((cue.end + shift) * 100) / 100);
      return {
        ...cue,
        start: nextStart,
        end: nextEnd,
      };
    });

    onApplyTimeShift(shifted);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                Desfase de Tiempo
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Ajusta la sincronización general
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider block mb-2">
              Dirección del Desfase
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDirection('forward')}
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  direction === 'forward'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <FastForward className="w-4 h-4" />
                <span>Avanzar (+)</span>
              </button>
              <button
                onClick={() => setDirection('backward')}
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  direction === 'backward'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <Rewind className="w-4 h-4" />
                <span>Retrasar (-)</span>
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-neutral-700 dark:text-neutral-300 mb-1 font-semibold">
              <span>Cantidad en segundos:</span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                {offsetSec.toFixed(2)}s
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={5.0}
              step={0.1}
              value={offsetSec}
              onChange={(e) => setOffsetSec(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>

          <div className="flex items-center gap-2">
            {[0.2, 0.5, 1.0, 2.0].map((val) => (
              <button
                key={val}
                onClick={() => setOffsetSec(val)}
                className={`flex-1 py-1 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
                  offsetSec === val
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                {val}s
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Aplicar desfase</span>
          </button>
        </div>
      </div>
    </div>
  );
};
