import type { AppSettings, ChatMessage, Task } from '../types';

const SYSTEM_PROMPT = (userName: string) => `Ты — персональный ИИ-ассистент и секретарь по имени ARCA (от Adaptive Resource & Communication Assistant). 
Ты общаешься на русском языке (если пользователь не переключится на другой).
Пользователя зовут ${userName}.
Твоя задача — помогать планировать день, обсуждать задачи, анализировать прогресс и давать конструктивные советы.
Будь краток, конкретен и дружелюбен. Не используй лишние формальности.
Текущая дата и время: ${new Date().toLocaleString('ru-RU')}.`;

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
            model: 'gpt-4o',
            messages,
            max_tokens: 800,
            temperature: 0.7,
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
    const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents }),
        }
    );

    if (!response.ok) {
        return { content: '', error: `Gemini error ${response.status}` };
    }
    const data = await response.json();
    return { content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '' };
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

    if (settings.aiProvider === 'openai' && settings.openaiApiKey) {
        return callOpenAI(messages, settings.openaiApiKey);
    }
    if (settings.aiProvider === 'gemini' && settings.geminiApiKey) {
        return callGemini(messages, settings.geminiApiKey);
    }
    return demoResponse(newMessage, taskContext?.title);
}

export async function generateSummary(
    context: string,
    settings: AppSettings
): Promise<string> {
    const result = await sendMessage([], context, settings);
    return result.content || 'Не удалось сгенерировать саммари.';
}
