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
  getLocalCurrentProject,
} from './services/projectService';
import { saveMediaFile, getMediaFile } from './services/mediaStore';
import { CheckCircle2 } from 'lucide-react';
import { parseSrt, ensureUniqueCueIds } from './utils/subtitleFormats';
import {
  SAMPLE_VIDEO_URL,
  SAMPLE_VIDEO_NAME,
  INITIAL_SAMPLE_SUBTITLES,
} from './utils/sampleData';

// Components
import { Navbar } from './components/Navbar';
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
import { AddVideoModal } from './components/AddVideoModal';
import { BackgroundLoopModal } from './components/BackgroundLoopModal';
import { StyleEditor } from './components/StyleEditor';
import { AdminModal } from './components/AdminModal';

export default function App() {
  // Navigation view: 'landing' (login & presentation) or 'studio' (editor)
  const [currentView, setCurrentView] = useState<'landing' | 'studio'>('landing');

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
    setCurrentView('studio');
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFirstRender = useRef<boolean>(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync dark mode class on document element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('subcraft_dark_mode', String(darkMode));
  }, [darkMode]);

  // Firebase auth state observer & connection test
  useEffect(() => {
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setSaveStatus('offline');
      }
    });

    // Restore cached project from local storage if available
    const localProj = getLocalCurrentProject();
    if (localProj && isFirstRender.current) {
      setProjectId(localProj.id);
      setProjectTitle(localProj.title || 'Mi Proyecto de Video');
      if (localProj.subtitles && localProj.subtitles.length > 0) {
        setSubtitles(ensureUniqueCueIds(localProj.subtitles));
      }
      if (localProj.style) {
        setStyle(localProj.style);
      }
      if (localProj.language) setLanguage(localProj.language);
      if (localProj.targetLanguage) setTargetLanguage(localProj.targetLanguage);
      if (localProj.videoFileName) setVideoFileName(localProj.videoFileName);

      // Restore saved video/audio binary file from IndexedDB
      getMediaFile(localProj.id).then((media) => {
        if (media) {
          const restoredUrl = URL.createObjectURL(media.blob);
          setVideoUrl(restoredUrl);
          setVideoFileName(media.fileName);
          const restoredFile =
            media.blob instanceof File
              ? media.blob
              : new File([media.blob], media.fileName, { type: media.fileType });
          setVideoFile(restoredFile);
        }
      });
    }

    return () => unsubscribe();
  }, []);

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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        await saveProject(projectPayload);
        if (videoFile) {
          await saveMediaFile(projectId, videoFile, videoFileName);
        }
        setSaveStatus(user || isAdminSession ? 'saved' : 'offline');
      } catch (err) {
        console.warn('Auto-save warning:', err);
        setSaveStatus(isAdminSession ? 'saved' : 'offline');
      }
    }, 1200);
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveProject(projectPayload);
      if (videoFile) {
        await saveMediaFile(projectId, videoFile, videoFileName);
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
    setCurrentView('landing');
    setShowAuthModal(false);
  };

  // Trigger auto-save whenever subtitles, styling, or title changes
  useEffect(() => {
    triggerAutoSave();
  }, [subtitles, style, projectTitle, language, targetLanguage, triggerAutoSave]);

  // Global keyboard shortcuts (Space to Play/Pause, Arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setCurrentTime((prev) => Math.max(0, prev - 3));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setCurrentTime((prev) => Math.min(duration, prev + 3));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [duration]);

  // File upload handler
  const handleSelectVideoFile = (file: File) => {
    if (videoUrl && videoUrl !== SAMPLE_VIDEO_URL) {
      URL.revokeObjectURL(videoUrl);
    }
    const newUrl = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(newUrl);
    setVideoFileName(file.name);
    setCurrentTime(0);
    setIsPlaying(false);

    // Save media file persistently in IndexedDB
    saveMediaFile(projectId, file, file.name);

    const isAudio =
      file.type.startsWith('audio/') ||
      /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name);

    if (isAudio) {
      setStyle((prev) => ({
        ...prev,
        isAudioMode: true,
        backgroundLoop: prev.backgroundLoop || 'aurora-gradient',
      }));
      setActiveStudioTab('loops');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleSelectVideoFile(file);
    }
  };

  const handleLoadSampleVideo = () => {
    setVideoFile(null);
    setVideoUrl(SAMPLE_VIDEO_URL);
    setVideoFileName(SAMPLE_VIDEO_NAME);
    setSubtitles(INITIAL_SAMPLE_SUBTITLES);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  // Subtitle cue operations with automatic forward shifting of subsequent cues
  const handleUpdateCue = (updatedCue: SubtitleCue) => {
    setSubtitles((prev) =>
      prev.map((cue) => (cue.id === updatedCue.id ? updatedCue : cue))
    );
  };

  const handleDeleteCue = (id: string | number) => {
    setSubtitles((prev) => prev.filter((cue) => cue.id !== id));
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

  const handlePlaySpan = (start: number, end: number) => {
    setCurrentTime(start);
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
      setProjectId(proj.id);
      setProjectTitle(proj.title || 'Mi Proyecto de Video');
      const loadedSubtitles = ensureUniqueCueIds(proj.subtitles || []);
      setSubtitles(loadedSubtitles);
      if (proj.style) setStyle(proj.style);
      if (proj.language) setLanguage(proj.language);
      if (proj.targetLanguage) setTargetLanguage(proj.targetLanguage);
      setVideoFileName(proj.videoFileName || SAMPLE_VIDEO_NAME);
      setSelectedCueId(loadedSubtitles.length > 0 ? loadedSubtitles[0].id : null);
      setCurrentTime(0);
      setIsPlaying(false);

      // Save as active project in local storage
      try {
        localStorage.setItem('subcraft_current_project', JSON.stringify(proj));
      } catch (err) {
        console.warn(err);
      }

      // Revoke previous custom video object url if needed
      if (videoUrl && videoUrl !== SAMPLE_VIDEO_URL) {
        URL.revokeObjectURL(videoUrl);
      }

      // Load media file for selected project from IndexedDB safely
      try {
        const media = await getMediaFile(proj.id);
        if (media && media.blob) {
          const restoredUrl = URL.createObjectURL(media.blob);
          setVideoUrl(restoredUrl);
          setVideoFileName(media.fileName);
          const restoredFile =
            media.blob instanceof File
              ? media.blob
              : new File([media.blob], media.fileName, { type: media.fileType });
          setVideoFile(restoredFile);
        } else if (proj.videoFileName === SAMPLE_VIDEO_NAME || !proj.videoFileName) {
          setVideoFile(null);
          setVideoUrl(SAMPLE_VIDEO_URL);
          setVideoFileName(SAMPLE_VIDEO_NAME);
        } else {
          setVideoFile(null);
          setVideoUrl(null);
        }
      } catch (mediaErr) {
        console.warn('Media file restore warning:', mediaErr);
        if (proj.videoFileName === SAMPLE_VIDEO_NAME || !proj.videoFileName) {
          setVideoFile(null);
          setVideoUrl(SAMPLE_VIDEO_URL);
          setVideoFileName(SAMPLE_VIDEO_NAME);
        }
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
    const newId = `proj_${Date.now()}`;
    setProjectId(newId);
    setProjectTitle('Nuevo Proyecto de Subtítulos');
    setSubtitles([]);
    setStyle(DEFAULT_STYLE);
    setCurrentTime(0);
    setIsPlaying(false);
    setSelectedCueId(null);
    setCurrentView('studio');
    setShowProjectsModal(false);
  };

  if (currentView === 'landing') {
    return (
      <>
        <LandingPage
          user={user}
          onEnterStudio={() => setCurrentView('studio')}
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
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans transition-colors duration-200">
      {/* Hidden file input for video upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Top Navbar */}
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
        onOpenProjects={() => setShowProjectsModal(true)}
        onNewProject={handleCreateNewProject}
        onSaveProject={handleManualSaveProject}
        onOpenExport={() => setShowExportModal(true)}
        onOpenStyle={() => setActiveStudioTab('style')}
        onOpenTranslate={() => setActiveStudioTab('tools')}
        onOpenGenerate={() => setShowGenerateModal(true)}
        onAddVideoClick={() => setShowAddVideoModal(true)}
        onGoHome={() => setCurrentView('landing')}
        onOpenBackgroundLoop={() => setActiveStudioTab('loops')}
      />

      {/* Main Studio Workspace Grid */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto p-2.5 sm:p-4 flex flex-col gap-3">
        {/* Top Section: Video Preview (7 cols) & Single Subtitle Inspector (5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
          {/* Left Column: Video Player with Direct On-Screen Subtitle Editing (lg: 7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <VideoPlayer
              videoUrl={videoUrl}
              videoFileName={videoFileName}
              subtitles={subtitles}
              selectedCueId={selectedCueId}
              style={style}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              onTimeUpdate={(time) => {
                setCurrentTime(time);
                if (isPlaying) {
                  const active = subtitles.find((c) => time >= c.start && time <= c.end);
                  if (active) {
                    setSelectedCueId(active.id);
                  }
                }
              }}
              onDurationChange={setDuration}
              onPlayPauseToggle={() => setIsPlaying(!isPlaying)}
              onSeek={(time) => {
                setCurrentTime(time);
                const active = subtitles.find((c) => time >= c.start && time <= c.end);
                if (active) {
                  setSelectedCueId(active.id);
                }
              }}
              onUploadNewVideo={() => setShowAddVideoModal(true)}
              onLoadSampleVideo={handleLoadSampleVideo}
              onOpenBackgroundLoopModal={() => setActiveStudioTab('loops')}
              onUpdateCue={handleUpdateCue}
            />
          </div>

          {/* Right Column: Single Selected Subtitle Inspector (lg: 5 cols) */}
          <div className="lg:col-span-5 flex flex-col h-full justify-between">
            <StudioInspector
              activeTab={activeStudioTab}
              onChangeTab={setActiveStudioTab}
              subtitles={subtitles}
              selectedCueId={selectedCueId}
              onSelectCue={setSelectedCueId}
              currentTime={currentTime}
              duration={duration}
              style={style}
              onChangeStyle={setStyle}
              onUpdateCue={handleUpdateCue}
              onDeleteCue={handleDeleteCue}
              onAddCue={handleAddCue}
              onMergeWithNext={handleMergeWithNext}
              onSplitCue={handleSplitCue}
              onSeek={(time) => {
                setCurrentTime(time);
                const active = subtitles.find((c) => time >= c.start && time <= c.end);
                if (active) {
                  setSelectedCueId(active.id);
                }
              }}
              onPlaySpan={handlePlaySpan}
              onImportSrt={handleImportSrt}
              onOpenGenerate={() => setShowGenerateModal(true)}
              onOpenExport={() => setShowExportModal(true)}
              onApplyTimeShift={setSubtitles}
            />
          </div>
        </div>

        {/* Bottom Section: Full-Width Spaced Multitrack Visual Timeline (col-span-12) */}
        <div className="w-full">
          <SubtitleTimeline
            subtitles={subtitles}
            duration={duration}
            currentTime={currentTime}
            selectedCueId={selectedCueId}
            onSeek={setCurrentTime}
            onPause={() => setIsPlaying(false)}
            onUpdateCue={handleUpdateCue}
            onAddCueAtTime={(time) => {
              const newId = Date.now();
              handleAddCue({
                id: newId,
                start: Math.round(time * 100) / 100,
                end: Math.round((time + 2.5) * 100) / 100,
                text: 'Nuevo subtítulo...',
              });
              setSelectedCueId(newId);
            }}
            onSelectCue={(id) => {
              setSelectedCueId(id);
              const cue = subtitles.find((c) => String(c.id) === String(id));
              if (cue) {
                setCurrentTime(cue.start);
                setIsPlaying(false);
              }
            }}
          />
        </div>
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
    </div>
  );
}
