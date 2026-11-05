import React, { useState } from 'react';
import { Monitor, Download, Check, X, Share, PlusSquare, HelpCircle } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'navbar' | 'landing' | 'compact';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'navbar',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  const handleClick = async () => {
    if (isInstalled) {
      return;
    }

    if (isInstallable) {
      const success = await install();
      if (!success) {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  if (isInstalled) {
    if (variant === 'compact') return null;
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${className}`}
        title="SubCraft está instalado como aplicación de escritorio"
      >
        <Check className="w-3.5 h-3.5 text-emerald-400" />
        <span className="hidden sm:inline">App Instalada</span>
      </span>
    );
  }

  return (
    <>
      {variant === 'landing' ? (
        <button
          onClick={handleClick}
          className={`w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-98 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer ${className}`}
          title="Instalar SubCraft como App nativa en Windows / Escritorio"
        >
          <Monitor className="w-4 h-4 text-indigo-200" />
          <span>Instalar App en Windows</span>
          <Download className="w-3.5 h-3.5 text-indigo-200 ml-auto" />
        </button>
      ) : variant === 'compact' ? (
        <button
          onClick={handleClick}
          className={`p-2 text-neutral-400 hover:text-indigo-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer ${className}`}
          title="Instalar App en Windows"
        >
          <Monitor className="w-4 h-4" />
        </button>
      ) : (
        <button
          onClick={handleClick}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 active:scale-95 transition-all cursor-pointer shadow-2xs ${className}`}
          title="Instalar SubCraft como App nativa de Windows / Escritorio"
        >
          <Monitor className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">Instalar App</span>
        </button>
      )}

      {/* Guide modal when automatic trigger needs browser user action or on iOS */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-neutral-100">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2 font-bold text-base text-white">
                <Monitor className="w-5 h-5 text-indigo-400" />
                <span>Instalar SubCraft en Windows</span>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-neutral-300">
                <p>Para instalar SubCraft en tu dispositivo iOS (iPhone/iPad):</p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li className="flex items-center gap-2">
                    <span>Toca el botón <Share className="w-3.5 h-3.5 inline text-indigo-400" /> Compartir en Safari.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span>Selecciona <PlusSquare className="w-3.5 h-3.5 inline text-indigo-400" /> "Añadir a la pantalla de inicio".</span>
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-neutral-300">
                <p className="leading-relaxed">
                  Puedes instalar SubCraft como una aplicación de escritorio rápida e independiente en Windows usando Google Chrome o Microsoft Edge.
                </p>
                <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-2 text-[11px]">
                  <div className="font-semibold text-indigo-400 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Instrucciones rápidas:</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-1.5 text-neutral-300">
                    <li>
                      Busca el icono de <strong>Instalar 💻</strong> en el lado derecho de la barra de direcciones de tu navegador.
                    </li>
                    <li>
                      O bien, haz clic en el menú <strong>(⋮) tres puntos</strong> en la esquina superior derecha &rarr; <strong>Guardar y compartir / Instalar SubCraft</strong>.
                    </li>
                  </ul>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
