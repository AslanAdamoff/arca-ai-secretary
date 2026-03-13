/**
 * ARCA Memory System
 * ——————————————————
 * Stores facts, preferences, and patterns the assistant learns about the user.
 * Data is persisted in localStorage. The AI injects the memory into every prompt.
 */

const MEMORY_KEY = 'arca_memory_v1';

export interface MemoryEntry {
    key: string;          // e.g. "prefers_morning_briefing", "work_start_time"
    value: string;        // e.g. "да", "09:00"
    source: string;       // snippet of what user said when this was learned
    learnedAt: string;    // ISO date
    confidence: number;   // 0–1
}

export interface ARCAMemory {
    facts: MemoryEntry[];
    lastUpdated: string;
}

function load(): ARCAMemory {
    try {
        const raw = localStorage.getItem(MEMORY_KEY);
        if (raw) return JSON.parse(raw) as ARCAMemory;
    } catch { /* ignore */ }
    return { facts: [], lastUpdated: new Date().toISOString() };
}

function save(memory: ARCAMemory): void {
    try {
        memory.lastUpdated = new Date().toISOString();
        localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
    } catch { /* ignore */ }
}

/** Returns all stored memory entries */
export function getMemory(): ARCAMemory {
    return load();
}

/** Add or update a fact in memory */
export function storeFact(key: string, value: string, source: string, confidence = 0.8): void {
    const memory = load();
    const existing = memory.facts.findIndex(f => f.key === key);
    const entry: MemoryEntry = {
        key,
        value,
        source: source.slice(0, 120),
        learnedAt: new Date().toISOString(),
        confidence,
    };
    if (existing >= 0) {
        memory.facts[existing] = entry;
    } else {
        memory.facts.push(entry);
    }
    // Keep max 50 facts
    if (memory.facts.length > 50) {
        memory.facts = memory.facts
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 50);
    }
    save(memory);
}

/** Remove a fact by key */
export function forgetFact(key: string): void {
    const memory = load();
    memory.facts = memory.facts.filter(f => f.key !== key);
    save(memory);
}

/** Clear all memory */
export function clearMemory(): void {
    localStorage.removeItem(MEMORY_KEY);
}

/**
 * Render memory as a compact system-prompt block.
 * Returns empty string if no facts are stored.
 */
export function buildMemoryPrompt(): string {
    const memory = load();
    const highConf = memory.facts.filter(f => f.confidence >= 0.6);
    if (highConf.length === 0) return '';

    const lines = highConf.map(f => `- ${f.key}: ${f.value}`).join('\n');
    return `\nЧТО ТЫ ЗНАЕШЬ О ПОЛЬЗОВАТЕЛЕ (из прошлых разговоров):\n${lines}\nИспользуй эти данные чтобы давать более точные и персонализированные ответы.\n`;
}

/**
 * Parse an AI response or user message for learnable facts.
 * Called after each exchange to extract and store preferences.
 */
export function learnFromExchange(userMessage: string, _aiResponse: string): void {
    const msg = userMessage.toLowerCase();

    // Work schedule patterns
    const workStartMatch = msg.match(/работ[ауею]\s+(?:с|начинаю с|начало в)\s+(\d{1,2}[:.]\d{2}|\d{1,2}\s*час)/);
    if (workStartMatch) {
        storeFact('work_start_time', workStartMatch[1], userMessage, 0.9);
    }

    const workEndMatch = msg.match(/(?:заканчиваю|конец\s+работы|до)\s+(\d{1,2}[:.]\d{2}|\d{1,2}\s*час)/);
    if (workEndMatch) {
        storeFact('work_end_time', workEndMatch[1], userMessage, 0.9);
    }

    // Meeting/location preferences
    if (/предпочитаю\s+(?:утренн|ранн)/.test(msg)) {
        storeFact('prefers_morning_meetings', 'да', userMessage, 0.8);
    }

    // Task preferences
    if (/не\s+люблю\s+перебивать|фокусиру|глубокая\s+работа/.test(msg)) {
        storeFact('deep_work_preferred', 'да', userMessage, 0.8);
    }

    // Language preference
    if (/говори\s+(?:на|по)-?\s*(английск|русск|казахск)/.test(msg)) {
        const langMatch = msg.match(/говори\s+(?:на|по)-?\s*(английск|русск|казахск)/);
        if (langMatch) storeFact('preferred_language', langMatch[1], userMessage, 1.0);
    }

    // Name/role references
    const roleMatch = msg.match(/я\s+(?:работаю|являюсь|директор|менеджер|специалист|инженер)\s+(.{3,40})/);
    if (roleMatch) {
        storeFact('user_role', roleMatch[1].trim(), userMessage, 0.85);
    }

    // Briefing preference
    if (/(?:утренн|вечерн)\s+брифинг|ежедневн\s+сводк/.test(msg)) {
        const isMorning = /утренн/.test(msg);
        storeFact('briefing_preference', isMorning ? 'утренний' : 'вечерний', userMessage, 0.8);
    }
}
