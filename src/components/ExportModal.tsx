import React, { useState, useRef } from 'react';
import {
  X,
  Download,
  FileText,
  Video,
  Check,
  Copy,
  Sparkles,
  AlertCircle,
  Loader2,
  Film,
} from 'lucide-react';
import { SubtitleCue, SubtitleStyle } from '../types/subtitle';
import { exportToSrt, exportToVtt, exportToTxt, downloadFile } from '../utils/subtitleFormats';
import { exportBurnedVideo } from '../utils/videoRenderer';

interface ExportModalProps {
  projectTitle: string;
  subtitles: SubtitleCue[];
  style: SubtitleStyle;
  videoUrl: string | null;
  videoDuration: number;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  projectTitle,
  subtitles,
  style,
  videoUrl,
  videoDuration,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'burned_video'>('files');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Video burn state
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportCurrentTime, setExportCurrentTime] = useState(0);
  const [exportStatusText, setExportStatusText] = useState('');
  const [exportedVideoBlob, setExportedVideoBlob] = useState<Blob | null>(null);
  const [videoResolution, setVideoResolution] = useState<'1080p' | '720p' | 'original'>('1080p');
  const [exportError, setExportError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const sanitizedTitle = (projectTitle || 'subtitulos').replace(/[^a-zA-Z0-9_\-\u00C0-\u017F]/g, '_');

  const handleDownloadSrt = () => {
    const content = exportToSrt(subtitles);
    downloadFile(content, `${sanitizedTitle}.srt`, 'text/plain;charset=utf-8');
  };

  const handleDownloadVtt = () => {
    const content = exportToVtt(subtitles);
    downloadFile(content, `${sanitizedTitle}.vtt`, 'text/vtt;charset=utf-8');
  };

  const handleDownloadTxt = () => {
    const content = exportToTxt(subtitles, true);
    downloadFile(content, `${sanitizedTitle}_transcripcion.txt`, 'text/plain;charset=utf-8');
  };

  const handleCopySrt = () => {
    const content = exportToSrt(subtitles);
    navigator.clipboard.writeText(content);
    setCopiedType('srt');
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleStartVideoBurn = async () => {
    if (!videoUrl) return;
    setIsExportingVideo(true);
    setExportProgress(0);
    setExportError(null);
    setExportedVideoBlob(null);

    abortControllerRef.current = new AbortController();

    try {
      const blob = await exportBurnedVideo(videoUrl, subtitles, style, {
        resolution: videoResolution,
        abortSignal: abortControllerRef.current.signal,
        onProgress: (percent, curTime) => {
          setExportProgress(percent);
          setExportCurrentTime(curTime);
        },
        onStatusChange: (status) => {
          setExportStatusText(status);
        },
      });

      setExportProgress(100);
      setExportedVideoBlob(blob);
      setIsExportingVideo(false);

      // Trigger download smoothly without locking main UI thread
      setTimeout(() => {
        downloadFile(blob, `${sanitizedTitle}_subtitulado.webm`, blob.type);
      }, 300);
    } catch (err: any) {
      if (err.message !== 'Export was cancelled by user.') {
        setExportError(err?.message || 'Error al procesar el video quemado');
      }
      setIsExportingVideo(false);
    }
  };

  const handleCancelVideoBurn = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                Centro de Exportación
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Descarga tus subtítulos en SRT o graba el video en alta resolución
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

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 px-6 pt-2">
          <button
            onClick={() => setActiveTab('files')}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'files'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Archivos de Subtítulos (.SRT, .VTT)</span>
          </button>

          <button
            onClick={() => setActiveTab('burned_video')}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'burned_video'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Video con Subtítulos Quemados</span>
          </button>
        </div>

        {/* Tab 1: Files */}
        {activeTab === 'files' && (
          <div className="p-6 space-y-4">
            {/* SRT card */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-xs font-mono">
                  SRT
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    Archivo SubRip (.SRT)
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Compatible con YouTube, Premiere Pro, Final Cut, CapCut y DaVinci
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopySrt}
                  className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                  title="Copiar texto SRT al portapapeles"
                >
                  {copiedType === 'srt' ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={handleDownloadSrt}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar .SRT</span>
                </button>
              </div>
            </div>

            {/* VTT card */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold text-xs font-mono">
                  VTT
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    Formato WebVTT (.VTT)
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Estándar moderno para reproductores web HTML5 y streaming
                  </p>
                </div>
              </div>

              <button
                onClick={handleDownloadVtt}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-100 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar .VTT</span>
              </button>
            </div>

            {/* Plain TXT transcript */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-xs font-mono">
                  TXT
                </div>
                <div>
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    Transcripción de Texto Plano (.TXT)
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Texto limpio con marcas de tiempo para notas o resúmenes
                  </p>
                </div>
              </div>

              <button
                onClick={handleDownloadTxt}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-800 dark:text-neutral-100 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar .TXT</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Burned-In Video */}
        {activeTab === 'burned_video' && (
          <div className="p-6 space-y-5">
            {!videoUrl ? (
              <div className="p-6 text-center border border-dashed border-neutral-300 dark:border-neutral-700 rounded-2xl">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Primero debes cargar un video para poder exportarlo con los subtítulos quemados.
                </p>
              </div>
            ) : isExportingVideo ? (
              /* Exporting Progress State */
              <div className="space-y-4 py-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center animate-pulse">
                  <Film className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    Grabando video en alta resolución...
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    {exportStatusText || 'Renderizando fotogramas y quemando subtítulos estilizados'}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-3 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${exportProgress}%` }}
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-200 rounded-full"
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-neutral-500 dark:text-neutral-400 px-1">
                  <span>{exportProgress}% completado</span>
                  <span>{exportCurrentTime.toFixed(1)}s / {videoDuration.toFixed(1)}s</span>
                </div>

                <button
                  onClick={handleCancelVideoBurn}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 hover:bg-red-100 transition-colors cursor-pointer"
                >
                  Cancelar proceso
                </button>
              </div>
            ) : exportedVideoBlob ? (
              /* Video Ready State */
              <div className="p-6 text-center space-y-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
                <div className="w-12 h-12 rounded-full bg-emerald-500 text-white mx-auto flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <Check className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    ¡Video renderizado con éxito!
                  </h3>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                    Los subtítulos han quedado integrados permanentemente con la tipografía y estilo elegidos.
                  </p>
                </div>

                <button
                  onClick={() =>
                    downloadFile(
                      exportedVideoBlob,
                      `${sanitizedTitle}_subtitulado.webm`,
                      exportedVideoBlob.type
                    )
                  }
                  className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Volver a descargar archivo de video</span>
                </button>
              </div>
            ) : (
              /* Settings & Start Export */
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      Resolución de renderizado
                    </span>
                    <select
                      value={videoResolution}
                      onChange={(e) => setVideoResolution(e.target.value as any)}
                      className="text-xs p-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none cursor-pointer"
                    >
                      <option value="1080p">1080p (Full HD - Recomendado)</option>
                      <option value="720p">720p (HD Rápido)</option>
                      <option value="original">Original del archivo</option>
                    </select>
                  </div>

                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 space-y-1">
                    <p>• Los subtítulos se dibujan directamente en los fotogramas del video con máxima nitidez.</p>
                    <p>• El procesamiento se realiza 100% de manera acelerada y privada en tu navegador.</p>
                  </div>
                </div>

                {exportError && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{exportError}</span>
                  </div>
                )}

                <button
                  onClick={handleStartVideoBurn}
                  className="w-full py-3 px-4 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Film className="w-4 h-4" />
                  <span>Generar y Quemar Subtítulos en Video</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
