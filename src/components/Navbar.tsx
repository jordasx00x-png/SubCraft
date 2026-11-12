import React, { useState, useRef, useEffect } from 'react';
import {
  Subtitles,
  Check,
  Loader2,
  Moon,
  Sun,
  Download,
  LogOut,
  User as UserIcon,
  Pencil,
  Save,
  Crown,
  ChevronLeft,
  FolderOpen,
  Plus,
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
  onGoHome: () => void;
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
  onGoHome,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(projectTitle);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitleInput(projectTitle);
  }, [projectTitle]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFinishEditingTitle = () => {
    setIsEditingTitle(false);
    if (titleInput.trim()) {
      onTitleChange(titleInput.trim());
    } else {
      setTitleInput(projectTitle);
    }
  };

  return (
    <header className="h-12 border-b border-neutral-200/80 dark:border-neutral-800/90 bg-white dark:bg-[#0c0d12] transition-colors select-none sticky top-0 z-40">
      <div className="max-w-[1920px] h-full mx-auto px-4 flex items-center justify-between gap-4">
        
        {/* LEFT: Clean Brand & Project Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onGoHome}
            className="flex items-center gap-2 group cursor-pointer text-left focus:outline-none"
            title="Volver a Mis Proyectos"
          >
            <div className="w-7 h-7 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 flex items-center justify-center font-black shadow-xs group-hover:scale-105 transition-transform">
              <Subtitles className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs tracking-tight text-neutral-900 dark:text-white">
                SubCraft
              </span>
              <span className="text-[10px] text-neutral-400 font-medium group-hover:text-indigo-500 transition-colors hidden sm:inline flex items-center gap-0.5">
                <ChevronLeft className="w-2.5 h-2.5" /> Proyectos
              </span>
            </div>
          </button>

          <span aria-hidden="true" className="text-neutral-300 dark:text-neutral-700">/</span>

          {/* Inline Project Title Editor */}
          <div className="flex items-center gap-2 min-w-0">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={handleFinishEditingTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFinishEditingTitle();
                  if (e.key === 'Escape') {
                    setTitleInput(projectTitle);
                    setIsEditingTitle(false);
                  }
                }}
                className="text-xs font-medium px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 border border-indigo-500 outline-none text-neutral-900 dark:text-neutral-100 w-44 sm:w-60"
              />
            ) : (
              <button
                onClick={() => setIsEditingTitle(true)}
                className="group flex items-center gap-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white transition-colors cursor-pointer truncate max-w-[160px] sm:max-w-xs"
                title="Haz clic para renombrar el proyecto"
              >
                <span className="truncate">{projectTitle || 'Sin título'}</span>
                <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-neutral-400 transition-opacity shrink-0" />
              </button>
            )}

            {/* Unboxed Save State */}
            <div className="flex items-center gap-1 text-[11px] text-neutral-500 shrink-0">
              <span aria-hidden="true" className="text-neutral-300 dark:text-neutral-700">·</span>
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-amber-500 font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="hidden md:inline">Guardando...</span>
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium" title="Sincronizado">
                  <Check className="w-3 h-3" />
                  <span className="hidden md:inline">Guardado</span>
                </span>
              )}
              {saveStatus === 'offline' && (
                <span className="flex items-center gap-1 text-neutral-500 font-medium" title="Guardado localmente">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                  <span className="hidden md:inline">Local</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Header Actions (Single Source of Truth) */}
        <div className="flex items-center gap-2">
          
          {/* Save Button */}
          <button
            onClick={onSaveProject}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Guardar cambios del proyecto"
          >
            <Save className="w-3.5 h-3.5 text-neutral-500" />
            <span className="hidden sm:inline">Guardar</span>
          </button>

          {/* Export Primary CTA (Single Export button across the app) */}
          <button
            onClick={onOpenExport}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 hover:bg-neutral-800 dark:hover:bg-neutral-100 shadow-xs transition-all cursor-pointer active:scale-98"
            title="Exportar video renderizado o archivo .SRT"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar</span>
          </button>

          <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800 mx-0.5" />

          {/* Dark Mode Toggle */}
          <button
            onClick={onToggleDarkMode}
            className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
            title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-500" />}
          </button>

          {/* PWA Install */}
          <PWAInstallButton variant="navbar" />

          {/* PRO Badge */}
          {isAdmin && (
            <button
              onClick={onOpenAdmin}
              className="px-2 py-0.5 text-[10px] font-bold tracking-wider rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer"
              title="Panel Administrador"
            >
              PRO
            </button>
          )}

          {/* User Profile / Menu Dropdown */}
          <div className="relative" ref={userMenuRef}>
            {user ? (
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-1.5 p-0.5 rounded-full hover:ring-2 hover:ring-neutral-300 dark:hover:ring-neutral-700 transition-all cursor-pointer"
              >
                <img
                  src={user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`}
                  alt={user.displayName || 'Usuario'}
                  className="w-7 h-7 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
                  referrerPolicy="no-referrer"
                />
              </button>
            ) : (
              <button
                onClick={onLoginClick}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 transition-colors cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5 text-neutral-500" />
                <span className="hidden sm:inline">Iniciar sesión</span>
              </button>
            )}

            {/* User Dropdown */}
            {showUserMenu && user && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white dark:bg-[#141620] border border-neutral-200 dark:border-neutral-800 shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs">
                <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800">
                  <p className="font-semibold text-neutral-900 dark:text-white truncate">
                    {user.displayName || 'Usuario'}
                  </p>
                  <p className="text-[11px] text-neutral-500 truncate">{user.email}</p>
                </div>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenProjects();
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center gap-2 cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Mis Proyectos</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onNewProject();
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Nuevo Proyecto</span>
                </button>

                <div className="h-px bg-neutral-100 dark:bg-neutral-800 my-1" />

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogoutClick();
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </header>
  );
};
