import React, { useEffect, useState } from 'react';
import {
  FolderOpen,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Subtitles,
  Video,
  Music,
  ArrowRight,
  LogOut,
  Sparkles,
  Loader2,
  Crown,
  Search,
  CheckCircle2,
  Layers,
  UploadCloud,
  FileVideo,
} from 'lucide-react';
import { SubtitleProject } from '../types/subtitle';
import { fetchUserProjects, deleteProject } from '../services/projectService';
import { User } from 'firebase/auth';

interface ProjectsDashboardProps {
  user: User | null;
  isAdmin: boolean;
  currentProjectId: string;
  onOpenProject: (project: SubtitleProject) => void;
  onOpenCreateProjectModal: () => void;
  onOpenStudioDirect: () => void;
  onLogout: () => void;
}

export const ProjectsDashboard: React.FC<ProjectsDashboardProps> = ({
  user,
  isAdmin,
  currentProjectId,
  onOpenProject,
  onOpenCreateProjectModal,
  onOpenStudioDirect,
  onLogout,
}) => {
  const [projects, setProjects] = useState<SubtitleProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const list = await fetchUserProjects();
      setProjects(list);
    } catch (err) {
      console.warn('Error loading projects in dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [user, isAdmin]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      console.warn('Error deleting project:', err);
    }
  };

  const filteredProjects = projects.filter((p) =>
    (p.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.videoFileName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header Bar */}
      <header className="border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Subtitles className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
                SubCraft <span className="text-indigo-400 font-black">Studio</span>
                {isAdmin && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Crown className="w-3 h-3 text-amber-400" />
                    Admin PRO
                  </span>
                )}
              </span>
              <span className="text-xs text-neutral-400">
                Panel de Proyectos Guardados
              </span>
            </div>
          </div>

          {/* User profile & Actions */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2.5 bg-neutral-800/80 border border-neutral-700/80 py-1 px-3 rounded-full">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Usuario'}
                    className="w-6 h-6 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-semibold text-neutral-200 hidden sm:inline truncate max-w-[150px]">
                  {user.displayName || user.email}
                </span>
              </div>
            ) : isAdmin ? (
              <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 py-1 px-3 rounded-full text-xs font-bold">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>jordasx00x@gmail.com</span>
              </div>
            ) : null}

            <button
              onClick={onOpenStudioDirect}
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors cursor-pointer"
            >
              Ir al Studio
            </button>

            <button
              onClick={onLogout}
              className="p-2 rounded-xl text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        {/* Dashboard Title & Actions Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-indigo-950/40 p-6 rounded-3xl border border-neutral-800 shadow-xl">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              Mis Proyectos de Subtítulos
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {projects.length}
              </span>
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Todos tus proyectos, videos y audios importados guardados permanentemente.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenCreateProjectModal}
              className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Nuevo Proyecto</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar proyecto por nombre o archivo..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-100 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            onClick={loadProjects}
            className="text-xs font-semibold text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
          >
            Actualizar lista
          </button>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-neutral-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
            <span className="text-xs font-semibold">Cargando tus proyectos guardados...</span>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-neutral-800 rounded-3xl p-8 bg-neutral-900/30">
            <FolderOpen className="w-14 h-14 mx-auto text-indigo-500/60 mb-3" />
            <h3 className="text-base font-bold text-white mb-1">
              {searchQuery ? 'No se encontraron proyectos' : 'No tienes proyectos guardados todavía'}
            </h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto mb-6">
              {searchQuery
                ? 'Intenta con otro término de búsqueda.'
                : 'Crea tu primer proyecto importando un video, audio o utilizando el proyecto demo.'}
            </p>
            <button
              onClick={onOpenCreateProjectModal}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-md inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Proyecto Ahora</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((proj) => {
              const isCurrent = proj.id === currentProjectId;
              const dateStr = new Date(proj.updatedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });
              const isAudio = proj.style?.isAudioMode || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(proj.videoFileName || '');

              return (
                <div
                  key={proj.id}
                  onClick={() => onOpenProject(proj)}
                  className={`group relative p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-indigo-500/10 hover:border-indigo-500/80 ${
                    isCurrent
                      ? 'border-indigo-500 bg-neutral-900 ring-2 ring-indigo-500/30'
                      : 'border-neutral-800/90 bg-neutral-900/70 hover:bg-neutral-900'
                  }`}
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform">
                        {isAudio ? (
                          <Music className="w-6 h-6 text-pink-400" />
                        ) : (
                          <Video className="w-6 h-6 text-indigo-400" />
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isCurrent && (
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 bg-indigo-950/80 border border-indigo-800 px-2 py-0.5 rounded-full">
                            Activo
                          </span>
                        )}
                        <button
                          onClick={(e) => handleDelete(e, proj.id)}
                          className="p-1.5 rounded-xl text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                          title="Eliminar proyecto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <h3 className="font-extrabold text-sm text-white group-hover:text-indigo-300 transition-colors line-clamp-1 mb-1">
                      {proj.title}
                    </h3>

                    {/* Media File details */}
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-3 truncate">
                      {isAudio ? (
                        <Music className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                      ) : (
                        <FileVideo className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      )}
                      <span className="truncate font-mono text-[11px] text-neutral-300">
                        {proj.videoFileName || 'Sin archivo multimedia'}
                      </span>
                    </div>
                  </div>

                  {/* Card Footer Details */}
                  <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-500">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-indigo-400 font-bold">
                        {proj.subtitles?.length || 0} subtítulos
                      </span>
                      <span>•</span>
                      <span className="text-[11px] font-mono">{dateStr}</span>
                    </div>

                    <div className="flex items-center gap-1 text-indigo-400 font-bold group-hover:translate-x-0.5 transition-transform">
                      <span className="text-xs">Abrir</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
