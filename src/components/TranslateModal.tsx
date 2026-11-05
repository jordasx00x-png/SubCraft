import React, { useState } from 'react';
import { Languages, Sparkles, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { SubtitleCue } from '../types/subtitle';

interface TranslateModalProps {
  subtitles: SubtitleCue[];
  currentLanguage: string;
  onTranslationComplete: (translatedCues: SubtitleCue[], targetLangName: string) => void;
  onClose: () => void;
}

const TARGET_LANGUAGES = [
  { code: 'en', name: 'English (Inglés)' },
  { code: 'es', name: 'Español (Spanish)' },
  { code: 'fr', name: 'Français (Francés)' },
  { code: 'pt', name: 'Português (Portugués)' },
  { code: 'de', name: 'Deutsch (Alemán)' },
  { code: 'it', name: 'Italiano (Italiano)' },
  { code: 'ja', name: '日本語 (Japonés)' },
  { code: 'zh', name: '中文 (Chino Simplificado)' },
  { code: 'ru', name: 'Русский (Ruso)' },
  { code: 'ko', name: '한국어 (Coreano)' },
  { code: 'ar', name: 'العربية (Árabe)' },
  { code: 'hi', name: 'हिन्दी (Hindi)' },
  { code: 'nl', name: 'Nederlands (Holandés)' },
  { code: 'tr', name: 'Türkçe (Turco)' },
];

export const TranslateModal: React.FC<TranslateModalProps> = ({
  subtitles,
  currentLanguage,
  onTranslationComplete,
  onClose,
}) => {
  const [targetLang, setTargetLang] = useState<string>('en');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleTranslate = async () => {
    if (!subtitles || subtitles.length === 0) {
      setErrorMessage('No hay subtítulos para traducir.');
      return;
    }

    setIsTranslating(true);
    setErrorMessage(null);

    try {
      const selectedObj = TARGET_LANGUAGES.find((l) => l.code === targetLang);
      const targetName = selectedObj ? selectedObj.name : targetLang;

      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtitles,
          targetLanguage: targetName,
          sourceLanguage: currentLanguage,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Error al traducir los subtítulos.');
      }

      const translated = data.data.subtitles as SubtitleCue[];
      // Keep exact timestamps if model slightly drifted
      const mergedWithOriginalTiming = subtitles.map((orig, i) => {
        const transCue = translated[i];
        return {
          ...orig,
          text: transCue ? transCue.text : orig.text,
        };
      });

      onTranslationComplete(mergedWithOriginalTiming, targetName);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error de traducción.');
      setIsTranslating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-500">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                Traducción Multilingüe con IA
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Adapta tus subtítulos a más de 14 idiomas al instante
              </p>
            </div>
          </div>
          {!isTranslating && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between text-xs">
            <span className="text-neutral-500 dark:text-neutral-400">Total de subtítulos:</span>
            <span className="font-bold font-mono text-neutral-800 dark:text-neutral-200">
              {subtitles.length} bloques
            </span>
          </div>

          <div>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider block mb-2">
              Seleccionar Idioma de Destino
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {TARGET_LANGUAGES.map((lang) => {
                const isSelected = targetLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => setTargetLang(lang.code)}
                    className={`p-2.5 rounded-xl text-left text-xs font-medium border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300 font-bold'
                        : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <span className="truncate">{lang.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3">
          {!isTranslating && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={handleTranslate}
            disabled={isTranslating}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 disabled:opacity-50 text-white shadow-sm shadow-sky-600/30 transition-all cursor-pointer flex items-center gap-2"
          >
            {isTranslating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Traduciendo subtítulos...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Traducir Ahora</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
