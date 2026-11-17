import { SubtitleProject } from '../types/subtitle';

/**
 * Persistent Media & Projects Storage Service using IndexedDB + Server Media Backup.
 * Stores raw ArrayBuffer bytes in IndexedDB (waiting for transaction completion) so
 * imported videos and audio files never break when <input> elements unmount or across
 * browser reloads, and syncs a backup copy to /api/media/:projectId for cross-session recovery.
 */

const DB_NAME = 'SubCraftMediaStoreDB';
const STORE_NAME = 'mediaFiles';
const PROJECTS_STORE = 'projects';
const DB_VERSION = 3;

interface StoredMediaRecord {
  projectId: string;
  data?: ArrayBuffer;
  blob?: Blob;
  fileName: string;
  fileType: string;
  size?: number;
  updatedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'projectId' });
      }
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function inferMimeType(fileName: string, fallbackType?: string): string {
  if (fallbackType && fallbackType !== 'application/octet-stream') {
    return fallbackType;
  }
  const lower = (fileName || '').toLowerCase();
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.flac')) return 'audio/flac';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.mkv')) return 'video/x-matroska';
  return 'video/mp4';
}

/**
 * Upload media bytes to the backend server (/api/media/:projectId) as a persistent backup.
 */
export async function syncMediaToServer(
  projectId: string,
  file: Blob | File,
  fileName: string
): Promise<boolean> {
  try {
    const mimeType = inferMimeType(fileName, file.type);
    const res = await fetch(`/api/media/${encodeURIComponent(projectId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': mimeType,
        'X-File-Name': encodeURIComponent(fileName || 'media_file'),
      },
      body: file,
    });
    return res.ok;
  } catch (err) {
    console.warn('Background media server sync skipped/failed:', err);
    return false;
  }
}

/**
 * Fetch media file from backend server (/api/media/:projectId) if missing in IndexedDB.
 */
export async function fetchMediaFromServer(
  projectId: string
): Promise<{ blob: Blob; fileName: string; fileType: string } | null> {
  try {
    const res = await fetch(`/api/media/${encodeURIComponent(projectId)}`);
    if (!res.ok) return null;

    const blob = await res.blob();
    if (!blob || blob.size === 0) return null;

    const encodedName = res.headers.get('X-Media-File-Name');
    let fileName = 'media_file';
    if (encodedName) {
      try {
        fileName = decodeURIComponent(encodedName);
      } catch {
        fileName = encodedName;
      }
    }
    const headerType = res.headers.get('X-Media-File-Type') || blob.type;
    const fileType = inferMimeType(fileName, headerType);
    const typedBlob = blob.type === fileType ? blob : new Blob([blob], { type: fileType });

    // Cache back into IndexedDB for instant offline access next time
    await saveMediaFile(projectId, typedBlob, fileName);

    return {
      blob: typedBlob,
      fileName,
      fileType,
    };
  } catch (err) {
    console.warn('Error fetching media from server:', err);
    return null;
  }
}

/**
 * Save video or audio media bytes associated with a project ID in IndexedDB.
 * Reads ArrayBuffer BEFORE opening the IDB transaction so browser File handles cannot expire.
 */
export async function saveMediaFile(
  projectId: string,
  file: Blob | File,
  fileName: string
): Promise<void> {
  try {
    // Must read ArrayBuffer before starting IDB transaction
    const buffer = await file.arrayBuffer();
    const resolvedName = fileName || (file instanceof File ? file.name : 'media_file');
    const resolvedType = inferMimeType(resolvedName, file.type);

    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const record: StoredMediaRecord = {
      projectId,
      data: buffer,
      fileName: resolvedName,
      fileType: resolvedType,
      size: buffer.byteLength,
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
      store.put(record);
    });
  } catch (err) {
    console.warn('Error saving media file to IndexedDB:', err);
  }
}

/**
 * Save media locally in IndexedDB AND upload a persistent copy to the server.
 */
export async function saveAndSyncMediaFile(
  projectId: string,
  file: Blob | File,
  fileName: string
): Promise<void> {
  await saveMediaFile(projectId, file, fileName);
  // Fire server sync in background so UI never stalls on large uploads
  syncMediaToServer(projectId, file, fileName);
}

/**
 * Retrieve video or audio media file for a project ID from IndexedDB.
 */
export async function getMediaFile(
  projectId: string
): Promise<{ blob: Blob; fileName: string; fileType: string } | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve) => {
      const request = store.get(projectId);
      request.onsuccess = () => {
        const record = request.result as StoredMediaRecord | undefined;
        if (!record) {
          resolve(null);
          return;
        }

        const fileType = inferMimeType(record.fileName, record.fileType);

        if (record.data && record.data.byteLength > 0) {
          const blob = new Blob([record.data], { type: fileType });
          resolve({
            blob,
            fileName: record.fileName,
            fileType,
          });
          return;
        }

        if (record.blob && record.blob.size > 0) {
          const blob = record.blob.type ? record.blob : new Blob([record.blob], { type: fileType });
          resolve({
            blob,
            fileName: record.fileName,
            fileType,
          });
          return;
        }

        resolve(null);
      };
      request.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('Error fetching media file from IndexedDB:', err);
    return null;
  }
}

/**
 * Resolve media from IndexedDB first, falling back to the server backup (/api/media/:projectId).
 */
export async function resolveMediaFile(
  projectId: string
): Promise<{ blob: Blob; fileName: string; fileType: string } | null> {
  const localMedia = await getMediaFile(projectId);
  if (localMedia) return localMedia;

  return await fetchMediaFromServer(projectId);
}

/**
 * Delete media file for a project ID from IndexedDB and server.
 */
export async function deleteMediaFile(projectId: string): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      store.delete(projectId);
    });
  } catch (err) {
    console.warn('Error deleting media file from IndexedDB:', err);
  }

  try {
    await fetch(`/api/media/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
  } catch {}
}

/**
 * Save complete SubtitleProject to IndexedDB
 */
export async function saveProjectRecord(project: SubtitleProject): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(PROJECTS_STORE, 'readwrite');
    const store = transaction.objectStore(PROJECTS_STORE);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      store.put(project);
    });
  } catch (err) {
    console.warn('Error saving project to IndexedDB:', err);
  }
}

