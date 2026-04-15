import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update, remove } from 'firebase/database';
import {
  getAuth,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  type User as FirebaseUser,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDummyKeyForRTDB',
  databaseURL: 'https://file-locker-ec2c2-default-rtdb.firebaseio.com/',
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { auth, googleProvider, db, onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, firebaseSignOut };
export type { FirebaseUser };

// ---- User profile helpers ----

export async function upsertUserProfile(uid: string, data: {
  username?: string;
  email?: string;
  voice_hash?: string | null;
  password_hash?: string;
}) {
  const userRef = ref(db, `users/${uid}`);
  const snapshot = await get(userRef);
  if (snapshot.exists()) {
    await update(userRef, { ...data, updated_at: new Date().toISOString() });
  } else {
    await set(userRef, { ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  }
}

export async function getUserProfile(uid: string) {
  const snapshot = await get(ref(db, `users/${uid}`));
  return snapshot.exists() ? snapshot.val() : null;
}

// ---- File metadata helpers ----

export interface FirebaseFileEntry {
  file_name: string;
  file_url: string;
  decryption_count: number;
  expiry_time: string;
}

export async function writeFileMetadata(
  fileId: string,
  entry: FirebaseFileEntry
): Promise<void> {
  await set(ref(db, `files/${fileId}`), entry);
}

export async function incrementDecryptCount(fileId: string): Promise<number> {
  const fileRef = ref(db, `files/${fileId}`);
  const snapshot = await get(fileRef);
  if (!snapshot.exists()) return -1;

  const data = snapshot.val() as FirebaseFileEntry;
  const newCount = (data.decryption_count || 0) + 1;
  await update(fileRef, { decryption_count: newCount });
  return newCount;
}

export async function deleteFileFromFirebase(fileId: string): Promise<void> {
  await remove(ref(db, `files/${fileId}`));
}

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
