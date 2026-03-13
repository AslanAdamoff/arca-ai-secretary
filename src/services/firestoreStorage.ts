import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
    writeBatch,
    type Unsubscribe,
} from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
import { db, auth, isFirebaseConfigured } from './firebase';
import type { Task, AppSettings, ReviewSession } from '../types';

// ─── Auth ────────────────────────────────────────────────────────────────────

type AuthCallback = (user: User | null) => void;

export function initFirebaseAuth(cb: AuthCallback): Unsubscribe {
    if (!isFirebaseConfigured()) {
        cb(null);
        return () => {};
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
        if (user) {
            cb(user);
        } else {
            try {
                const cred = await signInAnonymously(auth);
                cb(cred.user);
            } catch (err) {
                console.warn('[Firebase] Anonymous sign-in failed:', err);
                cb(null);
            }
        }
    });
    return unsub;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

function tasksCol(uid: string) {
    return collection(db, 'users', uid, 'tasks');
}

export function subscribeToTasks(uid: string, cb: (tasks: Task[]) => void): Unsubscribe {
    return onSnapshot(tasksCol(uid), (snap) => {
        const tasks: Task[] = snap.docs.map((d) => d.data() as Task);
        cb(tasks);
    }, (err) => {
        console.warn('[Firebase] Tasks listener error:', err);
    });
}

export async function saveTaskToFirestore(uid: string, task: Task): Promise<void> {
    await setDoc(doc(tasksCol(uid), task.id), task);
}

export async function deleteTaskFromFirestore(uid: string, taskId: string): Promise<void> {
    await deleteDoc(doc(tasksCol(uid), taskId));
}

/** Bulk-write all tasks (used on first sync from localStorage) */
export async function bulkSaveTasks(uid: string, tasks: Task[]): Promise<void> {
    if (tasks.length === 0) return;
    const batch = writeBatch(db);
    for (const task of tasks) {
        batch.set(doc(tasksCol(uid), task.id), task);
    }
    await batch.commit();
}

// ─── Settings ────────────────────────────────────────────────────────────────

function settingsDoc(uid: string) {
    return doc(db, 'users', uid, 'meta', 'settings');
}

export function subscribeToSettings(uid: string, cb: (s: AppSettings) => void): Unsubscribe {
    return onSnapshot(settingsDoc(uid), (snap) => {
        if (snap.exists()) {
            cb(snap.data() as AppSettings);
        }
    }, (err) => {
        console.warn('[Firebase] Settings listener error:', err);
    });
}

export async function saveSettingsToFirestore(uid: string, settings: AppSettings): Promise<void> {
    // Never store sensitive PIN in Firestore — strip it
    const { pin: _pin, ...safe } = settings;
    await setDoc(settingsDoc(uid), safe);
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

function sessionsCol(uid: string) {
    return collection(db, 'users', uid, 'sessions');
}

export async function saveSessionToFirestore(uid: string, session: ReviewSession): Promise<void> {
    await setDoc(doc(sessionsCol(uid), session.id), session);
}

export function subscribeToSessions(uid: string, cb: (s: ReviewSession[]) => void): Unsubscribe {
    return onSnapshot(sessionsCol(uid), (snap) => {
        const sessions: ReviewSession[] = snap.docs.map((d) => d.data() as ReviewSession);
        cb(sessions);
    }, (err) => {
        console.warn('[Firebase] Sessions listener error:', err);
    });
}
