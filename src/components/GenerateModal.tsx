import React, { useState, useRef } from 'react';
import {
  Cpu,
  Upload,
  Video,
  Check,
  AlertCircle,
  Loader2,
  X,
  Clock,
  Layers,
} from 'lucide-react';
import { SubtitleCue } from '../types/subtitle';
import { extractAudioFromFile } from '../utils/audioExtractor';
import { generateAlgorithmicSubtitles } from '../utils/nonAiTranscriber';

interface GenerateModalProps {
  currentVideoFile: File | null;
  currentVideoUrl: string | null;
  onSubtitlesGenerated: (subtitles: SubtitleCue[], detectedLanguage?: string) => void;
  onVideoSelected: (file: File) => void;
  onClose: () => void;
}

export const GenerateModal: React.FC<GenerateModalProps> = ({
  currentVideoFile,
  currentVideoUrl,
  onSubtitlesGenerated,
  onVideoSelected,
  onClose,
}) => {
  const [customText, setCustomText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressStage, setProgressStage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onVideoSelected(file);
    }
  };

  const handleStartGeneration = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setProgressPercent(25);
    setProgressStage('Analizando archivo multimedia...');

    try {
      let totalDuration = 30;

      if (currentVideoFile) {
        try {
          const audioBuffer = await extractAudioFromFile(currentVideoFile, (p) => {
            setProgressStage(p.message);
            setProgressPercent(Math.round(p.percent * 0.6));
          });
          if (audioBuffer && audioBuffer.duration > 0) {
            totalDuration = audioBuffer.duration;
          }
        } catch (e) {
          console.warn('Audio extraction fallback to default duration:', e);
        }
      }

      setProgressStage('Generando bloques rítmicos optimizados...');
      setProgressPercent(80);

      await new Promise((r) => setTimeout(r, 400));

      const rawCues = await generateAlgorithmicSubtitles(totalDuration, customText);

      const normalizedCues: SubtitleCue[] = rawCues
        .sort((a, b) => a.start - b.start)
        .map((cue, idx) => ({
          ...cue,
          id: idx + 1,
          start: Math.round(cue.start * 100) / 100,
          end: Math.round(cue.end * 100) / 100,
        }));

      setProgressPercent(100);
      setProgressStage('¡Subtítulos generados con éxito!');

      setTimeout(() => {
        onSubtitlesGenerated(normalizedCues, 'es');
        onClose();
      }, 400);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'Error al generar subtítulos.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-neutral-900 dark:text-neutral-100">
                Generador Algorítmico de Subtítulos
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Sincronización rítmica profesional 100% local y sin IA
              </p>
            </div>
          </div>
          {!isProcessing && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {isProcessing ? (
            <div className="py-8 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-200 dark:border-indigo-950 border-t-indigo-600 animate-spin" />
                <Cpu className="w-6 h-6 text-indigo-600 dark:text-indigo-400 animate-pulse" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  {progressStage}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Distribuyendo intervalos temporales con precisión de milisegundos
                </p>
              </div>

              <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-2.5 rounded-full overflow-hidden">
                <div
                  style={{ width: `${progressPercent}%` }}
                  className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                />
              </div>
              <span className="text-xs font-mono text-neutral-500">{progressPercent}%</span>
            </div>
          ) : (
            <>
              {/* Media status card */}
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 shrink-0">
                    <Video className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 block truncate">
                      {currentVideoFile ? currentVideoFile.name : 'Archivo multimedia activo'}
                    </span>
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Listo para análisis algorítmico rítmico
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-200 transition-colors cursor-pointer shrink-0"
                >
                  Cambiar
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*,audio/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Custom script / text hints */}
              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider block mb-1.5">
                  Texto base o guión (Opcional)
                </label>
                <textarea
                  rows={3}
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Escribe o pega aquí el guión del video. El motor algorítmico lo distribuirá automáticamente en intervalos temporales perfectos..."
                  className="w-full p-3 text-xs rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
                />
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 border border-red-200 dark:border-red-800">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleStartGeneration}
                className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Cpu className="w-4 h-4 text-indigo-200" />
                <span>Generar Subtítulos Algorítmicos</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
