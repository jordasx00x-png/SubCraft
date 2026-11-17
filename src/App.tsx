/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, testConnection } from './firebase';
import {
  SubtitleCue,
  SubtitleStyle,
  SubtitleProject,
  DEFAULT_STYLE,
} from './types/subtitle';
import {
  saveProject,
  restoreLastProject,
  setCurrentProjectId,
} from './services/projectService';
import {
  saveAndSyncMediaFile,
  resolveMediaFile,
} from './services/mediaStore';
import { CheckCircle2, Undo2, Redo2 } from 'lucide-react';
import { parseSrt, ensureUniqueCueIds } from './utils/subtitleFormats';
import {
  SAMPLE_VIDEO_URL,
  SAMPLE_VIDEO_NAME,
  INITIAL_SAMPLE_SUBTITLES,
} from './utils/sampleData';

// Components
import { Navbar } from './components/Navbar';
import { TranscriptPanel } from './components/TranscriptPanel';
import { VideoPlayer } from './components/VideoPlayer';
import { SubtitleTimeline } from './components/SubtitleTimeline';
import { StudioInspector, StudioTab } from './components/StudioInspector';
import { ExportModal } from './components/ExportModal';
import { GenerateModal } from './components/GenerateModal';
import { TranslateModal } from './components/TranslateModal';
import { ProjectsModal } from './components/ProjectsModal';
import { AiPolishModal } from './components/AiPolishModal';
import { TimeShiftModal } from './components/TimeShiftModal';
import { AuthModal } from './components/AuthModal';
import { LandingPage } from './components/LandingPage';
import { ProjectsDashboard } from './components/ProjectsDashboard';
import { CreateProjectModal } from './components/CreateProjectModal';
import { AddVideoModal } from './components/AddVideoModal';
import { BackgroundLoopModal } from './components/BackgroundLoopModal';
import { StyleEditor } from './components/StyleEditor';
import { AdminModal } from './components/AdminModal';

interface HistorySnapshot {
  subtitles: SubtitleCue[];
  style: SubtitleStyle;
  projectTitle: string;
  selectedCueId: string | number | null;
}

const MAX_HISTORY_STEPS = 60;

const cloneSnapshot = (snap: HistorySnapshot): HistorySnapshot => ({
  subtitles: snap.subtitles.map((cue) => ({ ...cue })),
  style: { ...snap.style },
  projectTitle: snap.projectTitle,
  selectedCueId: snap.selectedCueId,
});

const serializeHistoryState = (snap: Pick<HistorySnapshot, 'subtitles' | 'style' | 'projectTitle'>): string =>
  JSON.stringify({
    subtitles: snap.subtitles,
    style: snap.style,
    projectTitle: snap.projectTitle,
  });

