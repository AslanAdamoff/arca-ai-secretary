import type { Task, TaskCategory, TaskPriority, TaskStatus, RecurrenceType } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { format, addDays, addWeeks, addMonths, parseISO } from 'date-fns';

// ─── Factories (pure – no storage side-effects) ───────────────────────────────

export function buildTask(partial: Partial<Task>): Task {
    const now = new Date().toISOString();
    return {
        id: uuidv4(),
        title: partial.title ?? 'Новая задача',
        description: partial.description ?? '',
        category: partial.category ?? 'other',
        priority: partial.priority ?? 'medium',
        status: partial.status ?? 'todo',
        dueDate: partial.dueDate,
        createdAt: now,
        updatedAt: now,
        recurrence: partial.recurrence ?? 'none',
        recurrenceParentId: partial.recurrenceParentId,
        tags: partial.tags ?? [],
        subtasks: partial.subtasks ?? [],
        notes: partial.notes ?? '',
        chatHistory: [],
        timeSpentMinutes: 0,
    };
}

export function applyTaskChanges(task: Task, changes: Partial<Task>): Task {
    const updated = { ...task, ...changes, updatedAt: new Date().toISOString() };
    if (changes.status === 'done' && !updated.completedAt) {
        updated.completedAt = new Date().toISOString();
    }
    return updated;
}

export function buildRecurringTask(completed: Task): Task | null {
    if (completed.recurrence === 'none' || completed.status !== 'done') return null;
    if (!completed.dueDate) return null;
    const base = parseISO(completed.dueDate);
    let nextDate: Date;
    if (completed.recurrence === 'daily') nextDate = addDays(base, 1);
    else if (completed.recurrence === 'weekly') nextDate = addWeeks(base, 1);
    else nextDate = addMonths(base, 1);

    return buildTask({
        ...completed,
        id: undefined as any,
        status: 'todo',
        completedAt: undefined,
        chatHistory: [],
        dueDate: format(nextDate, 'yyyy-MM-dd'),
        recurrenceParentId: completed.id,
        createdAt: undefined as any,
        updatedAt: undefined as any,
    });
}

// ─── Query Helpers (reads from provided tasks array, no storage) ──────────────

export function getTasksForToday(tasks: Task[]): Task[] {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return tasks.filter(t => {
        if (t.status === 'done' || t.status === 'cancelled') return false;
        if (!t.dueDate) return false;
        return t.dueDate.startsWith(todayStr);
    });
}

export function getTasksForTomorrow(tasks: Task[]): Task[] {
    const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    return tasks.filter(t => {
        if (t.status === 'done' || t.status === 'cancelled') return false;
        if (!t.dueDate) return false;
        return t.dueDate.startsWith(tomorrowStr);
    });
}

export function getOverdueTasks(tasks: Task[]): Task[] {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return tasks.filter(t => {
        if (t.status === 'done' || t.status === 'cancelled') return false;
        if (!t.dueDate) return false;
        return t.dueDate < todayStr;
    });
}

// ─── Label Maps ───────────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
    work: 'Работа',
    personal: 'Личное',
    health: 'Здоровье',
    finance: 'Финансы',
    learning: 'Обучение',
    other: 'Прочее',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
    urgent: 'Срочный',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
    todo: 'К выполнению',
    'in-progress': 'В процессе',
    done: 'Выполнено',
    cancelled: 'Отменено',
};

export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
    none: 'Не повторяется',
    daily: 'Ежедневно',
    weekly: 'Еженедельно',
    monthly: 'Ежемесячно',
};
