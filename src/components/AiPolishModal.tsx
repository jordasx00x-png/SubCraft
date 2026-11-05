import React, { useState } from 'react';
import { Sparkles, Check, X, Loader2, AlertCircle, Wand2, Smile, Zap } from 'lucide-react';
import { SubtitleCue } from '../types/subtitle';

interface AiPolishModalProps {
  subtitles: SubtitleCue[];
  onApplyPolishedSubtitles: (polished: SubtitleCue[]) => void;
  onClose: () => void;
}

export const AiPolishModal: React.FC<AiPolishModalProps> = ({
  subtitles,
  onApplyPolishedSubtitles,
  onClose,
}) => {
  const [selectedAction, setSelectedAction] = useState<'polish' | 'shorten' | 'add_emojis' | 'fix_grammar'>('polish');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const actions = [
    {
      id: 'polish',
      title: 'Perfeccionar y Fluidizar',
      desc: 'Mejora la redacción, ritmo y puntuación manteniendo el significado exacto.',
      icon: Sparkles,
      color: 'text-amber-500 bg-amber-500/10',
    },
    {
      id: 'shorten',
      title: 'Formato Rápido (Reels / TikTok)',
      desc: 'Recorta palabras de relleno para que los subtítulos sean súper directos y dinámicos.',
      icon: Zap,
      color: 'text-indigo-500 bg-indigo-500/10',
    },
    {
      id: 'add_emojis',
      title: 'Añadir Emojis Expresivos',
      desc: 'Inserta emojis pertinentes en puntos clave para aumentar la retención del espectador.',
      icon: Smile,
      color: 'text-pink-500 bg-pink-500/10',
    },
    {
      id: 'fix_grammar',
      title: 'Corrección Gramatical Estricta',
      desc: 'Corrige tildes, comas, concordancia verbal y mayúsculas de manera académica.',
      icon: Wand2,
      color: 'text-emerald-500 bg-emerald-500/10',
    },
  ] as const;

  const handleApply = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/ai-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: selectedAction,
          subtitles,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Error al procesar la acción de IA.');
      }

      const polished = data.data.subtitles as SubtitleCue[];
      // Keep exact timestamps
      const merged = subtitles.map((orig, i) => ({
        ...orig,
        text: polished[i]?.text || orig.text,
      }));

      onApplyPolishedSubtitles(merged);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al aplicar cambios con IA.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                Mejora Inteligente con IA
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Optimiza la lectura, ortografía y dinamismo de todos los subtítulos
              </p>
            </div>
          </div>
          {!isLoading && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-3">
          {actions.map((act) => {
            const isSelected = selectedAction === act.id;
            const Icon = act.icon;
            return (
              <div
                key={act.id}
                onClick={() => setSelectedAction(act.id)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-xs'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-neutral-50/40 dark:bg-neutral-800/30'
                }`}
              >
                <div className={`p-2.5 rounded-xl ${act.color} shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                      {act.title}
                    </h4>
                    {isSelected && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
                    {act.desc}
                  </p>
                </div>
              </div>
            );
          })}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3">
          {!isLoading && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={handleApply}
            disabled={isLoading}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-50 text-white shadow-sm shadow-indigo-600/30 transition-all cursor-pointer flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Aplicando mejoras con IA...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Aplicar a Todos los Subtítulos</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
