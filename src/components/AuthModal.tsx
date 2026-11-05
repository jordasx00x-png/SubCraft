import React, { useState } from 'react';
import { User, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { syncUserProfile } from '../services/projectService';
import { X, Cloud, Check, LogOut, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  user: User | null;
  onClose: () => void;
  onLogoutSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ user, onClose, onLogoutSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await signInWithPopup(auth, googleProvider);
      await syncUserProfile();
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err?.code !== 'auth/popup-closed-by-user') {
        setErrorMessage(err?.message || 'Error al iniciar sesión con Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      onClose();
      if (onLogoutSuccess) {
        onLogoutSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al cerrar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                Sincronización en la Nube
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Guarda y accede a tus proyectos en cualquier dispositivo
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
        <div className="p-6 space-y-5">
          {user ? (
            /* User profile view */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 flex items-center gap-3.5">
                <img
                  src={user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`}
                  alt={user.displayName || 'Usuario'}
                  className="w-12 h-12 rounded-full border-2 border-indigo-500 object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="truncate">
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                    {user.displayName || 'Usuario de SubCraft'}
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    {user.email}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Cuenta de Google Verificada</span>
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs text-neutral-600 dark:text-neutral-400 p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Tus subtítulos se guardan automáticamente al editar</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Sincronizado entre tu navegador y otros dispositivos</span>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                disabled={loading}
                className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 hover:bg-red-100 transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          ) : (
            /* Sign in view */
            <div className="space-y-5 text-center">
              <div className="space-y-2">
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Inicia sesión con Google
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-sm mx-auto">
                  Guarda automáticamente tus videos, marcas de tiempo y configuraciones de estilo de forma segura en Firestore.
                </p>
              </div>

              <div className="space-y-2 text-left text-xs text-neutral-600 dark:text-neutral-400 p-3.5 bg-neutral-50 dark:bg-neutral-800/40 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Autoguardado en la nube en tiempo real</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Multiplataforma: edita en Mac, Windows, móvil o tablet</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Recupera tus proyectos en cualquier momento</span>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-xs text-red-600 dark:text-red-400 flex items-center gap-2 text-left">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Official Google Button */}
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700/80 text-neutral-800 dark:text-neutral-100 font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-3 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
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
                <span>Continuar con Google</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
