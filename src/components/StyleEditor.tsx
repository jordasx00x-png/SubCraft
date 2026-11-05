import React from 'react';
import {
  Palette,
  Type,
  Maximize2,
  Sliders,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
  X,
  Check,
} from 'lucide-react';
import { SubtitleStyle, STYLE_PRESETS, SubtitlePreset } from '../types/subtitle';

interface StyleEditorProps {
  style: SubtitleStyle;
  onChangeStyle: (newStyle: SubtitleStyle) => void;
  onClose: () => void;
}

const FONT_OPTIONS = [
  { label: 'Montserrat (Viral / Modern)', value: 'Montserrat' },
  { label: 'Bebas Neue (Punchy Caps)', value: 'Bebas Neue' },
  { label: 'Inter (Clean / Netflix)', value: 'Inter' },
  { label: 'Outfit (Trendy / Social)', value: 'Outfit' },
  { label: 'Poppins (Smooth / Sans)', value: 'Poppins' },
  { label: 'Rubik (Heavy / Impact)', value: 'Rubik' },
  { label: 'Roboto Mono (Tech / Code)', value: 'Roboto Mono' },
];

const COLOR_SWATCHES = [
  '#FFFFFF',
  '#FACC15', // Yellow
  '#22D3EE', // Cyan
  '#4ADE80', // Green
  '#F472B6', // Pink
  '#FB923C', // Orange
  '#A78BFA', // Purple
  '#000000', // Black
];

