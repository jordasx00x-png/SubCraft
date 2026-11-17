import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { SubtitleProject } from '../types/subtitle';
import {
  deleteMediaFile,
  saveProjectRecord,
  getProjectRecord,
  getAllProjectRecords,
  deleteProjectRecord,
} from './mediaStore';

const LOCAL_STORAGE_KEY = 'subcraft_current_project';
const LOCAL_PROJECT_ID_KEY = 'subcraft_current_project_id';
const LOCAL_PROJECTS_KEY = 'subcraft_local_projects';

/**
 * Recursively remove undefined values so Firestore setDoc never rejects optional fields
 */
function stripUndefined<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        result[k] = stripUndefined(v);
      }
    }
    return result as T;
  }
  return obj;
}

export function setCurrentProjectId(projectId: string): void {
  try {
    localStorage.setItem(LOCAL_PROJECT_ID_KEY, projectId);
  } catch {}
}

export function getCurrentProjectId(): string | null {
  try {
    return localStorage.getItem(LOCAL_PROJECT_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * Save project to IndexedDB, LocalStorage, and Firestore (if authenticated)
 */
export async function saveProject(project: SubtitleProject): Promise<void> {
  const updatedProject: SubtitleProject = {
    ...project,
    updatedAt: new Date().toISOString(),
  };

  setCurrentProjectId(updatedProject.id);

  // 1. Persistent IndexedDB save (large quota, works for Admin session & all users)
  await saveProjectRecord(updatedProject);

  // 2. Keep offline local storage copy
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedProject));
    const localList = getLocalProjects();
    const existingIdx = localList.findIndex((p) => p.id === updatedProject.id);
    if (existingIdx >= 0) {
      localList[existingIdx] = updatedProject;
    } else {
      localList.unshift(updatedProject);
    }
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(localList.slice(0, 10)));
  } catch (err) {
    console.warn('LocalStorage error:', err);
  }

  // 3. Cloud sync if authenticated in Firebase
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return;
  }

  const projectDocRef = doc(db, 'projects', updatedProject.id);
  const pathForWrite = `projects/${updatedProject.id}`;

  try {
    const payload = stripUndefined({
      userId: currentUser.uid,
      title: (updatedProject.title || 'Mi Proyecto').slice(0, 150),
      videoFileName: updatedProject.videoFileName ? updatedProject.videoFileName.slice(0, 200) : '',
      videoDuration: Number(updatedProject.videoDuration) || 0,
      language: updatedProject.language ? updatedProject.language.slice(0, 50) : 'es',
      targetLanguage: updatedProject.targetLanguage ? updatedProject.targetLanguage.slice(0, 50) : 'es',
      subtitles: (updatedProject.subtitles || []).slice(0, 600),
      style: updatedProject.style,
      createdAt: updatedProject.createdAt || updatedProject.updatedAt,
      updatedAt: updatedProject.updatedAt,
    });

    await setDoc(projectDocRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pathForWrite);
  }
}

/**
 * Restore the most recent active project from IndexedDB first, then LocalStorage
 */
export async function restoreLastProject(): Promise<SubtitleProject | null> {
  const lastId = getCurrentProjectId();
  if (lastId) {
    const idbMatch = await getProjectRecord(lastId);
    if (idbMatch) return idbMatch;
  }

  const localProj = getLocalCurrentProject();
  if (localProj) {
    const idbMatch = await getProjectRecord(localProj.id);
    return idbMatch || localProj;
  }

  const allIdb = await getAllProjectRecords();
  if (allIdb.length > 0) {
    allIdb.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return allIdb[0];
  }

  return null;
}

/**
 * Fetch all projects belonging to the current user or admin session
 */
export async function fetchUserProjects(): Promise<SubtitleProject[]> {
  const idbProjects = await getAllProjectRecords();
  const localProjects = getLocalProjects();

  const projectMap = new Map<string, SubtitleProject>();
  localProjects.forEach((p) => projectMap.set(p.id, p));
  idbProjects.forEach((p) => {
    const existing = projectMap.get(p.id);
    if (!existing || new Date(p.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
      projectMap.set(p.id, p);
    }
  });

  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const q = query(collection(db, 'projects'), where('userId', '==', currentUser.uid));
      const snapshot = await getDocs(q);

      snapshot.forEach((d) => {
        const data = d.data() as any;
        const cloudProj: SubtitleProject = {
          id: d.id,
          userId: data.userId,
          title: data.title || 'Untitled Subtitle Project',
          videoFileName: data.videoFileName,
          videoDuration: data.videoDuration,
          language: data.language || 'es',
          targetLanguage: data.targetLanguage || 'es',
          subtitles: data.subtitles || [],
          style: data.style,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        };
        const existing = projectMap.get(d.id);
        if (!existing || new Date(cloudProj.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
          projectMap.set(d.id, cloudProj);
        }
      });
    } catch (error) {
      console.warn('Firestore fetch warning:', error);
    }
  }

  const projects = Array.from(projectMap.values());
  projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return projects;
}

/**
 * Delete project from IndexedDB, server media store, Firestore, and local storage
 */
export async function deleteProject(projectId: string): Promise<void> {
  try {
    await deleteMediaFile(projectId);
    await deleteProjectRecord(projectId);
    const localList = getLocalProjects().filter((p) => p.id !== projectId);
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(localList));
    if (getCurrentProjectId() === projectId) {
      localStorage.removeItem(LOCAL_PROJECT_ID_KEY);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  } catch (err) {
    console.warn(err);
  }

  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const pathForDelete = `projects/${projectId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, pathForDelete);
  }
}

/**
 * Get project saved locally in browser
 */
export function getLocalCurrentProject(): SubtitleProject | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getLocalProjects(): SubtitleProject[] {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save user profile to users collection on login
 */
export async function syncUserProfile(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const pathForUser = `users/${user.uid}`;
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const existing = await getDoc(userDocRef);
    const now = new Date().toISOString();

    if (!existing.exists()) {
      await setDoc(userDocRef, {
        email: user.email || 'user@example.com',
        displayName: user.displayName || 'SubCraft User',
        photoURL: user.photoURL || '',
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await setDoc(
        userDocRef,
        {
          displayName: user.displayName || 'SubCraft User',
          photoURL: user.photoURL || '',
          updatedAt: now,
        },
        { merge: true }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pathForUser);
  }
}
