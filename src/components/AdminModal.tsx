import React from 'react';
import { ShieldCheck, Crown, Database, CheckCircle2, Cpu, FileText, Download, X, HardDrive, Sparkles } from 'lucide-react';
import { SubtitleProject } from '../types/subtitle';
import { getLocalProjects } from '../services/projectService';

interface AdminModalProps {
  adminEmail: string;
  onClose: () => void;
  projectsCount: number;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  adminEmail = 'jordasx00x@gmail.com',
  onClose,
  projectsCount,
}) => {
  const localProjects = getLocalProjects();

  const handleExportSystemBackup = () => {
    const backupData = {
      admin: adminEmail,
      timestamp: new Date().toISOString(),
      projects: localProjects,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subcraft-admin-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-amber-500/30 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col text-neutral-100">
        {/* Header */}
        <div className="px-6 py-5 border-b border-neutral-800 bg-gradient-to-r from-neutral-900 via-indigo-950/40 to-neutral-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-lg shadow-amber-500/10">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-lg tracking-tight text-white">Panel de Administrador</h2>
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  PRO MASTER
                </span>
              </div>
              <p className="text-xs text-amber-400/80 font-medium">
                {adminEmail}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Status Badge */}
          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-400">Estado de la Cuenta</span>
              <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Administrador Principal Activo
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1">
                <span className="text-[10px] text-neutral-500 uppercase font-semibold">Proyectos Guardados</span>
                <p className="text-lg font-black text-indigo-400">{Math.max(projectsCount, localProjects.length)}</p>
              </div>
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 space-y-1">
                <span className="text-[10px] text-neutral-500 uppercase font-semibold">Renderizado Video</span>
                <p className="text-lg font-black text-emerald-400">1080p Ultra HD</p>
              </div>
            </div>
          </div>

          {/* Master Capabilities List */}
          <div className="space-y-2.5 text-xs">
            <h4 className="font-bold text-neutral-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" /> Privilegios de Administrador:
            </h4>
            <div className="space-y-2 bg-neutral-950/60 p-3.5 rounded-2xl border border-neutral-800/80 text-neutral-300">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Acceso completo a todos los estilos y plantillas virales</span>
              </div>
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Generación ilimitada de subtítulos algorítmicos</span>
              </div>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Almacenamiento persistente en IndexedDB y Firestore Cloud</span>
              </div>
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-violet-400 shrink-0" />
                <span>Exportaciones .SRT y .VTT sin marcas de agua</span>
              </div>
            </div>
          </div>

          {/* System Backup Action */}
          <button
            onClick={handleExportSystemBackup}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 active:scale-98 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Descargar Copia de Seguridad Completa (.JSON)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