export default function App() {
  // Navigation view: 'landing' (login & presentation), 'dashboard' (saved projects & new project), or 'studio' (editor)
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard' | 'studio'>(() => {
    const saved = sessionStorage.getItem('subcraft_current_view');
    if (saved === 'studio' || saved === 'dashboard' || saved === 'landing') {
      return saved;
    }
    return 'landing';
  });

  useEffect(() => {
    try {
      sessionStorage.setItem('subcraft_current_view', currentView);
    } catch {}
  }, [currentView]);

  // Studio Inspector Tab: 'subtitles' | 'style' | 'loops' | 'ai'
  const [activeStudioTab, setActiveStudioTab] = useState<StudioTab>('subtitles');

  // Authentication & Admin Access
  const [user, setUser] = useState<User | null>(null);
  const [isAdminSession, setIsAdminSession] = useState<boolean>(() => {
    return localStorage.getItem('subcraft_admin_session') === 'true';
  });
  const isAdmin = isAdminSession || user?.email === 'jordasx00x@gmail.com';
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'offline'>('saved');

  // Dark mode
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('subcraft_dark_mode');
    return saved !== null ? saved === 'true' : true; // Default dark mode for video editing
  });

  // Project data
  const [projectId, setProjectId] = useState<string>(() => `proj_${Date.now()}`);
  const [projectTitle, setProjectTitle] = useState<string>('Mi Proyecto de Video');
  const [language, setLanguage] = useState<string>('es');
  const [targetLanguage, setTargetLanguage] = useState<string>('es');
  const [subtitles, setSubtitles] = useState<SubtitleCue[]>(() => ensureUniqueCueIds(INITIAL_SAMPLE_SUBTITLES));
  const [selectedCueId, setSelectedCueId] = useState<string | number | null>(null);
  const [style, setStyle] = useState<SubtitleStyle>(DEFAULT_STYLE);

  // Video playback
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(SAMPLE_VIDEO_URL);
  const [videoFileName, setVideoFileName] = useState<string>(SAMPLE_VIDEO_NAME);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(30);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Modals (for workflows that require dedicated dialogs)
  const [showCreateProjectModal, setShowCreateProjectModal] = useState<boolean>(false);
  const [showGenerateModal, setShowGenerateModal] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showProjectsModal, setShowProjectsModal] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showAddVideoModal, setShowAddVideoModal] = useState<boolean>(false);
  const [showTranslateModal, setShowTranslateModal] = useState<boolean>(false);
  const [showAiPolishModal, setShowAiPolishModal] = useState<boolean>(false);
  const [showTimeShiftModal, setShowTimeShiftModal] = useState<boolean>(false);
  const [showStyleModal, setShowStyleModal] = useState<boolean>(false);
  const [showBackgroundLoopModal, setShowBackgroundLoopModal] = useState<boolean>(false);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);

  const handleAdminLogin = () => {
    setIsAdminSession(true);
    localStorage.setItem('subcraft_admin_session', 'true');
    setCurrentView('dashboard');
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFirstRender = useRef<boolean>(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedMediaKeyRef = useRef<string>('');
  const projectCreatedAtRef = useRef<string>(new Date().toISOString());

  // Undo / Redo history stack
  const historyRef = useRef<HistorySnapshot[]>([
    cloneSnapshot({
      subtitles,
      style,
      projectTitle,
      selectedCueId,
    }),
  ]);
  const historyIndexRef = useRef<number>(0);
  const isRestoringHistoryRef = useRef<boolean>(false);
  const historyDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const latestStateRef = useRef<HistorySnapshot>({
    subtitles,
    style,
    projectTitle,
    selectedCueId,
  });
  latestStateRef.current = { subtitles, style, projectTitle, selectedCueId };

  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const [historyToast, setHistoryToast] = useState<{ label: string; type: 'undo' | 'redo' } | null>(null);
  const historyToastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showHistoryFeedback = useCallback((label: string, type: 'undo' | 'redo') => {
    setHistoryToast({ label, type });
    if (historyToastTimerRef.current) clearTimeout(historyToastTimerRef.current);
    historyToastTimerRef.current = setTimeout(() => {
      setHistoryToast(null);
    }, 1800);
  }, []);

  const syncHistoryFlags = useCallback(() => {
    const idx = historyIndexRef.current;
    const len = historyRef.current.length;
    const committed = idx >= 0 && idx < len ? historyRef.current[idx] : null;
    const hasPendingDiff = committed
      ? serializeHistoryState(latestStateRef.current) !== serializeHistoryState(committed)
      : false;
    setCanUndo(idx > 0 || hasPendingDiff);
    setCanRedo(idx >= 0 && idx < len - 1);
  }, []);

  const resetHistory = useCallback((snap: HistorySnapshot) => {
    if (historyDebounceRef.current) {
      clearTimeout(historyDebounceRef.current);
      historyDebounceRef.current = null;
    }
    isRestoringHistoryRef.current = true;
    historyRef.current = [cloneSnapshot(snap)];
    historyIndexRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
    setTimeout(() => {
      isRestoringHistoryRef.current = false;
    }, 0);
  }, []);

  const commitHistorySnapshot = useCallback((snap: HistorySnapshot) => {
    const currentIdx = historyIndexRef.current;
    const currentCommitted = historyRef.current[currentIdx];
    const nextSerialized = serializeHistoryState(snap);
    if (currentCommitted && serializeHistoryState(currentCommitted) === nextSerialized) {
      syncHistoryFlags();
      return false;
    }

    const nextStack = historyRef.current.slice(0, currentIdx + 1);
    nextStack.push(cloneSnapshot(snap));
    if (nextStack.length > MAX_HISTORY_STEPS) {
      nextStack.shift();
    }
    historyRef.current = nextStack;
    historyIndexRef.current = nextStack.length - 1;
    syncHistoryFlags();
    return true;
  }, [syncHistoryFlags]);

  // Sync dark mode class on document element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('subcraft_dark_mode', String(darkMode));
  }, [darkMode]);

  // Firebase auth state observer, connection test, and project + media restoration
  useEffect(() => {
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setSaveStatus('offline');
      }
    });

    let cancelled = false;

    restoreLastProject().then(async (savedProj) => {
      if (cancelled || !savedProj) return;

      const restoredTitle = savedProj.title || 'Mi Proyecto de Video';
      const restoredSubtitles =
        savedProj.subtitles && savedProj.subtitles.length > 0
          ? ensureUniqueCueIds(savedProj.subtitles)
          : [];
      const restoredStyle = savedProj.style || DEFAULT_STYLE;

      setProjectId(savedProj.id);
      setProjectTitle(restoredTitle);
      projectCreatedAtRef.current = savedProj.createdAt || new Date().toISOString();
      setSubtitles(restoredSubtitles);
      if (savedProj.style) {
        setStyle(restoredStyle);
      }
      if (savedProj.language) setLanguage(savedProj.language);
      if (savedProj.targetLanguage) setTargetLanguage(savedProj.targetLanguage);
      if (savedProj.videoDuration) setDuration(savedProj.videoDuration);
      setVideoFileName(savedProj.videoFileName || '');

      resetHistory({
        subtitles: restoredSubtitles,
        style: restoredStyle,
        projectTitle: restoredTitle,
        selectedCueId: restoredSubtitles.length > 0 ? restoredSubtitles[0].id : null,
      });

      const isSample = savedProj.videoFileName === SAMPLE_VIDEO_NAME;
      if (!isSample) {
        // Prevent displaying sample video while custom media is loading
        setVideoUrl(null);
      }

      // Restore saved video/audio binary from IndexedDB or backend backup
      const media = await resolveMediaFile(savedProj.id);
      if (cancelled) return;

      if (media && media.blob) {
        const restoredUrl = URL.createObjectURL(media.blob);
        const restoredFile =
          media.blob instanceof File
            ? media.blob
            : new File([media.blob], media.fileName || savedProj.videoFileName || 'media', {
                type: media.fileType || 'video/mp4',
              });
        savedMediaKeyRef.current = `${savedProj.id}:${restoredFile.name}:${restoredFile.size}`;
        setVideoUrl(restoredUrl);
        setVideoFileName(media.fileName || savedProj.videoFileName || '');
        setVideoFile(restoredFile);
      } else if (isSample) {
        setVideoUrl(SAMPLE_VIDEO_URL);
        setVideoFileName(SAMPLE_VIDEO_NAME);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [resetHistory]);

  // Debounced auto-save function
  const triggerAutoSave = useCallback(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      const activeUserId = user ? user.uid : (isAdminSession ? 'admin_jordas' : 'anonymous');
      const projectPayload: SubtitleProject = {
        id: projectId,
        userId: activeUserId,
        title: projectTitle,
        videoFileName,
        videoDuration: duration,
        language,
        targetLanguage,
        subtitles,
        style,
        createdAt: projectCreatedAtRef.current,
        updatedAt: new Date().toISOString(),
      };

      try {
        await saveProject(projectPayload);
        if (videoFile) {
          const mediaKey = `${projectId}:${videoFile.name}:${videoFile.size}`;
          if (savedMediaKeyRef.current !== mediaKey) {
            await saveAndSyncMediaFile(projectId, videoFile, videoFileName || videoFile.name);
            savedMediaKeyRef.current = mediaKey;
          }
        }
        setSaveStatus(user || isAdminSession ? 'saved' : 'offline');
      } catch (err) {
        console.warn('Auto-save warning:', err);
        setSaveStatus(isAdminSession ? 'saved' : 'offline');
      }
    }, 800);
  }, [projectId, projectTitle, videoFileName, videoFile, duration, language, targetLanguage, subtitles, style, user, isAdminSession]);

  const [showSaveToast, setShowSaveToast] = useState<boolean>(false);

  // Manual save project function
  const handleManualSaveProject = async () => {
    setSaveStatus('saving');
    const activeUserId = user ? user.uid : (isAdminSession ? 'admin_jordas' : 'anonymous');
    const projectPayload: SubtitleProject = {
      id: projectId,
      userId: activeUserId,
      title: projectTitle,
      videoFileName,
      videoDuration: duration,
      language,
      targetLanguage,
      subtitles,
      style,
      createdAt: projectCreatedAtRef.current,
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveProject(projectPayload);
      if (videoFile) {
        await saveAndSyncMediaFile(projectId, videoFile, videoFileName || videoFile.name);
        savedMediaKeyRef.current = `${projectId}:${videoFile.name}:${videoFile.size}`;
      }
      setSaveStatus(user || isAdminSession ? 'saved' : 'offline');
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 3500);
    } catch (err) {
      console.warn('Manual save warning:', err);
      setSaveStatus(isAdminSession ? 'saved' : 'offline');
    }
  };

  // Logout handler to sign out and return to landing / sign-in screen
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    }
    setUser(null);
    try {
      sessionStorage.removeItem('subcraft_current_view');
    } catch {}
    setCurrentView('landing');
    setShowAuthModal(false);
  };

  // Trigger auto-save & coalesced Undo history tracking whenever subtitles, styling, or title changes
  useEffect(() => {
    triggerAutoSave();

    if (isRestoringHistoryRef.current) return;

    const currentSnapshot: HistorySnapshot = {
      subtitles,
      style,
      projectTitle,
      selectedCueId: latestStateRef.current.selectedCueId,
    };

    const committed = historyRef.current[historyIndexRef.current];
    if (!committed) {
      historyRef.current = [cloneSnapshot(currentSnapshot)];
      historyIndexRef.current = 0;
      syncHistoryFlags();
      return;
    }

    if (serializeHistoryState(currentSnapshot) !== serializeHistoryState(committed)) {
      setCanUndo(true);
      if (historyDebounceRef.current) {
        clearTimeout(historyDebounceRef.current);
      }
      historyDebounceRef.current = setTimeout(() => {
        historyDebounceRef.current = null;
        if (!isRestoringHistoryRef.current) {
          commitHistorySnapshot(latestStateRef.current);
        }
      }, 350);
    }
  }, [subtitles, style, projectTitle, language, targetLanguage, triggerAutoSave, commitHistorySnapshot, syncHistoryFlags]);

  const applyRestoredSnapshot = useCallback((target: HistorySnapshot) => {
    isRestoringHistoryRef.current = true;
    const cloned = cloneSnapshot(target);
    setSubtitles(cloned.subtitles);
    setStyle(cloned.style);
    setProjectTitle(cloned.projectTitle);

    const hasPrevSelected =
      cloned.selectedCueId !== null &&
      cloned.subtitles.some((c) => String(c.id) === String(cloned.selectedCueId));
    if (hasPrevSelected) {
      setSelectedCueId(cloned.selectedCueId);
    } else if (cloned.subtitles.length > 0) {
      setSelectedCueId(cloned.subtitles[0].id);
    } else {
      setSelectedCueId(null);
    }

    setTimeout(() => {
      isRestoringHistoryRef.current = false;
      syncHistoryFlags();
    }, 0);
  }, [syncHistoryFlags]);

  const handleUndo = useCallback(() => {
    if (historyDebounceRef.current) {
      clearTimeout(historyDebounceRef.current);
      historyDebounceRef.current = null;
    }

    // Flush any uncommitted change before stepping back so it stays on the redo stack
    const live = latestStateRef.current;
    const currentCommitted = historyRef.current[historyIndexRef.current];
    if (currentCommitted && serializeHistoryState(live) !== serializeHistoryState(currentCommitted)) {
      commitHistorySnapshot(live);
    }

    if (historyIndexRef.current <= 0) {
      syncHistoryFlags();
      return;
    }

    historyIndexRef.current -= 1;
    const target = historyRef.current[historyIndexRef.current];
    applyRestoredSnapshot(target);
    showHistoryFeedback('Cambio deshecho (Ctrl+Z)', 'undo');
  }, [applyRestoredSnapshot, commitHistorySnapshot, showHistoryFeedback, syncHistoryFlags]);

  const handleRedo = useCallback(() => {
    if (historyDebounceRef.current) {
      clearTimeout(historyDebounceRef.current);
      historyDebounceRef.current = null;
    }

    if (historyIndexRef.current >= historyRef.current.length - 1) {
      syncHistoryFlags();
      return;
    }

    historyIndexRef.current += 1;
    const target = historyRef.current[historyIndexRef.current];
    applyRestoredSnapshot(target);
    showHistoryFeedback('Cambio rehecho (Ctrl+Y)', 'redo');
  }, [applyRestoredSnapshot, showHistoryFeedback, syncHistoryFlags]);

  // Unified synchronization handlers for playhead & cue selection
  const handleSelectCue = useCallback(
    (id: string | number) => {
      setSelectedCueId(id);
      const cue = subtitles.find((c) => String(c.id) === String(id));
      if (cue) {
        setCurrentTime(cue.start + 0.01);
        setIsPlaying(false);
      }
    },
    [subtitles]
  );

  const handleSeek = useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(duration, time));
      setCurrentTime(clamped);
      const active = subtitles.find((c) => clamped >= c.start - 0.05 && clamped <= c.end + 0.05);
      setSelectedCueId(active ? active.id : null);
    },
    [duration, subtitles]
  );

  const handleTimeUpdate = useCallback(
    (time: number) => {
      setCurrentTime(time);
      if (isPlaying) {
        const active = subtitles.find((c) => time >= c.start - 0.05 && time <= c.end + 0.05);
        setSelectedCueId((prev) => {
          const nextId = active ? active.id : null;
          return prev === nextId ? prev : nextId;
        });
      }
    },
    [isPlaying, subtitles]
  );

  const handleDeleteCue = useCallback(
    (id: string | number) => {
      const idx = subtitles.findIndex((cue) => String(cue.id) === String(id));
      const next = subtitles.filter((cue) => String(cue.id) !== String(id));
      setSubtitles(next);

      if (String(selectedCueId) === String(id)) {
        if (next.length > 0) {
          const fallbackIdx = Math.min(Math.max(0, idx), next.length - 1);
          setSelectedCueId(next[fallbackIdx].id);
        } else {
          setSelectedCueId(null);
        }
      }
    },
    [subtitles, selectedCueId]
  );

  // Global keyboard shortcuts (Ctrl+Z / Cmd+Z Undo, Ctrl+Y / Cmd+Shift+Z Redo, Space, Arrow keys)
  useEffect(() => {
    const hasOpenModal =
      showCreateProjectModal ||
      showGenerateModal ||
      showExportModal ||
      showProjectsModal ||
      showAuthModal ||
      showAddVideoModal ||
      showTranslateModal ||
      showAiPolishModal ||
      showTimeShiftModal ||
      showStyleModal ||
      showBackgroundLoopModal ||
      showAdminModal;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const activeTag = (activeEl?.tagName || '').toLowerCase();

      // Handle Undo (Ctrl+Z / Cmd+Z) and Redo (Ctrl+Y / Cmd+Shift+Z) inside Studio
      if (currentView === 'studio' && !hasOpenModal && (e.ctrlKey || e.metaKey) && !e.altKey) {
        const keyLower = e.key.toLowerCase();
        const isPasswordOrSearchInput =
          activeEl?.getAttribute('type') === 'password' ||
          activeEl?.getAttribute('data-no-global-undo') === 'true';

        if (!isPasswordOrSearchInput && keyLower === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
          return;
        }
        if (!isPasswordOrSearchInput && keyLower === 'y' && !e.shiftKey) {
          e.preventDefault();
          handleRedo();
          return;
        }
      }

      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        activeEl?.isContentEditable
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSeek(currentTime - 3);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSeek(currentTime + 3);
      } else if (
        currentView === 'studio' &&
        !hasOpenModal &&
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedCueId !== null &&
        selectedCueId !== undefined
      ) {
        e.preventDefault();
        handleDeleteCue(selectedCueId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentView,
    currentTime,
    selectedCueId,
    handleSeek,
    handleUndo,
    handleRedo,
    handleDeleteCue,
    showCreateProjectModal,
    showGenerateModal,
    showExportModal,
    showProjectsModal,
    showAuthModal,
    showAddVideoModal,
    showTranslateModal,
    showAiPolishModal,
    showTimeShiftModal,
    showStyleModal,
    showBackgroundLoopModal,
    showAdminModal,
  ]);

  // File upload handler (persists media binary + project metadata immediately)
  const handleSelectVideoFile = async (file: File) => {
    if (videoUrl && videoUrl !== SAMPLE_VIDEO_URL) {
      URL.revokeObjectURL(videoUrl);
    }
    const newUrl = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(newUrl);
    setVideoFileName(file.name);
    setCurrentTime(0);
    setIsPlaying(false);

    const isAudio =
      file.type.startsWith('audio/') ||
      /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name);

    const updatedStyle: SubtitleStyle = isAudio
      ? {
          ...style,
          isAudioMode: true,
          backgroundLoop: style.backgroundLoop || 'aurora-gradient',
        }
      : style;

    if (isAudio) {
      setStyle(updatedStyle);
      setActiveStudioTab('loops');
    }

    // Persist binary media immediately to IndexedDB & backend + update project record
    setSaveStatus('saving');
    savedMediaKeyRef.current = `${projectId}:${file.name}:${file.size}`;
    await saveAndSyncMediaFile(projectId, file, file.name);

    const activeUserId = user ? user.uid : (isAdminSession ? 'admin_jordas' : 'anonymous');
    await saveProject({
      id: projectId,
      userId: activeUserId,
      title: projectTitle,
      videoFileName: file.name,
      videoDuration: duration,
      language,
      targetLanguage,
      subtitles,
      style: updatedStyle,
      createdAt: projectCreatedAtRef.current,
      updatedAt: new Date().toISOString(),
    }).catch((err) => console.warn('Immediate project save warning:', err));

    setSaveStatus(user || isAdminSession ? 'saved' : 'offline');
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleSelectVideoFile(file);
    }
  };

  const handleLoadSampleVideo = () => {
    const sampleCues = ensureUniqueCueIds(INITIAL_SAMPLE_SUBTITLES);
    setVideoFile(null);
    setVideoUrl(SAMPLE_VIDEO_URL);
    setVideoFileName(SAMPLE_VIDEO_NAME);
    setSubtitles(sampleCues);
    setCurrentTime(0);
    setIsPlaying(false);
    resetHistory({
      subtitles: sampleCues,
      style,
      projectTitle,
      selectedCueId: sampleCues[0]?.id ?? null,
    });
  };

  // Subtitle cue operations with automatic forward shifting of subsequent cues
  const handleUpdateCue = (updatedCue: SubtitleCue) => {
    setSubtitles((prev) =>
      prev.map((cue) => (cue.id === updatedCue.id ? updatedCue : cue))
    );
  };

  const handleAddCue = (newCue: SubtitleCue, index?: number) => {
    setSubtitles((prev) => {
      const shiftAmount = Math.max(0.5, Math.round((newCue.end - newCue.start) * 100) / 100);

      // Shift subsequent cues that start at or after newCue.start forward
      const updatedPrev = prev.map((cue) => {
        // If cue starts at or after the new cue's start time, shift it forward by shiftAmount
        if (cue.start >= newCue.start) {
          return {
            ...cue,
            start: Math.round((cue.start + shiftAmount) * 100) / 100,
            end: Math.round((cue.end + shiftAmount) * 100) / 100,
          };
        }
        // If cue overlaps with newCue.start, trim its end time to newCue.start
        if (cue.start < newCue.start && cue.end > newCue.start) {
          return {
            ...cue,
            end: Math.round(newCue.start * 100) / 100,
          };
        }
        return cue;
      });

      const next = [...updatedPrev, newCue];
      return next.sort((a, b) => a.start - b.start);
    });
  };

  const handleMergeWithNext = (index: number) => {
    if (index >= subtitles.length - 1) return;
    const currentCue = subtitles[index];
    const nextCue = subtitles[index + 1];

    const mergedCue: SubtitleCue = {
      ...currentCue,
      end: nextCue.end,
      text: `${currentCue.text.trim()} ${nextCue.text.trim()}`,
    };

    setSubtitles((prev) => {
      const updated = [...prev];
      updated.splice(index, 2, mergedCue);
      return updated;
    });
  };

  const handleSplitCue = (index: number) => {
    const cue = subtitles[index];
    const words = cue.text.trim().split(/\s+/);
    if (words.length <= 1) return;

    const midWordIdx = Math.ceil(words.length / 2);
    const text1 = words.slice(0, midWordIdx).join(' ');
    const text2 = words.slice(midWordIdx).join(' ');

    const midTime = cue.start + (cue.end - cue.start) / 2;

    const cue1: SubtitleCue = {
      ...cue,
      end: Math.round(midTime * 100) / 100,
      text: text1,
    };

    const cue2: SubtitleCue = {
      id: Date.now(),
      start: Math.round(midTime * 100) / 100,
      end: cue.end,
      text: text2,
      speaker: cue.speaker,
    };

    setSubtitles((prev) => {
      const updated = [...prev];
      updated.splice(index, 1, cue1, cue2);
      return updated;
    });
  };

  const handlePlaySpan = (start: number, _end: number) => {
    const active = subtitles.find((c) => start >= c.start - 0.05 && start <= c.end + 0.05);
    if (active) setSelectedCueId(active.id);
    setCurrentTime(start + 0.01);
    setIsPlaying(true);
  };

  const handleImportSrt = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseSrt(text);
      if (parsed.length > 0) {
        setSubtitles(ensureUniqueCueIds(parsed));
      }
    } catch (err) {
      console.error('Error importing SRT:', err);
    }
  };

  const handleSelectSavedProject = async (proj: SubtitleProject) => {
    try {
      setIsPlaying(false);
      setCurrentProjectId(proj.id);
      projectCreatedAtRef.current = proj.createdAt || new Date().toISOString();

      let restoredUrl: string | null = null;
      let restoredFile: File | null = null;
      let fileName = proj.videoFileName || '';

      // 1. Retrieve saved video or audio file from IndexedDB or backend server
      try {
        const media = await resolveMediaFile(proj.id);
        if (media && media.blob) {
          restoredUrl = URL.createObjectURL(media.blob);
          fileName = media.fileName || proj.videoFileName || 'media';
          restoredFile =
            media.blob instanceof File
              ? media.blob
              : new File([media.blob], fileName, { type: media.fileType || 'video/mp4' });
          savedMediaKeyRef.current = `${proj.id}:${restoredFile.name}:${restoredFile.size}`;
        } else if (proj.videoFileName === SAMPLE_VIDEO_NAME) {
          restoredUrl = SAMPLE_VIDEO_URL;
          fileName = SAMPLE_VIDEO_NAME;
          savedMediaKeyRef.current = '';
        } else {
          savedMediaKeyRef.current = '';
        }
      } catch (mediaErr) {
        console.warn('Media file restore warning:', mediaErr);
        if (proj.videoFileName === SAMPLE_VIDEO_NAME) {
          restoredUrl = SAMPLE_VIDEO_URL;
          fileName = SAMPLE_VIDEO_NAME;
        }
      }

      // Revoke previous blob URL if needed
      if (videoUrl && videoUrl !== SAMPLE_VIDEO_URL) {
        URL.revokeObjectURL(videoUrl);
      }

      const loadedSubtitles = ensureUniqueCueIds(proj.subtitles || []);
      const loadedTitle = proj.title || 'Mi Proyecto de Video';
      const loadedStyle = proj.style || style;
      const loadedSelectedId = loadedSubtitles.length > 0 ? loadedSubtitles[0].id : null;

      // 2. Batch state updates together so studio opens with restored media immediately
      setProjectId(proj.id);
      setProjectTitle(loadedTitle);
      setSubtitles(loadedSubtitles);
      if (proj.style) setStyle(proj.style);
      if (proj.language) setLanguage(proj.language);
      if (proj.targetLanguage) setTargetLanguage(proj.targetLanguage);
      if (proj.videoDuration) setDuration(proj.videoDuration);
      setVideoFileName(fileName);
      setVideoFile(restoredFile);
      setVideoUrl(restoredUrl);
      setSelectedCueId(loadedSelectedId);
      setCurrentTime(0);

      resetHistory({
        subtitles: loadedSubtitles,
        style: loadedStyle,
        projectTitle: loadedTitle,
        selectedCueId: loadedSelectedId,
      });

      // Save as active project in local storage
      try {
        localStorage.setItem('subcraft_current_project', JSON.stringify(proj));
      } catch (err) {
        console.warn(err);
      }
    } catch (err) {
      console.warn('Error opening saved project:', err);
    } finally {
      // ALWAYS switch view to studio & close modal
      setCurrentView('studio');
      setShowProjectsModal(false);
    }
  };

  const handleCreateNewProject = () => {
    setShowCreateProjectModal(true);
  };

  const handleCreateConfiguredProject = async (data: {
    title: string;
    mediaFile: File | null;
    mediaUrl: string | null;
    mediaFileName: string;
    duration?: number;
    language: string;
    isAudioMode: boolean;
    style?: SubtitleStyle;
    preset?: any;
    initialSubtitles?: any[];
  }) => {
    const newId = `proj_${Date.now()}`;
    const nowIso = new Date().toISOString();
    projectCreatedAtRef.current = nowIso;
    setCurrentProjectId(newId);

    const initialCues =
      data.initialSubtitles && data.initialSubtitles.length > 0
        ? ensureUniqueCueIds(data.initialSubtitles)
        : [];
    const nextStyle = data.style || style;
    const nextTitle = data.title || 'Nuevo Proyecto';
    const nextLang = data.language || language;
    const nextDuration = data.duration || duration;

    if (videoUrl && videoUrl !== SAMPLE_VIDEO_URL && videoUrl !== data.mediaUrl) {
      URL.revokeObjectURL(videoUrl);
    }

    const initialSelectedId = initialCues.length > 0 ? initialCues[0].id : null;
    setProjectId(newId);
    setProjectTitle(nextTitle);
    setSubtitles(initialCues);
    setStyle(nextStyle);
    setLanguage(nextLang);
    setVideoFileName(data.mediaFileName || '');
    setVideoFile(data.mediaFile);
    setVideoUrl(data.mediaUrl);
    if (data.duration) {
      setDuration(data.duration);
    }
    setCurrentTime(0);
    setIsPlaying(false);
    setSelectedCueId(initialSelectedId);

    resetHistory({
      subtitles: initialCues,
      style: nextStyle,
      projectTitle: nextTitle,
      selectedCueId: initialSelectedId,
    });

    setShowCreateProjectModal(false);
    setCurrentView('studio');

    // Save media binary and project metadata immediately so it never disappears on reload
    setSaveStatus('saving');
    if (data.mediaFile) {
      savedMediaKeyRef.current = `${newId}:${data.mediaFile.name}:${data.mediaFile.size}`;
      await saveAndSyncMediaFile(newId, data.mediaFile, data.mediaFileName || data.mediaFile.name);
    } else {
      savedMediaKeyRef.current = '';
    }

    const activeUserId = user ? user.uid : (isAdminSession ? 'admin_jordas' : 'anonymous');
    await saveProject({
      id: newId,
      userId: activeUserId,
      title: nextTitle,
      videoFileName: data.mediaFileName || '',
      videoDuration: nextDuration,
      language: nextLang,
      targetLanguage: nextLang,
      subtitles: initialCues,
      style: nextStyle,
      createdAt: nowIso,
      updatedAt: nowIso,
    }).catch((err) => console.warn('Initial project save warning:', err));

    setSaveStatus(user || isAdminSession ? 'saved' : 'offline');
  };

  if (currentView === 'landing') {
    return (
      <>
        <LandingPage
          user={user}
          onEnterStudio={() => setCurrentView('studio')}
          onOpenDashboard={() => setCurrentView('dashboard')}
          onUploadVideoDirect={(file) => {
            handleSelectVideoFile(file);
            setCurrentView('studio');
          }}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          onAdminLogin={handleAdminLogin}
        />

        {showProjectsModal && (
          <ProjectsModal
            currentProjectId={projectId}
            user={user}
            isAdmin={isAdmin}
            onSelectProject={handleSelectSavedProject}
            onNewProject={handleCreateNewProject}
            onLoginClick={() => setShowAuthModal(true)}
            onClose={() => setShowProjectsModal(false)}
          />
        )}

        {showCreateProjectModal && (
          <CreateProjectModal
            onClose={() => setShowCreateProjectModal(false)}
            onCreateProject={handleCreateConfiguredProject}
          />
        )}

        {showAuthModal && (
          <AuthModal
            user={user}
            onClose={() => setShowAuthModal(false)}
            onLogoutSuccess={() => setCurrentView('landing')}
            onAdminLogin={handleAdminLogin}
            onLoginSuccess={() => setCurrentView('dashboard')}
          />
        )}
      </>
    );
  }

  if (currentView === 'dashboard') {
    return (
      <>
        <ProjectsDashboard
          user={user}
          isAdmin={isAdmin}
          currentProjectId={projectId}
          onOpenProject={handleSelectSavedProject}
          onOpenCreateProjectModal={() => setShowCreateProjectModal(true)}
          onOpenStudioDirect={() => setCurrentView('studio')}
          onLogout={handleLogout}
        />

        {showCreateProjectModal && (
          <CreateProjectModal
            onClose={() => setShowCreateProjectModal(false)}
            onCreateProject={handleCreateConfiguredProject}
          />
        )}

        {showAuthModal && (
          <AuthModal
            user={user}
            onClose={() => setShowAuthModal(false)}
            onLogoutSuccess={() => setCurrentView('landing')}
            onAdminLogin={handleAdminLogin}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-neutral-200 dark:bg-[#050608] text-neutral-900 dark:text-neutral-100 flex flex-col font-sans transition-colors duration-200">
      {/* Hidden file input for video upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Top Studio Header */}
      <Navbar
        projectTitle={projectTitle}
        onTitleChange={setProjectTitle}
        saveStatus={saveStatus}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        user={user}
        isAdmin={isAdmin}
        onOpenAdmin={() => setShowAdminModal(true)}
        onLoginClick={() => setShowAuthModal(true)}
        onLogoutClick={handleLogout}
        onOpenProjects={() => setCurrentView('dashboard')}
        onNewProject={handleCreateNewProject}
        onSaveProject={handleManualSaveProject}
        onOpenExport={() => setShowExportModal(true)}
        onGoHome={() => setCurrentView(user || isAdmin ? 'dashboard' : 'landing')}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {/* Fixed-Proportion Studio Grid Dashboard (Script | Monitor | Inspector + Bottom Docked Timeline) */}
      <main className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[270px_minmax(0,1fr)_370px] xl:grid-cols-[310px_minmax(0,1fr)_410px] lg:grid-rows-[minmax(0,1fr)_235px] xl:grid-rows-[minmax(0,1fr)_250px] gap-[1px] bg-neutral-200 dark:bg-neutral-800/80">
        {/* Left Docked Panel: Cue Script & Search */}
        <aside className="hidden lg:flex lg:flex-col min-h-0 bg-white dark:bg-[#0e1017] overflow-hidden">
          <TranscriptPanel
            subtitles={subtitles}
            selectedCueId={selectedCueId}
            currentTime={currentTime}
            onSelectCue={handleSelectCue}
            onAddCueAtTime={(time) => {
              const newId = Date.now();
              handleAddCue({
                id: newId,
                start: Math.round(time * 100) / 100,
                end: Math.round((time + 2.5) * 100) / 100,
                text: 'Nuevo subtítulo...',
              });
              setSelectedCueId(newId);
              setCurrentTime(Math.round(time * 100) / 100 + 0.01);
              setIsPlaying(false);
            }}
            onImportSrt={handleImportSrt}
          />
        </aside>

        {/* Center Stage: Video Monitor & Docked Transport */}
        <section className="flex flex-col min-h-0 bg-white dark:bg-[#08090d] overflow-hidden">
          <VideoPlayer
            videoUrl={videoUrl}
            videoFileName={videoFileName}
            subtitles={subtitles}
            selectedCueId={selectedCueId}
            style={style}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            onTimeUpdate={handleTimeUpdate}
            onDurationChange={setDuration}
            onPlayPauseToggle={() => setIsPlaying(!isPlaying)}
            onSeek={handleSeek}
            onUploadNewVideo={() => setShowAddVideoModal(true)}
            onLoadSampleVideo={handleLoadSampleVideo}
            onOpenBackgroundLoopModal={() => setActiveStudioTab('loops')}
            onUpdateCue={handleUpdateCue}
          />
        </section>

        {/* Right Docked Panel: Precision Inspector */}
        <aside className="flex flex-col min-h-0 bg-white dark:bg-[#0e1017] overflow-hidden">
          <StudioInspector
            activeTab={activeStudioTab}
            onChangeTab={setActiveStudioTab}
            subtitles={subtitles}
            selectedCueId={selectedCueId}
            onSelectCue={handleSelectCue}
            currentTime={currentTime}
            duration={duration}
            style={style}
            onChangeStyle={setStyle}
            onUpdateCue={handleUpdateCue}
            onDeleteCue={handleDeleteCue}
            onAddCue={handleAddCue}
            onMergeWithNext={handleMergeWithNext}
            onSplitCue={handleSplitCue}
            onSeek={handleSeek}
            onPlaySpan={handlePlaySpan}
            onImportSrt={handleImportSrt}
            onOpenGenerate={() => setShowGenerateModal(true)}
            onOpenExport={() => setShowExportModal(true)}
            onApplyTimeShift={setSubtitles}
            onRestoreSampleSubtitles={() => setSubtitles(ensureUniqueCueIds(INITIAL_SAMPLE_SUBTITLES))}
            videoFile={videoFile}
            videoUrl={videoUrl}
            language={language}
          />
        </aside>

        {/* Bottom Docked Multitrack Timeline */}
        <section className="lg:col-span-3 min-h-[225px] lg:min-h-0 bg-white dark:bg-[#0b0c10] overflow-hidden flex flex-col">
          <SubtitleTimeline
            subtitles={subtitles}
            duration={duration}
            currentTime={currentTime}
            selectedCueId={selectedCueId}
            onSeek={handleSeek}
            onPause={() => setIsPlaying(false)}
            onUpdateCue={handleUpdateCue}
            onDeleteCue={handleDeleteCue}
            onAddCueAtTime={(time) => {
              const newId = Date.now();
              handleAddCue({
                id: newId,
                start: Math.round(time * 100) / 100,
                end: Math.round((time + 2.5) * 100) / 100,
                text: 'Nuevo subtítulo...',
              });
              setSelectedCueId(newId);
              setCurrentTime(Math.round(time * 100) / 100 + 0.01);
              setIsPlaying(false);
            }}
            onSelectCue={handleSelectCue}
          />
        </section>
      </main>

      {/* Heavy Flow Modals */}
      {showGenerateModal && (
        <GenerateModal
          currentVideoFile={videoFile}
          currentVideoUrl={videoUrl}
          videoDuration={duration}
          onSubtitlesGenerated={(newCues, detectedLang) => {
            setSubtitles(ensureUniqueCueIds(newCues));
            if (detectedLang) setLanguage(detectedLang);
          }}
          onVideoSelected={handleSelectVideoFile}
          onClose={() => setShowGenerateModal(false)}
        />
      )}

      {showExportModal && (
        <ExportModal
          projectTitle={projectTitle}
          subtitles={subtitles}
          style={style}
          videoUrl={videoUrl}
          videoDuration={duration}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showProjectsModal && (
        <ProjectsModal
          currentProjectId={projectId}
          user={user}
          isAdmin={isAdmin}
          onSelectProject={handleSelectSavedProject}
          onNewProject={handleCreateNewProject}
          onLoginClick={() => setShowAuthModal(true)}
          onClose={() => setShowProjectsModal(false)}
        />
      )}

      {showCreateProjectModal && (
        <CreateProjectModal
          onClose={() => setShowCreateProjectModal(false)}
          onCreateProject={handleCreateConfiguredProject}
        />
      )}

      {showAuthModal && (
        <AuthModal
          user={user}
          onClose={() => setShowAuthModal(false)}
          onLogoutSuccess={() => setCurrentView('landing')}
          onAdminLogin={handleAdminLogin}
        />
      )}

      {showAdminModal && (
        <AdminModal
          adminEmail="jordasx00x@gmail.com"
          projectsCount={subtitles.length > 0 ? 1 : 0}
          onClose={() => setShowAdminModal(false)}
        />
      )}

      {showAddVideoModal && (
        <AddVideoModal
          onVideoFileSelected={(file) => {
            handleSelectVideoFile(file);
            setShowAddVideoModal(false);
            setShowGenerateModal(true);
          }}
          onVideoBlobUrlLoaded={(url, title, dur) => {
            setVideoFile(null);
            setVideoUrl(url);
            setVideoFileName(title);
            if (dur) setDuration(dur);
            setCurrentTime(0);
            setIsPlaying(false);
            setShowAddVideoModal(false);
            setShowGenerateModal(true);
          }}
          onLoadSampleVideo={() => {
            handleLoadSampleVideo();
            setShowAddVideoModal(false);
          }}
          onClose={() => setShowAddVideoModal(false)}
        />
      )}

      {showTranslateModal && (
        <TranslateModal
          subtitles={subtitles}
          currentLanguage={language}
          onTranslationComplete={(translatedCues, targetName) => {
            setSubtitles(translatedCues);
            setTargetLanguage(targetName);
          }}
          onClose={() => setShowTranslateModal(false)}
        />
      )}

      {showAiPolishModal && (
        <AiPolishModal
          subtitles={subtitles}
          onApplyPolishedSubtitles={setSubtitles}
          onClose={() => setShowAiPolishModal(false)}
        />
      )}

      {showTimeShiftModal && (
        <TimeShiftModal
          subtitles={subtitles}
          onApplyTimeShift={setSubtitles}
          onClose={() => setShowTimeShiftModal(false)}
        />
      )}

      {showStyleModal && (
        <StyleEditor
          style={style}
          onChangeStyle={setStyle}
          onClose={() => setShowStyleModal(false)}
        />
      )}

      {showBackgroundLoopModal && (
        <BackgroundLoopModal
          style={style}
          onChangeStyle={setStyle}
          onClose={() => setShowBackgroundLoopModal(false)}
        />
      )}

      {/* Floating Save Toast Notification */}
      {showSaveToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white font-bold text-xs px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
          <span>¡Proyecto "{projectTitle}" guardado correctamente en Mis Proyectos!</span>
        </div>
      )}

      {/* Subtle Undo/Redo Toast Feedback */}
      {historyToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-neutral-900/95 dark:bg-neutral-100 text-white dark:text-neutral-950 font-semibold text-xs px-3.5 py-2 rounded-lg shadow-xl border border-neutral-800 dark:border-neutral-300 flex items-center gap-2 pointer-events-none">
          {historyToast.type === 'undo' ? (
            <Undo2 className="w-3.5 h-3.5 text-indigo-400 dark:text-indigo-600 shrink-0" />
          ) : (
            <Redo2 className="w-3.5 h-3.5 text-indigo-400 dark:text-indigo-600 shrink-0" />
          )}
          <span>{historyToast.label}</span>
        </div>
      )}
    </div>
  );
}
