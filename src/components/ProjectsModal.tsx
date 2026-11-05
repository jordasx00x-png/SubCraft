import React, { useEffect, useState } from 'react';
import {
  FolderOpen,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Subtitles,
  X,
  Cloud,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { SubtitleProject } from '../types/subtitle';
import { fetchUserProjects, deleteProject } from '../services/projectService';
import { User } from 'firebase/auth';

interface ProjectsModalProps {
  currentProjectId: string;
  user: User | null;
  onSelectProject: (project: SubtitleProject) => void;
  onNewProject: () => void;
  onLoginClick: () => void;
  onClose: () => void;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  currentProjectId,
  user,
  onSelectProject,
  onNewProject,
  onLoginClick,
  onClose,
}) => {
  const [projects, setProjects] = useState<SubtitleProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchUserProjects();
      setProjects(list);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar proyectos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [user]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('¿Deseas eliminar este proyecto? Esta acción no se puede deshacer.')) {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-xl w-full max-h-[85vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                Mis Proyectos en la Nube
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {user ? `Sincronizados con ${user.email}` : 'Almacenamiento local (conéctate para nube)'}
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

        {/* User cloud banner if not logged in */}
        {!user && (
          <div className="px-6 py-3 bg-indigo-50/60 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-indigo-900 dark:text-indigo-200">
              <Cloud className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Inicia sesión con Google para sincronizar tus proyectos en todos tus dispositivos.</span>
            </div>
            <button
              onClick={() => {
                onClose();
                onLoginClick();
              }}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 cursor-pointer ml-2"
            >
              Conectar
            </button>
          </div>
        )}

        {/* Project List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mb-2" />
              <span className="text-xs">Cargando proyectos sincronizados...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 dark:text-neutral-500">
              <Subtitles className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold">No tienes proyectos guardados aún.</p>
              <p className="text-xs mt-1">Crea un nuevo proyecto para comenzar a subtitular con IA.</p>
            </div>
          ) : (
            projects.map((proj) => {
              const isCurrent = proj.id === currentProjectId;
              const dateStr = new Date(proj.updatedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={proj.id}
                  onClick={() => {
                    onSelectProject(proj);
                    onClose();
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    isCurrent
                      ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-xs'
                      : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30'
                  }`}
                >
                  <div className="flex items-center gap-3.5 truncate">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                      <Subtitles className="w-5 h-5" />
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                          {proj.title}
                        </h4>
                        {isCurrent && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full shrink-0">
                            Activo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                        <span>{proj.subtitles?.length || 0} subtítulos</span>
                        <span>•</span>
                        <span>{dateStr}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => handleDelete(e, proj.id)}
                      className="p-2 rounded-xl text-neutral-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                      title="Eliminar proyecto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <button
            onClick={() => {
              onNewProject();
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Crear Nuevo Proyecto</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-xl text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
