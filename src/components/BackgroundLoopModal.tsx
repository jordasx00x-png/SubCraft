import React from 'react';
import {
  Sparkles,
  Music,
  Radio,
  Tv,
  Check,
  X,
  Volume2,
  Maximize2,
  Film,
  Sliders,
  Layers,
} from 'lucide-react';
import { SubtitleStyle, BackgroundLoopType } from '../types/subtitle';

interface BackgroundLoopModalProps {
  style: SubtitleStyle;
  onChangeStyle: (newStyle: SubtitleStyle) => void;
  onClose: () => void;
}

const LOOP_OPTIONS: {
  id: BackgroundLoopType;
  title: string;
  desc: string;
  gradient: string;
  badge: string;
}[] = [
  {
    id: 'aurora-gradient',
    title: 'Aurora Fluid Gradient',
    desc: 'Esferas de color orgánicas en movimiento fluido continuo (Morado, Cian y Magenta)',
    gradient: 'from-indigo-600 via-purple-600 to-cyan-500',
    badge: 'Popular',
  },
  {
    id: 'synthwave-grid',
    title: 'Synthwave 3D Grid',
    desc: 'Rejilla 3D retrofuturista en perspectiva y sol de neón en el horizonte',
    gradient: 'from-pink-600 via-purple-800 to-amber-500',
    badge: 'Retro 80s',
  },
  {
    id: 'cosmic-nebula',
    title: 'Cosmic Nebula & Stars',
    desc: 'Espacio profundo con nubes cósmicas y estrellas titilantes en movimiento',
    gradient: 'from-blue-900 via-purple-950 to-neutral-950',
    badge: 'Inmersivo',
  },
  {
    id: 'sound-spectrum',
    title: 'Sound Spectrum Visualizer',
    desc: 'Barras rítmicas de ecualizador y pulsos de radar cibernéticos',
    gradient: 'from-cyan-600 via-blue-700 to-slate-900',
    badge: 'Tecno / Radio',
  },
  {
    id: 'lofi-ambient',
    title: 'Lo-Fi Midnight Rain',
    desc: 'Efecto de lluvia nocturna tenue y suaves luces desenfocadas de fondo',
    gradient: 'from-slate-800 via-neutral-900 to-amber-950',
    badge: 'Chill / Podcast',
  },
];

export const BackgroundLoopModal: React.FC<BackgroundLoopModalProps> = ({
  style,
  onChangeStyle,
  onClose,
}) => {
  const updateStyle = (updates: Partial<SubtitleStyle>) => {
    onChangeStyle({
      ...style,
      ...updates,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Radio className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h2 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                Modo Audio & Fondos Animados (Loops)
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Ideal para podcasts, locuciones, música y subtítulos en pantalla completa
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
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Main Mode Toggle Card */}
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Activar Modo Solo Audio + Loop de Fondo
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Oculta la pista de video y genera un fondo animado en bucle con subtítulos gigantes
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={style.isAudioMode || false}
                onChange={(e) => updateStyle({ isAudioMode: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-300 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Loop Selector */}
          <div>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider block mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Colección de Fondos Animados (Motion Loops)</span>
            </label>

            <div className="space-y-2.5">
              {LOOP_OPTIONS.map((loop) => {
                const isSelected = (style.backgroundLoop || 'aurora-gradient') === loop.id;
                return (
                  <div
                    key={loop.id}
                    onClick={() => updateStyle({ backgroundLoop: loop.id, isAudioMode: true })}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 shadow-xs ring-2 ring-indigo-500/20'
                        : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-850'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${loop.gradient} flex items-center justify-center text-white shadow-sm shrink-0`}
                      >
                        <Layers className="w-5 h-5 opacity-80" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                            {loop.title}
                          </h4>
                          <span className="text-[10px] font-semibold text-neutral-500 bg-neutral-200 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                            {loop.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                          {loop.desc}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 ml-2">
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-neutral-300 dark:border-neutral-700" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Subtitle Presentation & Waveform Options */}
          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
            <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
              Efectos Audiovisuales Adicionales
            </h4>

            {/* Visualizer toggle */}
            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-4 h-4 text-cyan-500" />
                <div>
                  <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 block">
                    Onda de Audio Reactiva (Audio Waveform)
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Dibuja ondas sinusoidales de neón superpuestas al fondo animado
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={style.showAudioVisualizer ?? true}
                onChange={(e) => updateStyle({ showAudioVisualizer: e.target.checked })}
                className="w-4 h-4 text-indigo-600 accent-indigo-600 rounded cursor-pointer"
              />
            </div>

            {/* Fullscreen style toggle */}
            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Maximize2 className="w-4 h-4 text-amber-500" />
                <div>
                  <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 block">
                    Subtítulos en Pantalla Completa (Modo Reel / Podcast)
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Agranda la tipografía en el centro de la pantalla para máxima visibilidad
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={style.fullScreenSubtitle ?? false}
                onChange={(e) =>
                  updateStyle({
                    fullScreenSubtitle: e.target.checked,
                    position: e.target.checked ? 'middle' : 'bottom',
                    fontSize: e.target.checked ? 36 : style.fontSize,
                  })
                }
                className="w-4 h-4 text-indigo-600 accent-indigo-600 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all cursor-pointer"
          >
            Aplicar Fondo Animado
          </button>
        </div>
      </div>
    </div>
  );
};
