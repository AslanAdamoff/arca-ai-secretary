import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { AppSettings, Task, ReviewSession } from '../types';
import { getSettings, saveSettings, getTasks, saveTasks, getSessions, saveSessions, getPin } from '../services/storage';
import { isFirebaseConfigured } from '../services/firebase';
import {
    initFirebaseAuth,
    subscribeToTasks,
    subscribeToSettings,
    subscribeToSessions,
    saveTaskToFirestore,
    deleteTaskFromFirestore,
    saveSettingsToFirestore,
    saveSessionToFirestore,
    bulkSaveTasks,
} from '../services/firestoreStorage';
import type { User } from 'firebase/auth';

const AUTO_LOCK_MS = 5 * 60 * 1000;

export type SyncStatus = 'offline' | 'syncing' | 'synced' | 'error';

interface AppContextType {
    settings: AppSettings;
    updateSettings: (changes: Partial<AppSettings>) => void;
    tasks: Task[];
    refreshTasks: () => void;
    saveTask: (task: Task) => Promise<void>;
    deleteTask: (taskId: string) => Promise<void>;
    saveSession: (session: ReviewSession) => Promise<void>;
    toast: (msg: string) => void;
    isLocked: boolean;
    unlock: () => void;
    syncStatus: SyncStatus;
    firebaseUid: string | null;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<AppSettings>(getSettings);
    const [tasks, setTasks] = useState<Task[]>(getTasks);
    const [toastMsg, setToastMsg] = useState<string | null>(null);
    const [isLocked, setIsLocked] = useState<boolean>(() => !!getPin());
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');
    const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
    const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const syncedOnce = useRef(false);

    // ── Theme ──────────────────────────────────────────────────────────────
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', settings.theme);
    }, [settings.theme]);

    // ── Auto-lock ──────────────────────────────────────────────────────────
    const resetLockTimer = useCallback(() => {
        if (!getPin()) return;
        if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
        lockTimerRef.current = setTimeout(() => setIsLocked(true), AUTO_LOCK_MS);
    }, []);

    useEffect(() => {
        resetLockTimer();
        const events = ['pointerdown', 'keydown', 'touchstart'];
        events.forEach(e => window.addEventListener(e, resetLockTimer, { passive: true }));
        return () => {
            events.forEach(e => window.removeEventListener(e, resetLockTimer));
            if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
        };
    }, [resetLockTimer]);

    useEffect(() => {
        const handleVisibility = () => {
            if (document.hidden && getPin()) setIsLocked(true);
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, []);

    useEffect(() => {
        if (!settings.pin) setIsLocked(false);
    }, [settings.pin]);

    // ── Firebase sync ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!isFirebaseConfigured()) return;

        setSyncStatus('syncing');
        const authUnsub = initFirebaseAuth(async (user: User | null) => {
            if (!user) {
                setSyncStatus('error');
                return;
            }
            setFirebaseUid(user.uid);

            // First-time sync: push localStorage data to Firestore
            if (!syncedOnce.current) {
                syncedOnce.current = true;
                const localTasks = getTasks();
                const localSessions = getSessions();
                try {
                    if (localTasks.length > 0) await bulkSaveTasks(user.uid, localTasks);
                    for (const s of localSessions) await saveSessionToFirestore(user.uid, s);
                } catch (e) {
                    console.warn('[Firebase] Initial sync failed:', e);
                }
            }

            // Realtime listeners
            const taskUnsub = subscribeToTasks(user.uid, (remoteTasks) => {
                setTasks(remoteTasks);
                saveTasks(remoteTasks); // update localStorage cache
                setSyncStatus('synced');
            });

            const settingsUnsub = subscribeToSettings(user.uid, (remoteSettings) => {
                setSettings(prev => {
                    const merged = { ...remoteSettings, pin: prev.pin }; // preserve local PIN
                    saveSettings(merged);
                    return merged;
                });
            });

            const sessionsUnsub = subscribeToSessions(user.uid, (remoteSessions) => {
                saveSessions(remoteSessions);
            });

            return () => {
                taskUnsub();
                settingsUnsub();
                sessionsUnsub();
            };
        });

        return () => authUnsub();
    }, []);

    // ── Settings ────────────────────────────────────────────────────────────
    const updateSettings = useCallback((changes: Partial<AppSettings>) => {
        setSettings(prev => {
            const next = { ...prev, ...changes };
            saveSettings(next);
            if (firebaseUid) {
                saveSettingsToFirestore(firebaseUid, next).catch(console.warn);
            }
            return next;
        });
    }, [firebaseUid]);

    // ── Task CRUD ────────────────────────────────────────────────────────────
    const saveTask = useCallback(async (task: Task) => {
        setTasks(prev => {
            const exists = prev.find(t => t.id === task.id);
            const next = exists ? prev.map(t => t.id === task.id ? task : t) : [...prev, task];
            saveTasks(next);
            return next;
        });
        if (firebaseUid) {
            setSyncStatus('syncing');
            await saveTaskToFirestore(firebaseUid, task);
            setSyncStatus('synced');
        }
    }, [firebaseUid]);

    const deleteTask = useCallback(async (taskId: string) => {
        setTasks(prev => {
            const next = prev.filter(t => t.id !== taskId);
            saveTasks(next);
            return next;
        });
        if (firebaseUid) {
            setSyncStatus('syncing');
            await deleteTaskFromFirestore(firebaseUid, taskId);
            setSyncStatus('synced');
        }
    }, [firebaseUid]);

    const refreshTasks = useCallback(() => {
        setTasks(getTasks());
    }, []);

    // ── Session CRUD ──────────────────────────────────────────────────────
    const saveSession = useCallback(async (session: ReviewSession) => {
        const sessions = getSessions();
        const exists = sessions.find(s => s.id === session.id);
        const next = exists ? sessions.map(s => s.id === session.id ? session : s) : [...sessions, session];
        saveSessions(next);
        if (firebaseUid) {
            await saveSessionToFirestore(firebaseUid, session);
        }
    }, [firebaseUid]);

    // ── Toast ─────────────────────────────────────────────────────────────
    const toast = useCallback((msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(null), 2500);
    }, []);

    // ── Unlock ────────────────────────────────────────────────────────────
    const unlock = useCallback(() => {
        setIsLocked(false);
        resetLockTimer();
    }, [resetLockTimer]);

    return (
        <AppContext.Provider value={{
            settings, updateSettings,
            tasks, refreshTasks, saveTask, deleteTask,
            saveSession,
            toast,
            isLocked, unlock,
            syncStatus, firebaseUid,
        }}>
            {children}
            {toastMsg && <div className="toast">{toastMsg}</div>}
        </AppContext.Provider>
    );
}

export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used inside AppProvider');
    return ctx;
}
