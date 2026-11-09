import React from 'react';
import {
  Subtitles,
  Cloud,
  CloudCheck,
  CloudOff,
  Moon,
  Sun,
  FolderOpen,
  Download,
  Sparkles,
  LogOut,
  User as UserIcon,
  Upload,
  Pencil,
  Plus,
  Save,
  Cpu,
  Crown,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  projectTitle: string;
  onTitleChange: (title: string) => void;
  saveStatus: 'saved' | 'saving' | 'offline';
  darkMode: boolean;
  onToggleDarkMode: () => void;
  user: User | null;
  isAdmin?: boolean;
  onOpenAdmin?: () => void;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  onOpenProjects: () => void;
  onNewProject: () => void;
  onSaveProject: () => void;
  onOpenExport: () => void;
  onOpenStyle: () => void;
  onOpenTranslate: () => void;
  onOpenGenerate: () => void;
  onAddVideoClick: () => void;
  onGoHome: () => void;
  onOpenBackgroundLoop: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  projectTitle,
  onTitleChange,
  saveStatus,
  darkMode,
  onToggleDarkMode,
  user,
  isAdmin,
  onOpenAdmin,
  onLoginClick,
  onLogoutClick,
  onOpenProjects,
  onNewProject,
  onSaveProject,
  onOpenExport,
  onOpenStyle,
  onOpenTranslate,
  onOpenGenerate,
  onAddVideoClick,
  onGoHome,
  onOpenBackgroundLoop,
}) => {
  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md transition-colors duration-200 select-none sticky top-0 z-40">
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-4">
        {/* Brand & Project Name */}
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            onClick={onGoHome}
            className="flex items-center gap-2.5 text-left group cursor-pointer shrink-0"
            title="Volver a la página principal"
          >
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-indigo-500 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <Subtitles className="w-4 h-4" />
            </div>
            <div className="hidden sm:block">
              <span className="font-extrabold text-base tracking-tight text-neutral-900 dark:text-neutral-100">
                SubCraft <span className="text-indigo-600 dark:text-indigo-400 font-black">Studio</span>
              </span>
              <span className="block text-[9px] text-neutral-500 dark:text-neutral-400 font-medium tracking-wider uppercase">
                Editor Algorítmico
              </span>
            </div>
          </button>

          <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-800 hidden md:block" />

          {/* Editable Project Name */}
          <div className="flex items-center gap-2 min-w-0 group/title">
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              className="text-xs sm:text-sm font-semibold px-2 py-1 rounded-lg bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:bg-neutral-100 dark:focus:bg-neutral-800 focus:ring-1 focus:ring-indigo-500 outline-none text-neutral-800 dark:text-neutral-100 transition-all max-w-[140px] sm:max-w-[220px] truncate"
              title="Haz clic para renombrar el proyecto"
            />
            <Pencil className="w-3 h-3 text-neutral-400 opacity-0 group-hover/title:opacity-100 transition-opacity hidden sm:inline" />

            {/* Cloud Auto-save status badge */}
            <div className="flex items-center text-xs">
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-amber-500 animate-pulse">
                  <Cloud className="w-3 h-3 animate-spin" />
                  <span className="hidden xl:inline">Guardando...</span>
                </span>
              )}
              {saveStatus === 'saved' && (
                <span
                  className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
                  title="Avances sincronizados"
                >
                  <CloudCheck className="w-3 h-3" />
                  <span className="hidden xl:inline">Sincronizado</span>
                </span>
              )}
              {saveStatus === 'offline' && (
                <button
                  onClick={onLoginClick}
                  className="flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                  title="Inicia sesión con Google para sincronizar tus proyectos"
                >
                  <CloudOff className="w-3 h-3" />
                  <span className="hidden xl:inline">Local (Conectar nube)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Suite (Centered & Right) */}
        <div className="flex items-center gap-2">
          {/* Add Video Button */}
          <button
            onClick={onAddVideoClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs active:scale-95 transition-all cursor-pointer"
            title="Añadir video o enlace de YouTube"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>+ Añadir Video</span>
          </button>

          {/* Generador Algorítmico */}
          <button
            onClick={onOpenGenerate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-2xs transition-all cursor-pointer"
            title="Generar subtítulos algorítmicos"
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-200" />
            <span className="hidden sm:inline">Auto Subtítulos</span>
          </button>

          {/* Guardar Proyecto Button (Explicit manual save) */}
          <button
            onClick={onSaveProject}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-2xs transition-all cursor-pointer"
            title="Guardar proyecto e ir registrando avances en Mis Proyectos"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar Proyecto</span>
          </button>

          {/* Export Hub */}
          <button
            onClick={onOpenExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-100 border border-neutral-700 transition-all cursor-pointer"
            title="Descargar SRT / VTT o exportar video quemado"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Exportar</span>
          </button>

          <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-800 mx-1 hidden sm:block" />

          {/* Cloud Projects Drawer */}
          <button
            onClick={onOpenProjects}
            className="p-2 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-medium"
            title="Ver mis proyectos guardados"
          >
            <FolderOpen className="w-4 h-4 text-amber-500" />
            <span className="hidden lg:inline">Mis Proyectos</span>
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={onToggleDarkMode}
            className="p-2 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
            title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {darkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-500" />
            )}
          </button>

          {/* PWA App Install Button */}
          <PWAInstallButton variant="navbar" />

          {/* Admin Master Badge & Button */}
          {isAdmin && (
            <button
              onClick={onOpenAdmin}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-black rounded-lg bg-gradient-to-r from-amber-500/20 via-indigo-600/20 to-amber-500/20 hover:from-amber-500/30 hover:to-indigo-600/30 text-amber-300 border border-amber-500/40 shadow-xs cursor-pointer animate-in fade-in"
              title="Panel de Administrador (jordasx00x@gmail.com)"
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xl:inline">ADMIN PRO</span>
            </button>
          )}

          {/* Google Sign-in / User Avatar */}
          {user ? (
            <div className="flex items-center gap-2 pl-1">
              <img
                src={user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`}
                alt={user.displayName || 'Usuario'}
                className="w-7 h-7 rounded-full border border-indigo-500/40 object-cover"
                referrerPolicy="no-referrer"
              />
              <button
                onClick={onLogoutClick}
                className="p-1.5 text-neutral-500 hover:text-red-500 dark:text-neutral-400 dark:hover:text-red-400 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onLoginClick}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700 transition-all cursor-pointer"
              title="Iniciar sesión con Google para sincronización multi-dispositivo"
            >
              <UserIcon className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden md:inline">Iniciar Sesión</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
