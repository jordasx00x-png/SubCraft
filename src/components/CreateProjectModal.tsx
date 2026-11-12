import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Video,
  Music,
  Sparkles,
  Link as LinkIcon,
  Clock,
  Check,
  AlertCircle,
  FileText,
  Layers,
  ArrowRight,
  Radio,
  Sliders,
} from 'lucide-react';
import { SubtitlePreset, STYLE_PRESETS, DEFAULT_STYLE, SubtitleStyle } from '../types/subtitle';
import { SAMPLE_VIDEO_URL, SAMPLE_VIDEO_NAME, INITIAL_SAMPLE_SUBTITLES } from '../utils/sampleData';

interface CreateProjectModalProps {
  onClose: () => void;
  onCreateProject: (projectData: {
    title: string;
    mediaFile: File | null;
    mediaUrl: string | null;
    mediaFileName: string;
    duration?: number;
    language: string;
    isAudioMode: boolean;
    style?: SubtitleStyle;
    preset?: SubtitlePreset;
    initialSubtitles?: any[];
  }) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  onClose,
  onCreateProject,
}) => {
  const [projectTitle, setProjectTitle] = useState('Nuevo Proyecto de Subtítulos');
  const [language, setLanguage] = useState('es');
  const [selectedPreset, setSelectedPreset] = useState<SubtitlePreset>('viral-yellow');
  const [mediaType, setMediaType] = useState<'video' | 'audio' | 'demo'>('video');
  
  // Media source state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isLoadingYoutube, setIsLoadingYoutube] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [youtubePreview, setYoutubePreview] = useState<{
    title: string;
    duration: number;
    thumbnail?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-set title from filename if title is default
      if (projectTitle === 'Nuevo Proyecto de Subtítulos' || !projectTitle.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_\\-]/g, ' ');
        setProjectTitle(cleanName);
      }
      const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name);
      if (isAudio) {
        setMediaType('audio');
      } else {
        setMediaType('video');
      }
    }
  };

  const handleFetchYoutube = async () => {
    if (!youtubeUrl.trim()) return;
    setIsLoadingYoutube(true);
    setYoutubeError(null);
    try {
      const res = await fetch(`/api/youtube/info?url=${encodeURIComponent(youtubeUrl.trim())}`);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'No se pudo obtener información del video');
      }
      setYoutubePreview({
        title: data.data.title,
        duration: data.data.duration,
        thumbnail: data.data.thumbnail,
      });
      if (projectTitle === 'Nuevo Proyecto de Subtítulos') {
        setProjectTitle(data.data.title);
      }
    } catch (err: any) {
      setYoutubeError(err?.message || 'Error al conectar con YouTube');
    } finally {
      setIsLoadingYoutube(false);
    }
  };

  const handleCreate = async () => {
    const presetStyle = STYLE_PRESETS[selectedPreset] || DEFAULT_STYLE;
    const finalStyle: SubtitleStyle = {
      ...presetStyle,
      isAudioMode: mediaType === 'audio',
      backgroundLoop: presetStyle.backgroundLoop || 'aurora-gradient',
      showAudioVisualizer: true,
    };

    if (mediaType === 'demo') {
      onCreateProject({
        title: projectTitle.trim() || 'Proyecto Demo Canción',
        mediaFile: null,
        mediaUrl: SAMPLE_VIDEO_URL,
        mediaFileName: SAMPLE_VIDEO_NAME,
        duration: 454,
        language,
        isAudioMode: true,
        style: finalStyle,
        preset: selectedPreset,
        initialSubtitles: INITIAL_SAMPLE_SUBTITLES,
      });
      return;
    }

    if (selectedFile) {
      const blobUrl = URL.createObjectURL(selectedFile);
      onCreateProject({
        title: projectTitle.trim() || selectedFile.name,
        mediaFile: selectedFile,
        mediaUrl: blobUrl,
        mediaFileName: selectedFile.name,
        language,
        isAudioMode: mediaType === 'audio',
        style: finalStyle,
        preset: selectedPreset,
      });
      return;
    }

    if (youtubePreview && youtubeUrl) {
      try {
        setIsLoadingYoutube(true);
        const res = await fetch(`/api/youtube/download?url=${encodeURIComponent(youtubeUrl.trim())}`);
        const blob = await res.blob();
        const downloadedFile = new File([blob], `${youtubePreview.title.replace(/[^a-zA-Z0-9_\-\u00C0-\u017F]/g, '_')}.mp4`, {
          type: 'video/mp4',
        });
        const blobUrl = URL.createObjectURL(downloadedFile);
        onCreateProject({
          title: projectTitle.trim() || youtubePreview.title,
          mediaFile: downloadedFile,
          mediaUrl: blobUrl,
          mediaFileName: downloadedFile.name,
          duration: youtubePreview.duration,
          language,
          isAudioMode: false,
          style: finalStyle,
          preset: selectedPreset,
        });
      } catch (err: any) {
        setYoutubeError('Error al descargar el video de YouTube para el proyecto.');
      } finally {
        setIsLoadingYoutube(false);
      }
      return;
    }

    // Default empty project
    onCreateProject({
      title: projectTitle.trim() || 'Nuevo Proyecto',
      mediaFile: null,
      mediaUrl: null,
      mediaFileName: '',
      language,
      isAudioMode: mediaType === 'audio',
      style: finalStyle,
      preset: selectedPreset,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-2xl w-full max-h-[92vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-neutral-900 dark:text-neutral-100">
                Crear Nuevo Proyecto
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Configura los detalles del video o audio a importar
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

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* 1. Project Title */}
          <div>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider block mb-1.5">
              Título del Proyecto
            </label>
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="Ej: Videoclip Musical, Reel TikTok, Entrevista..."
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-300 dark:border-neutral-700 text-sm font-semibold text-neutral-900 dark:text-neutral-100 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* 2. Media Source Selection */}
          <div>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider block mb-2">
              Importar Video o Audio
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-neutral-100 dark:bg-neutral-800/80 rounded-2xl mb-3">
              <button
                type="button"
                onClick={() => setMediaType('video')}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  mediaType === 'video'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>Archivo de Video</span>
              </button>
              <button
                type="button"
                onClick={() => setMediaType('audio')}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  mediaType === 'audio'
                    ? 'bg-pink-600 text-white shadow-md'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Music className="w-4 h-4" />
                <span>Audio (MP3/WAV)</span>
              </button>
              <button
                type="button"
                onClick={() => setMediaType('demo')}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  mediaType === 'demo'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Demo Canción 62</span>
              </button>
            </div>

            {/* Media Upload Box */}
            {mediaType !== 'demo' ? (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={mediaType === 'audio' ? 'audio/*' : 'video/*,audio/*'}
                  className="hidden"
                  onChange={handleFileChange}
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                    selectedFile
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                      : 'border-neutral-300 dark:border-neutral-700 hover:border-indigo-500 bg-neutral-50/50 dark:bg-neutral-800/40'
                  }`}
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-between text-left">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
                          {selectedFile.type.startsWith('audio/') ? (
                            <Music className="w-6 h-6" />
                          ) : (
                            <Video className="w-6 h-6" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-neutral-900 dark:text-neutral-100 truncate max-w-sm">
                            {selectedFile.name}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB · Listo para importar
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                        Cambiar
                      </span>
                    </div>
                  ) : (
                    <div>
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto mb-2">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                        Haz clic para seleccionar tu {mediaType === 'audio' ? 'audio' : 'video'}
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        {mediaType === 'audio'
                          ? 'Soporta MP3, WAV, M4A, AAC, FLAC (Se activarán fondos en bucle a 60 FPS)'
                          : 'Soporta MP4, WebM, MOV, MKV'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Or YouTube URL */}
                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-neutral-500" />
                    <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      O pegar enlace de YouTube:
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 outline-none focus:ring-2 focus:ring-indigo-500 text-neutral-900 dark:text-neutral-100"
                    />
                    <button
                      type="button"
                      onClick={handleFetchYoutube}
                      disabled={isLoadingYoutube || !youtubeUrl.trim()}
                      className="px-3.5 py-2 text-xs font-bold rounded-xl bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 disabled:opacity-40 cursor-pointer"
                    >
                      {isLoadingYoutube ? 'Cargando...' : 'Previsualizar'}
                    </button>
                  </div>

                  {youtubePreview && (
                    <div className="mt-2 p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate max-w-sm">
                        🎬 {youtubePreview.title}
                      </span>
                      <span className="font-mono text-neutral-500 shrink-0">
                        {Math.floor(youtubePreview.duration / 60)}:{(youtubePreview.duration % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  )}

                  {youtubeError && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{youtubeError}</span>
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Proyecto Demo Oficial Listo</span>
                </p>
                <p className="text-neutral-600 dark:text-neutral-400">
                  Carga la canción completa "Digno Es El Cordero - ECCOS y Joel Rocco" (07:34) con sus 62 subtítulos sincronizados, listo para editar y personalizar.
                </p>
              </div>
            )}
          </div>

          {/* 3. Subtitle Style Preset */}
          <div>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider block mb-2">
              Estilo Visual de Subtítulos Inicial
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(STYLE_PRESETS) as SubtitlePreset[]).map((presetKey) => {
                const isSelected = selectedPreset === presetKey;
                const p = STYLE_PRESETS[presetKey];
                return (
                  <button
                    key={presetKey}
                    type="button"
                    onClick={() => setSelectedPreset(presetKey)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 ring-2 ring-indigo-500 shadow-sm'
                        : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/40'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider truncate">
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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleCreate}
            disabled={isLoadingYoutube}
            className="px-6 py-2.5 text-xs font-extrabold rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white shadow-md shadow-indigo-600/30 transition-all cursor-pointer flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Crear Proyecto y Comenzar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
