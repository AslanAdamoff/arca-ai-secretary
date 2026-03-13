import type { AppSettings, ChatMessage, Task } from '../types';

const ENV_GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const ENV_OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;

const SYSTEM_PROMPT = (userName: string) => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
    const timeOfDay = hour < 12 ? 'утро' : hour < 18 ? 'день' : 'вечер';
    const isEvening = hour >= 18;

    return `Ты — деловой персональный ассистент ARCA (Adaptive Resource & Communication Assistant).
Обращайся к пользователю строго на "Вы" и используй обращение "сэр" или "${userName}".
Стиль: формальный, лаконичный, деловой. Ты — профессиональный секретарь, не друг.
Сейчас: ${timeOfDay} (${hour}:xx).

ПРАВИЛА:
1. Отвечай ТОЛЬКО на заданный вопрос или поручение — ничего лишнего.
2. Не упоминай время, погоду, дату — только если пользователь явно запросил.
3. Не предлагай дополнительные действия если не попросили.
4. При первом приветствии ответь ТОЛЬКО: "${greeting}, сэр. Какие у нас планы на сегодня?" — и больше ничего.
5. Держи ответы краткими и по существу.
6. ${isEvening ? 'Сейчас вечер — если пользователь просит обзор или планирование, фокусируйся на ЗАВТРАШНЕМ дне: что нужно сделать, какие задачи запланировать. Помогай формировать план на завтра.' : 'Фокусируйся на текущем дне и текущих задачах.'}
7. Говори на русском языке, если пользователь не переключился на другой.`;
};


export interface AIResponse {
    content: string;
    error?: string;
}

async function callOpenAI(messages: { role: string; content: string }[], apiKey: string): Promise<AIResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages,
            max_tokens: 600,
            temperature: 0.4,
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { content: '', error: err?.error?.message ?? `OpenAI error ${response.status}` };
    }
    const data = await response.json();
    return { content: data.choices?.[0]?.message?.content ?? '' };
}

async function callGemini(messages: { role: string; content: string }[], apiKey: string): Promise<AIResponse> {
    // Find system prompt (first message with role 'system') — Gemini doesn't support it natively
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const contents = chatMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
    }));

    // Prepend system prompt as the first user message if present
    if (systemMsg && contents.length > 0) {
        contents[0] = {
            role: 'user',
            parts: [{ text: `${systemMsg.content}\n\n${chatMessages[0].content}` }],
        };
    }

    const MODELS_TO_TRY = ['gemini-2.5-flash', 'gemini-2.0-flash-001', 'gemini-2.0-flash-lite-001', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
    let lastError = '';

    for (const model of MODELS_TO_TRY) {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents }),
            }
        );

        if (response.status === 404) {
            lastError = `model ${model} not found`;
            continue; // try next model
        }
        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            const errMsg = errBody?.error?.message ?? `Gemini error ${response.status}`;
            const hint = response.status === 429 ? ' (лимит запросов — подождите минуту)' : '';
            return { content: '', error: errMsg + hint };
        }
        const data = await response.json();
        return { content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '' };
    }
    return { content: '', error: `Gemini: ни одна из моделей не доступна (ключ: ${lastError})` };
}

function demoResponse(_userMessage: string, _context?: string): AIResponse {
    const responses = [
        'Отличная задача! Рекомендую разбить её на подзадачи и назначить чёткий дедлайн.',
        'Понял. Буду отслеживать этот пункт. Есть ли зависимости от других задач?',
        'Хорошо. Предлагаю поставить приоритет "Высокий" и поработать над этим в первой половине дня.',
        'Запомнил. Напомню об этом завтра утром во время обзора.',
        'Интересно. Могу помочь разбить это на конкретные шаги. Начнём?',
    ];
    const idx = Math.floor(Math.random() * responses.length);
    return { content: `[Demo Mode] ${responses[idx]}` };
}

export async function sendMessage(
    history: ChatMessage[],
    newMessage: string,
    settings: AppSettings,
    taskContext?: Task | null,
    extraContext?: string
): Promise<AIResponse> {
    const systemContent = SYSTEM_PROMPT(settings.userName) +
        (taskContext ? `\n\nТекущая задача в контексте:\nНазвание: ${taskContext.title}\nОписание: ${taskContext.description}\nСтатус: ${taskContext.status}\nПриоритет: ${taskContext.priority}` : '') +
        (extraContext ? `\n\n${extraContext}` : '');

    const messages = [
        { role: 'system', content: systemContent },
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: newMessage },
    ];

    const geminiKey = settings.geminiApiKey || ENV_GEMINI_KEY;
    const openaiKey = settings.openaiApiKey || ENV_OPENAI_KEY;

    // Explicit provider selection (from Settings)
    if (settings.aiProvider === 'gemini' && geminiKey) return callGemini(messages, geminiKey);
    if (settings.aiProvider === 'openai' && openaiKey) return callOpenAI(messages, openaiKey);

    // Auto-detect: env keys always win over demo mode
    if (geminiKey) return callGemini(messages, geminiKey);
    if (openaiKey) return callOpenAI(messages, openaiKey);

    return demoResponse(newMessage, taskContext?.title);
}

export async function generateSummary(
    context: string,
    settings: AppSettings
): Promise<string> {
    const result = await sendMessage([], context, settings);
    return result.content || 'Не удалось сгенерировать саммари.';
}

/**
 * Decompose a high-level goal into a list of concrete tasks.
 * Returns an array of task titles with optional due offsets.
 */
export interface DecomposedTask {
    title: string;
    daysFromNow: number;   // 0 = today, 1 = tomorrow, etc.
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: 'work' | 'personal' | 'health' | 'finance' | 'learning' | 'other';
    description?: string;
}

export async function decomposeGoal(
    goal: string,
    settings: AppSettings,
    context?: string
): Promise<DecomposedTask[]> {
    const prompt = `Ты — ARCA, личный секретарь ${settings.userName}.
Цель: "${goal}"
${context ? `Контекст: ${context}` : ''}

Разбей эту цель на 5-8 конкретных задач. Ответь ONLY valid JSON array, без текста до/после:
[
  {
    "title": "Название задачи",
    "daysFromNow": 0,
    "priority": "high",
    "category": "work",
    "description": "Краткое описание"
  }
]
priority: low|medium|high|urgent
category: work|personal|health|finance|learning|other
daysFromNow: 0-14`;

    const result = await sendMessage([], prompt, settings);
    try {
        const json = result.content.match(/\[.*\]/s)?.[0] ?? result.content;
        return JSON.parse(json) as DecomposedTask[];
    } catch {
        return [];
    }
}