/**
 * Retrieve a single SubtitleProject by ID from IndexedDB
 */
export async function getProjectRecord(projectId: string): Promise<SubtitleProject | null> {
  if (!projectId) return null;
  try {
    const db = await openDB();
    const transaction = db.transaction(PROJECTS_STORE, 'readonly');
    const store = transaction.objectStore(PROJECTS_STORE);

    return new Promise((resolve) => {
      const request = store.get(projectId);
      request.onsuccess = () => resolve((request.result as SubtitleProject) || null);
      request.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('Error reading project from IndexedDB:', err);
    return null;
  }
}

/**
 * Retrieve all projects saved in IndexedDB
 */
export async function getAllProjectRecords(): Promise<SubtitleProject[]> {
  try {
    const db = await openDB();
    const transaction = db.transaction(PROJECTS_STORE, 'readonly');
    const store = transaction.objectStore(PROJECTS_STORE);

    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const list = (request.result || []) as SubtitleProject[];
        resolve(list);
      };
      request.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn('Error reading projects from IndexedDB:', err);
    return [];
  }
}

/**
 * Delete project from IndexedDB
 */
export async function deleteProjectRecord(projectId: string): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(PROJECTS_STORE, 'readwrite');
    const store = transaction.objectStore(PROJECTS_STORE);

    return new Promise((resolve) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      store.delete(projectId);
    });
  } catch (err) {
    console.warn('Error deleting project from IndexedDB:', err);
  }
}
