import React, { useState } from 'react';
import {
  Subtitles,
  Sparkles,
  Upload,
  Languages,
  Palette,
  Film,
  Cloud,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Play,
  Layers,
  Clock,
  Loader2,
  Crown,
  FolderOpen,
} from 'lucide-react';
import { signInWithPopup, User } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { syncUserProfile } from '../services/projectService';
import { AddVideoModal } from './AddVideoModal';
import { PWAInstallButton } from './PWAInstallButton';

interface LandingPageProps {
  user: User | null;
  onEnterStudio: () => void;
  onOpenDashboard?: () => void;
  onUploadVideoDirect: (file: File) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onAdminLogin?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  user,
  onEnterStudio,
  onOpenDashboard,
  onUploadVideoDirect,
  darkMode,
  onToggleDarkMode,
  onAdminLogin,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddVideoModal, setShowAddVideoModal] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      await syncUserProfile();
      if (onOpenDashboard) {
        onOpenDashboard();
      } else {
        onEnterStudio();
      }
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        if (err?.code === 'auth/unauthorized-domain' || err?.message?.includes('unauthorized-domain')) {
          setError(
            `El dominio "${window.location.hostname}" no está autorizado en Firebase. Agrégalo en Firebase Console > Authentication > Settings > Authorized domains.`
          );
        } else {
          setError(err?.message || 'Error al conectar con Google.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadVideoDirect(file);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Hidden file input */}
      <input
        type="file"
        id="landing-file-input"
        accept="video/*"
        className="hidden"
        onChange={handleFileInput}
      />

      {/* Top Navbar */}
      <header className="border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Subtitles className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white">
                SubCraft <span className="text-indigo-400 font-black">AI</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider bg-neutral-900 px-2 py-0.5 rounded-full border border-neutral-800">
                Studio 5-10 Min
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <PWAInstallButton variant="navbar" />
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 text-xs text-neutral-300">
                  <img
                    src={user.photoURL || ''}
                    alt={user.displayName || 'Usuario'}
                    className="w-7 h-7 rounded-full border border-indigo-500/40"
                    referrerPolicy="no-referrer"
                  />
                  <span className="truncate max-w-[120px] font-medium">{user.displayName || user.email}</span>
                </div>
                <button
                  onClick={onEnterStudio}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-md shadow-indigo-600/30 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>Abrir Editor</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-900" />
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.14C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.59H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.41l4.03-3.14z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.59l4.03 3.14c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                )}
                <span>Iniciar Sesión</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 flex flex-col items-center text-center">
        {/* Editorial Subtitle Kicker (Unboxed) */}
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-indigo-400 mb-4 animate-in fade-in duration-300">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Subtitulado Automático con IA · Videos de 5 a 10 min</span>
        </div>

        {/* Heading */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white max-w-4xl leading-tight sm:leading-none mb-6">
          Genera, edita y exporta subtítulos{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-amber-300 bg-clip-text text-transparent">
            con Inteligencia Artificial
          </span>
        </h1>

        <p className="text-base sm:text-lg text-neutral-400 max-w-2xl leading-relaxed mb-10">
          Sube tus videos, obtén subtítulos sincronizados palabra por palabra con Gemini, personaliza estilos virales o tipo Netflix, y descarga en formato .SRT o video en alta resolución.
        </p>

        {/* Main CTA Login Card */}
        <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-neutral-900/90 border border-neutral-800 shadow-2xl backdrop-blur-xl flex flex-col items-center gap-4 mb-12">
          {user ? (
            <div className="w-full text-center space-y-4">
              <div className="flex items-center justify-center gap-3">
                <img
                  src={user.photoURL || ''}
                  alt={user.displayName || 'Usuario'}
                  className="w-12 h-12 rounded-full border-2 border-indigo-500 object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="text-left">
                  <h4 className="font-bold text-sm text-white">{user.displayName}</h4>
                  <p className="text-xs text-neutral-400">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 font-semibold py-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Sesión activa con Google · Autoguardado en la nube</span>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={onOpenDashboard || onEnterStudio}
                  className="w-full py-3.5 px-5 text-sm font-bold rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Ver Mis Proyectos Guardados</span>
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </button>

                <button
                  onClick={onEnterStudio}
                  className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Ir directamente al Studio Editor</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full space-y-3.5">
              {/* Primary Direct Entry Button */}
              <button
                onClick={onEnterStudio}
                className="w-full py-3.5 px-5 text-sm font-extrabold rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🚀 Entrar al Studio de Subtítulos</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Admin Master Login Button */}
              {onAdminLogin && (
                <button
                  onClick={onAdminLogin}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500/20 via-indigo-600/20 to-amber-500/20 hover:from-amber-500/30 hover:to-indigo-600/30 border border-amber-500/40 text-amber-300 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span>Acceso Administrador PRO (jordasx00x@gmail.com)</span>
                </button>
              )}

              <div className="flex items-center gap-3 py-1">
                <div className="h-px bg-neutral-800 flex-1" />
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">o con Google / Video</span>
                <div className="h-px bg-neutral-800 flex-1" />
              </div>

              {/* Google Sign In */}
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-neutral-100 text-neutral-900 font-bold text-xs transition-all shadow-md active:scale-98 flex items-center justify-center gap-3 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-neutral-900" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.14C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.59H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.41l4.03-3.14z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.59l4.03 3.14c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                )}
                <span>Iniciar Sesión con Google</span>
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px bg-neutral-800 flex-1" />
                <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">o</span>
                <div className="h-px bg-neutral-800 flex-1" />
              </div>

              {/* Guest / Direct Entry Button */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={onEnterStudio}
                  className="py-2.5 px-3 text-xs font-semibold rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Probar Demo</span>
                </button>

                <button
                  onClick={() => setShowAddVideoModal(true)}
                  className="py-2.5 px-3 text-xs font-semibold rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Añadir Video</span>
                </button>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-900/60 text-xs text-red-300 space-y-2 text-left">
                  <p>{error}</p>
                  <button
                    onClick={onEnterStudio}
                    className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Entrar al Studio sin Iniciar Sesión</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-center gap-4 text-[11px] text-neutral-500 pt-2 border-t border-neutral-800/80 w-full">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Autenticación Segura
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Cloud className="w-3.5 h-3.5 text-indigo-400" /> Firestore Cloud
            </span>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full text-left">
          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 w-fit mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white mb-1">Transcripción con IA</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Detecta la voz de videos de 5 a 10 min y genera marcas de tiempo exactas en segundos con Gemini.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800">
            <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 w-fit mb-3">
              <Palette className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white mb-1">Estilos Personalizados</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Elige entre estilos virales para TikTok/Reels, Netflix, Cyberpunk o crea tus propias fuentes y trazos.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 w-fit mb-3">
              <Languages className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white mb-1">Múltiples Idiomas</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Traduce automáticamente a más de 14 idiomas manteniendo la sincronización y ritmo original.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 w-fit mb-3">
              <Film className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white mb-1">Exportación en 1080p</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Descarga archivos .SRT y .VTT o quema los subtítulos directamente en tu video en alta resolución.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900 py-6 text-center text-xs text-neutral-500">
        <p>SubCraft AI • Studio de Subtitulado Inteligente con Google Cloud Sync</p>
      </footer>

      {/* Add Video & YouTube Modal */}
      {showAddVideoModal && (
        <AddVideoModal
          onVideoFileSelected={(file) => {
            setShowAddVideoModal(false);
            onUploadVideoDirect(file);
          }}
          onVideoBlobUrlLoaded={(_url, _title) => {
            setShowAddVideoModal(false);
            onEnterStudio();
          }}
          onLoadSampleVideo={() => {
            setShowAddVideoModal(false);
            onEnterStudio();
          }}
          onClose={() => setShowAddVideoModal(false)}
        />
      )}
    </div>
  );
};
