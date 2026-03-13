export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskCategory = 'work' | 'personal' | 'health' | 'finance' | 'learning' | 'other';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';
export type ReviewMode = 'cards' | 'chat';
export type ThemeMode = 'dark' | 'light';
export type AIProvider = 'openai' | 'gemini' | 'demo';

export interface Task {
    id: string;
    title: string;
    description?: string;
    category: TaskCategory;
    priority: TaskPriority;
    status: TaskStatus;
    dueDate?: string; // ISO date string
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
    recurrence: RecurrenceType;
    recurrenceParentId?: string;
    tags: string[];
    subtasks: Subtask[];
    notes: string;
    chatHistory: ChatMessage[];
    timeSpentMinutes: number;
}

export interface Subtask {
    id: string;
    title: string;
    done: boolean;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

export interface ReviewSession {
    id: string;
    type: 'morning' | 'evening';
    date: string;
    completedAt?: string;
    taskSummaries: TaskReviewSummary[];
    aiSummary?: string;
    chatHistory: ChatMessage[];
}

export interface TaskReviewSummary {
    taskId: string;
    taskTitle: string;
    status: TaskStatus;
    notes?: string;
    aiInsight?: string;
}

export interface AppSettings {
    reviewMode: ReviewMode;
    theme: ThemeMode;
    aiProvider: AIProvider;
    openaiApiKey?: string;
    geminiApiKey?: string;
    voiceEnabled: boolean;
    voiceSpeed: number;
    voicePitch: number;
    voiceLanguage: string;
    morningReminderTime?: string;
    eveningReminderTime?: string;
    userName: string;
    pin?: string;
    notificationsEnabled: boolean;
    briefingTime: string;          // "HH:MM" for daily morning notification
    taskReminderMinutes: number;   // minutes before due date to fire reminder
    preferredVoiceName?: string;   // user-picked TTS voice name
}

export interface AnalyticsSummary {
    period: 'day' | 'week' | 'month' | '6months' | 'year';
    startDate: string;
    endDate: string;
    totalTasks: number;
    completedTasks: number;
    cancelledTasks: number;
    inProgressTasks: number;
    todoTasks: number;
    completionRate: number;
    byCategory: Record<TaskCategory, { total: number; completed: number }>;
    byPriority: Record<TaskPriority, { total: number; completed: number }>;
    aiNarrative?: string;
}
