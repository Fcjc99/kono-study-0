// Recorded lecture audio never joins the synced plan JSON (it would blow past the 750 KB cloud
// cap almost instantly) — it stays device-local in IndexedDB, keyed by the KQuizLecture's own id.
// Losing this store (a cleared browser, a different device) loses the audio but never the transcript
// or anything generated from it, since those live in the regular synced plan.
const DB_NAME = 'kono-kquiz-audio'
const STORE = 'recordings'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE) }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open local audio storage.'))
  })
}

export async function saveRecording(id: string, blob: Blob): Promise<void> {
  const db = await openDB()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(blob, id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Could not save this recording on your device.'))
    })
  } finally { db.close() }
}

export async function loadRecording(id: string): Promise<Blob | null> {
  const db = await openDB()
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).get(id)
      request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null)
      request.onerror = () => reject(request.error ?? new Error('Could not load this recording.'))
    })
  } finally { db.close() }
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await openDB()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Could not remove this recording.'))
    })
  } finally { db.close() }
}