export const StyleEditor: React.FC<StyleEditorProps> = ({ style, onChangeStyle, onClose }) => {
  const handlePresetSelect = (presetKey: SubtitlePreset) => {
    const selectedPreset = STYLE_PRESETS[presetKey];
    if (selectedPreset) {
      onChangeStyle({ ...selectedPreset });
    }
  };

  const updateProp = <K extends keyof SubtitleStyle>(key: K, value: SubtitleStyle[K]) => {
    onChangeStyle({
      ...style,
      preset: 'custom',
      [key]: value,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-500">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                Personalización de Subtítulos
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Ajusta tipografía, colores, trazos y posición en el video
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

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Live Preview Box */}
          <div className="relative h-32 rounded-2xl bg-neutral-950 flex items-center justify-center overflow-hidden border border-neutral-800 shadow-inner px-4">
            <span className="absolute top-2 left-3 text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
              Vista Previa en Vivo
            </span>
            <div
              style={{
                fontFamily: `"${style.fontFamily}", sans-serif`,
                fontSize: `${Math.min(32, style.fontSize)}px`,
                fontWeight: style.fontWeight,
                color: style.textColor,
                textTransform: style.textTransform,
                letterSpacing: `${style.letterSpacing}px`,
                WebkitTextStroke:
                  style.hasStroke && style.strokeWidth > 0
                    ? `${style.strokeWidth}px ${style.strokeColor}`
                    : 'none',
                paintOrder: 'stroke fill',
                textShadow: style.hasShadow
                  ? `${style.shadowOffsetX}px ${style.shadowOffsetY}px ${style.shadowBlur}px ${style.shadowColor}`
                  : 'none',
                backgroundColor:
                  style.hasBackground && style.backgroundOpacity > 0
                    ? `${style.backgroundColor}${Math.round(style.backgroundOpacity * 255)
                        .toString(16)
                        .padStart(2, '0')}`
                    : 'transparent',
                padding: style.hasBackground ? `${style.backgroundPadding}px` : '0px',
                borderRadius: `${style.backgroundRounded}px`,
                textAlign: style.textAlign,
              }}
              className="select-none inline-block max-w-[90%] truncate"
            >
              ¡SUBTÍTULOS PROFESIONALES CON IA!
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Estilos Prediseñados (Presets)</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {(
                [
                  { id: 'viral-yellow', name: 'Viral TikTok', desc: 'Amarillo + Trazo negro' },
                  { id: 'netflix', name: 'Netflix', desc: 'Blanco clásico + Caja' },
                  { id: 'cyberpunk-neon', name: 'Neon Pop', desc: 'Cyan glow futurista' },
                  { id: 'bebas-bold', name: 'Bebas Impact', desc: 'Rojo punchy mayúsculas' },
                  { id: 'minimal-dark', name: 'Minimal Clean', desc: 'Sans suave y legible' },
                  { id: 'bold-white', name: 'Blanco Bold', desc: 'Impactante de alto contraste' },
                ] as const
              ).map((preset) => {
                const isCurrent = style.preset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset.id)}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                      isCurrent
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                        : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        {preset.name}
                      </span>
                      {isCurrent && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                    </div>
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block mt-0.5">
                      {preset.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Typography Controls */}
          <div className="space-y-4 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-indigo-500" />
              <span>Tipografía y Texto</span>
            </h4>

            {/* Font Family */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1">
                  Fuente
                </label>
                <select
                  value={style.fontFamily}
                  onChange={(e) => updateProp('fontFamily', e.target.value)}
                  className="w-full text-xs p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none cursor-pointer"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Text Transform */}
              <div>
                <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1">
                  Formato de texto
                </label>
                <div className="grid grid-cols-3 gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl">
                  {(
                    [
                      { id: 'none', label: 'Normal' },
                      { id: 'uppercase', label: 'MAYÚS' },
                      { id: 'capitalize', label: 'Inicial' },
                    ] as const
                  ).map((tt) => (
                    <button
                      key={tt.id}
                      onClick={() => updateProp('textTransform', tt.id)}
                      className={`text-[11px] py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                        style.textTransform === tt.id
                          ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                          : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                      }`}
                    >
                      {tt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Font Size & Weight */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                  <span>Tamaño de fuente</span>
                  <span className="font-mono">{style.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min={16}
                  max={46}
                  value={style.fontSize}
                  onChange={(e) => updateProp('fontSize', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1">
                  Grosor de fuente
                </label>
                <select
                  value={style.fontWeight}
                  onChange={(e) => updateProp('fontWeight', e.target.value as any)}
                  className="w-full text-xs p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-none cursor-pointer"
                >
                  <option value="600">Semibold (600)</option>
                  <option value="700">Bold (700)</option>
                  <option value="800">Extrabold (800)</option>
                  <option value="900">Black (900)</option>
                </select>
              </div>
            </div>

            {/* Text Color Picker & Swatches */}
            <div>
              <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1.5">
                Color de texto
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={style.textColor}
                  onChange={(e) => updateProp('textColor', e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-neutral-300 dark:border-neutral-700 p-0.5 bg-transparent"
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {COLOR_SWATCHES.map((color) => (
                    <button
                      key={color}
                      onClick={() => updateProp('textColor', color)}
                      style={{ backgroundColor: color }}
                      className={`w-6 h-6 rounded-full border border-neutral-400/40 shadow-xs transition-transform hover:scale-110 cursor-pointer ${
                        style.textColor.toLowerCase() === color.toLowerCase()
                          ? 'ring-2 ring-indigo-500 ring-offset-2'
                          : ''
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Stroke / Outline */}
          <div className="space-y-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                Contorno / Borde del Texto
              </h4>
              <input
                type="checkbox"
                checked={style.hasStroke}
                onChange={(e) => updateProp('hasStroke', e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
              />
            </div>

            {style.hasStroke && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                    <span>Grosor de borde</span>
                    <span className="font-mono">{style.strokeWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={style.strokeWidth}
                    onChange={(e) => updateProp('strokeWidth', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1">
                    Color de borde
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={style.strokeColor}
                      onChange={(e) => updateProp('strokeColor', e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-neutral-300 dark:border-neutral-700 p-0.5 bg-transparent"
                    />
                    <span className="text-xs font-mono text-neutral-600 dark:text-neutral-400">
                      {style.strokeColor}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Background Box */}
          <div className="space-y-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                Caja de Fondo (Subtítulos tipo Netflix)
              </h4>
              <input
                type="checkbox"
                checked={style.hasBackground}
                onChange={(e) => updateProp('hasBackground', e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
              />
            </div>

            {style.hasBackground && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                    <span>Opacidad del fondo</span>
                    <span className="font-mono">{Math.round(style.backgroundOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={style.backgroundOpacity}
                    onChange={(e) => updateProp('backgroundOpacity', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1">
                    Color de fondo
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={style.backgroundColor}
                      onChange={(e) => updateProp('backgroundColor', e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-neutral-300 dark:border-neutral-700 p-0.5 bg-transparent"
                    />
                    <span className="text-xs font-mono text-neutral-600 dark:text-neutral-400">
                      {style.backgroundColor}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Position & Alignment */}
          <div className="space-y-4 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
              <Maximize2 className="w-3.5 h-3.5 text-indigo-500" />
              <span>Posición y Alineación</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1">
                  Ubicación vertical
                </label>
                <div className="grid grid-cols-3 gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl">
                  {(
                    [
                      { id: 'top', label: 'Arriba' },
                      { id: 'middle', label: 'Centro' },
                      { id: 'bottom', label: 'Abajo' },
                    ] as const
                  ).map((pos) => (
                    <button
                      key={pos.id}
                      onClick={() => updateProp('position', pos.id)}
                      className={`text-[11px] py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                        style.position === pos.id
                          ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                          : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-600 dark:text-neutral-400 block mb-1">
                  Alineación horizontal
                </label>
                <div className="grid grid-cols-3 gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl">
                  {(
                    [
                      { id: 'left', icon: AlignLeft },
                      { id: 'center', icon: AlignCenter },
                      { id: 'right', icon: AlignRight },
                    ] as const
                  ).map((align) => {
                    const Icon = align.icon;
                    return (
                      <button
                        key={align.id}
                        onClick={() => updateProp('textAlign', align.id)}
                        className={`flex items-center justify-center py-1 rounded-lg transition-colors cursor-pointer ${
                          style.textAlign === align.id
                            ? 'bg-white dark:bg-neutral-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                            : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Vertical Offset Slider */}
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                <span>Distancia desde el borde</span>
                <span className="font-mono">{style.verticalOffset}%</span>
              </div>
              <input
                type="range"
                min={2}
                max={25}
                value={style.verticalOffset}
                onChange={(e) => updateProp('verticalOffset', parseInt(e.target.value))}
                className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
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
            Listo / Aplicar
          </button>
        </div>
      </div>
    </div>
  );
};
