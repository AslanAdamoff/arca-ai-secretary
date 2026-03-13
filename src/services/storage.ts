import type { AppSettings, Task, ReviewSession } from '../types';

const KEYS = {
    TASKS: 'ai_secretary_tasks',
    SETTINGS: 'ai_secretary_settings',
    SESSIONS: 'ai_secretary_sessions',
    AUTH: 'ai_secretary_auth',
};

const defaultSettings: AppSettings = {
    reviewMode: 'cards',
    theme: 'dark',
    aiProvider: 'demo',
    voiceEnabled: false,
    voiceSpeed: 1.0,
    voicePitch: 1.0,
    voiceLanguage: 'ru-RU',
    userName: 'Пользователь',
};

function get<T>(key: string): T | null {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
}

// Tasks
export function getTasks(): Task[] {
    return get<Task[]>(KEYS.TASKS) ?? [];
}

export function saveTasks(tasks: Task[]): void {
    set(KEYS.TASKS, tasks);
}

// Settings
export function getSettings(): AppSettings {
    const saved = get<Partial<AppSettings>>(KEYS.SETTINGS);
    return { ...defaultSettings, ...saved };
}

export function saveSettings(settings: AppSettings): void {
    set(KEYS.SETTINGS, settings);
}

// Sessions
export function getSessions(): ReviewSession[] {
    return get<ReviewSession[]>(KEYS.SESSIONS) ?? [];
}

export function saveSessions(sessions: ReviewSession[]): void {
    set(KEYS.SESSIONS, sessions);
}

// Auth
export function getPin(): string | null {
    return get<string>(KEYS.AUTH);
}

export function savePin(pin: string): void {
    set(KEYS.AUTH, pin);
}

export function clearPin(): void {
    localStorage.removeItem(KEYS.AUTH);
}

// Export / Import
export function exportAllData(): string {
    return JSON.stringify({
        tasks: getTasks(),
        settings: getSettings(),
        sessions: getSessions(),
        exportedAt: new Date().toISOString(),
    }, null, 2);
}

export function importAllData(json: string): void {
    const data = JSON.parse(json);
    if (data.tasks) saveTasks(data.tasks);
    if (data.settings) saveSettings({ ...defaultSettings, ...data.settings });
    if (data.sessions) saveSessions(data.sessions);
}
