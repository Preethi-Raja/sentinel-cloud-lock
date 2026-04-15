import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update, remove, push } from 'firebase/database';

const firebaseConfig = {
  databaseURL: 'https://file-locker-ec2c2-default-rtdb.firebaseio.com/',
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export interface FirebaseFileEntry {
  file_name: string;
  file_url: string;
  decryption_count: number;
  expiry_time: string;
}

/** Write file metadata to Firebase under files/{fileId} */
export async function writeFileMetadata(
  fileId: string,
  entry: FirebaseFileEntry
): Promise<void> {
  await set(ref(db, `files/${fileId}`), entry);
}

/** Increment decryption_count in Firebase and return new count */
export async function incrementDecryptCount(fileId: string): Promise<number> {
  const fileRef = ref(db, `files/${fileId}`);
  const snapshot = await get(fileRef);
  if (!snapshot.exists()) return -1;

  const data = snapshot.val() as FirebaseFileEntry;
  const newCount = (data.decryption_count || 0) + 1;
  await update(fileRef, { decryption_count: newCount });
  return newCount;
}

/** Delete a file entry from Firebase */
export async function deleteFileFromFirebase(fileId: string): Promise<void> {
  await remove(ref(db, `files/${fileId}`));
}

/** Check if a file should be auto-deleted (expired or limit reached) */
export async function checkAndAutoDelete(
  fileId: string,
  maxLimit: number
): Promise<boolean> {
  const fileRef = ref(db, `files/${fileId}`);
  const snapshot = await get(fileRef);
  if (!snapshot.exists()) return true;

  const data = snapshot.val() as FirebaseFileEntry;
  const now = new Date();
  const expiry = new Date(data.expiry_time);

  if (now > expiry || data.decryption_count >= maxLimit) {
    await remove(fileRef);
    return true;
  }
  return false;
}
