import React, { useState } from 'react';
import {
  Video,
  Upload,
  Link,
  Play,
  X,
  Loader2,
  Check,
  AlertCircle,
  DownloadCloud,
  Clock,
  Sparkles,
} from 'lucide-react';

interface AddVideoModalProps {
  onVideoFileSelected: (file: File) => void;
  onVideoBlobUrlLoaded: (url: string, title: string, duration?: number) => void;
  onLoadSampleVideo: () => void;
  onClose: () => void;
}

interface YouTubePreview {
  title: string;
  duration: number;
  thumbnail: string;
  author: string;
  videoId: string;
}

export const AddVideoModal: React.FC<AddVideoModalProps> = ({
  onVideoFileSelected,
  onVideoBlobUrlLoaded,
  onLoadSampleVideo,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'youtube' | 'local'>('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<string>('');
  const [previewData, setPreviewData] = useState<YouTubePreview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFetchPreview = async () => {
    if (!youtubeUrl.trim()) {
      setErrorMessage('Por favor ingresa un enlace de YouTube.');
      return;
    }

    setIsLoadingPreview(true);
    setErrorMessage(null);
    setPreviewData(null);

    try {
      const res = await fetch(`/api/youtube/info?url=${encodeURIComponent(youtubeUrl.trim())}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'No se pudo obtener la información de este video de YouTube.');
      }

      setPreviewData(data.data);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al conectar con YouTube.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDownloadAndAddYouTube = async () => {
    if (!youtubeUrl.trim()) return;

    setIsDownloading(true);
    setErrorMessage(null);
    setDownloadProgress('Iniciando descarga del flujo MP4 desde YouTube...');

    try {
      setDownloadProgress('Descargando fotogramas y pista de audio en MP4...');
      const downloadEndpoint = `/api/youtube/download?url=${encodeURIComponent(youtubeUrl.trim())}`;
      const response = await fetch(downloadEndpoint);

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error || 'No se pudo completar la descarga del video.');
      }

      setDownloadProgress('Generando archivo local para el reproductor...');
      const videoBlob = await response.blob();

      const videoTitle = previewData?.title || 'Video_YouTube.mp4';
      const videoFile = new File([videoBlob], `${videoTitle.replace(/[^a-zA-Z0-9_\-\u00C0-\u017F]/g, '_')}.mp4`, {
        type: 'video/mp4',
      });

      // Pass as actual File so audio extraction works natively!
      onVideoFileSelected(videoFile);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'Error al descargar el video de YouTube en MP4.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onVideoFileSelected(file);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-500">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                Añadir Video a Subtitular
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Pega un enlace de YouTube o sube un archivo desde tu dispositivo
              </p>
            </div>
          </div>
          {!isDownloading && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 px-6 pt-2">
          <button
            onClick={() => setActiveTab('youtube')}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'youtube'
                ? 'border-red-600 text-red-600 dark:text-red-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            <span>Enlace de YouTube</span>
          </button>

          <button
            onClick={() => setActiveTab('local')}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'local'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Subir Video o Solo Audio</span>
          </button>
        </div>

        {/* Tab 1: YouTube */}
        {activeTab === 'youtube' && (
          <div className="p-6 space-y-4">
            <div>
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider block mb-2">
                Pega el Enlace del Video de YouTube
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=... o https://youtu.be/..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFetchPreview()}
                    disabled={isDownloading}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:border-red-500 focus:bg-white dark:focus:bg-neutral-800 outline-none transition-all text-neutral-800 dark:text-neutral-100"
                  />
                </div>
                <button
                  onClick={handleFetchPreview}
                  disabled={isLoadingPreview || isDownloading || !youtubeUrl.trim()}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-neutral-800 dark:bg-neutral-700 hover:bg-neutral-700 dark:hover:bg-neutral-600 disabled:opacity-50 text-white transition-colors cursor-pointer shrink-0"
                >
                  {isLoadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
                </button>
              </div>
            </div>

            {/* Preview Card */}
            {previewData && (
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 flex gap-3 animate-in fade-in duration-200">
                <img
                  src={previewData.thumbnail}
                  alt={previewData.title}
                  className="w-28 h-18 rounded-xl object-cover bg-black shrink-0 border border-neutral-300 dark:border-neutral-700"
                />
                <div className="flex flex-col justify-between truncate py-0.5">
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 line-clamp-2 leading-tight">
                      {previewData.title}
                    </h4>
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block mt-1">
                      {previewData.author}
                    </span>
                  </div>

                  {previewData.duration > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-neutral-400 font-mono">
                      <Clock className="w-3 h-3 text-red-500" />
                      <span>{Math.floor(previewData.duration / 60)}m {previewData.duration % 60}s</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Downloading State */}
            {isDownloading && (
              <div className="p-4 rounded-2xl bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-red-600 mx-auto" />
                <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  {downloadProgress}
                </p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  El video se convertirá a MP4 y se cargará en el reproductor para subtitular con IA
                </p>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Action button */}
            <button
              onClick={handleDownloadAndAddYouTube}
              disabled={isDownloading || !youtubeUrl.trim()}
              className="w-full py-3 px-4 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 active:scale-98 disabled:opacity-50 text-white shadow-md shadow-red-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando video de YouTube...</span>
                </>
              ) : (
                <>
                  <DownloadCloud className="w-4 h-4" />
                  <span>Descargar Video en MP4 y Añadir</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Tab 2: Local Video or Audio File */}
        {activeTab === 'local' && (
          <div className="p-6 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,audio/*"
              className="hidden"
              onChange={handleLocalFileChange}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-8 border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl text-center cursor-pointer transition-colors bg-neutral-50/50 dark:bg-neutral-800/20"
            >
              <Upload className="w-10 h-10 text-indigo-500 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-1">
                Haz clic para subir un video o audio
              </h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Soporta videos (MP4, WebM, MOV) o solo audio (MP3, WAV, M4A) para usar con fondos animados en bucle
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-neutral-500">¿No tienes un video a mano?</span>
              <button
                onClick={() => {
                  onLoadSampleVideo();
                  onClose();
                }}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Usar video de muestra (5 min)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
