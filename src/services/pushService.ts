/**
 * Push Notification Service
 * Uses Web Push / Service Worker Notifications API.
 * Falls back gracefully if not supported.
 */

export function isPushSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator;
}

export async function requestPermission(): Promise<boolean> {
    if (!isPushSupported()) return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
}

export function hasPermission(): boolean {
    return isPushSupported() && Notification.permission === 'granted';
}

// Show an immediate notification (for testing or urgent alerts)
export function showNotification(title: string, body: string, options?: { tag?: string; url?: string }) {
    if (!hasPermission()) return;
    const n = new Notification(title, {
        body,
        icon: '/vite.svg',
        badge: '/vite.svg',
        tag: options?.tag ?? 'arca',
        silent: false,
    });
    n.onclick = () => {
        window.focus();
        if (options?.url) window.location.href = options.url;
        n.close();
    };
}

// IDs for scheduled timeouts so we can cancel them
const scheduledIds: Map<string, ReturnType<typeof setTimeout>> = new Map();

function cancelScheduled(key: string) {
    const id = scheduledIds.get(key);
    if (id !== undefined) { clearTimeout(id); scheduledIds.delete(key); }
}

/**
 * Schedule a daily notification at HH:MM.
 * Reschedules itself after firing.
 */
export function scheduleDailyNotification(
    key: string,
    time: string, // "HH:MM"
    title: string,
    body: string,
    url?: string
) {
    cancelScheduled(key);
    if (!hasPermission()) return;

    const [h, m] = time.split(':').map(Number);
    const now = new Date();
    const next = new Date(now);
    next.setHours(h, m, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1); // tomorrow if already past

    const delay = next.getTime() - now.getTime();
    const id = setTimeout(() => {
        showNotification(title, body, { tag: key, url });
        // reschedule for next day
        scheduleDailyNotification(key, time, title, body, url);
    }, delay);
    scheduledIds.set(key, id);
}

export function cancelDailyNotification(key: string) {
    cancelScheduled(key);
}

/**
 * Schedule a one-time reminder N minutes before a date-time string.
 */
export function scheduleTaskReminder(
    taskId: string,
    taskTitle: string,
    dueDateTime: string, // ISO string or "yyyy-MM-dd"
    minutesBefore = 30
) {
    cancelScheduled(`task-${taskId}`);
    if (!hasPermission()) return;

    const due = new Date(dueDateTime);
    const fireAt = new Date(due.getTime() - minutesBefore * 60 * 1000);
    const delay = fireAt.getTime() - Date.now();
    if (delay <= 0) return; // already past

    const id = setTimeout(() => {
        showNotification(
            `⏰ Напоминание — через ${minutesBefore} мин`,
            taskTitle,
            { tag: `task-${taskId}`, url: '/' }
        );
        scheduledIds.delete(`task-${taskId}`);
    }, delay);
    scheduledIds.set(`task-${taskId}`, id);
}

export function cancelTaskReminder(taskId: string) {
    cancelScheduled(`task-${taskId}`);
}
