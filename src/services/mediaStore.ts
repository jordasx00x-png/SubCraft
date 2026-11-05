/**
 * Persistent Media Storage Service using IndexedDB
 * Allows video and audio files to persist across browser reloads, session restarts, and project switches.
 */

const DB_NAME = 'SubCraftMediaStoreDB';
const STORE_NAME = 'mediaFiles';
const DB_VERSION = 1;

interface StoredMediaRecord {
  projectId: string;
  blob: Blob;
  fileName: string;
  fileType: string;
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
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save video or audio media Blob/File associated with a project ID in IndexedDB
 */
export async function saveMediaFile(
  projectId: string,
  file: Blob | File,
  fileName: string
): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const record: StoredMediaRecord = {
      projectId,
      blob: file,
      fileName: fileName || 'media_file',
      fileType: file.type || 'video/mp4',
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Error saving media file to IndexedDB:', err);
  }
}

/**
 * Retrieve video or audio media file for a project ID from IndexedDB
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
        if (record && record.blob) {
          resolve({
            blob: record.blob,
            fileName: record.fileName,
            fileType: record.fileType,
          });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('Error fetching media file from IndexedDB:', err);
    return null;
  }
}

/**
 * Delete media file for a project ID from IndexedDB
 */
export async function deleteMediaFile(projectId: string): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve) => {
      const request = store.delete(projectId);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('Error deleting media file from IndexedDB:', err);
  }
}
