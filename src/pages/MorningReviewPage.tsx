import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, ChevronRight, ChevronLeft, CheckCircle2, MessageCircle, LayoutGrid, Volume2, VolumeX } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import { getTasksForToday, getOverdueTasks, applyTaskChanges, CATEGORY_LABELS, STATUS_LABELS } from '../services/taskService';
import type { Task, TaskStatus } from '../types';
import ChatPanel from '../components/ChatPanel';
import { generateSummary } from '../services/aiService';
import { getWeather, type WeatherData } from '../services/weatherService';
import { speakARCA, stopSpeaking, isSpeakingNow } from '../services/voiceService';

// ─── Smart Briefing Screen ─────────────────────────────────────────────────

function SmartBriefing({ onStart }: { onStart: () => void }) {
    const { settings, tasks } = useApp();
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [briefText, setBriefText] = useState('');
    const [loadingBrief, setLoadingBrief] = useState(true);
    const [speaking, setSpeaking] = useState(false);

    const todayTasks = getTasksForToday(tasks);
    const overdueTasks = getOverdueTasks(tasks);
    const dateStr = format(new Date(), "EEEE, d MMMM", { locale: ru });
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Доброе утро' : hour < 17 ? 'Добрый день' : 'Добрый вечер';

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            // Fetch weather in parallel with AI brief
            let w: WeatherData | null = null;
            try {
                w = await getWeather();
                if (!cancelled) setWeather(w);
            } catch { /* skip weather on error */ }

            // Build AI morning brief
            const taskList = [...overdueTasks, ...todayTasks]
                .map(t => `- ${t.title} (${CATEGORY_LABELS[t.category]}, ${t.priority === 'urgent' ? '🔴 срочно' : t.priority === 'high' ? '🟠 высокий' : '🟡 средний'})`)
                .join('\n') || '- Задач нет';

            const weatherStr = w
                ? `${w.icon} ${w.temperature}°C, ${w.description}, ощущается как ${w.feelsLike}°C`
                : 'погода недоступна';

            const prompt = `Ты — ARCA, персональный ИИ-секретарь. Составь краткий утренний брифинг (4-5 предложений, говори напрямую к пользователю без "бы") для ${settings.userName}.
Дата: ${dateStr}
Погода: ${weatherStr}
Задачи на сегодня:
${taskList}
${overdueTasks.length > 0 ? `⚠ Просроченных задач: ${overdueTasks.length}` : ''}

Стиль: уверенный, как умный личный секретарь. Начни с "${greeting}, ${settings.userName}!" Дай рекомендацию с чего начать день.`;

            setLoadingBrief(true);
            const brief = await generateSummary(prompt, settings);
            if (!cancelled) {
                setBriefText(brief);
                setLoadingBrief(false);

                // Auto-speak if voice enabled
                if (settings.voiceEnabled) {
                    setSpeaking(true);
                    speakARCA(brief, 0.92, settings.voiceLanguage, () => setSpeaking(false));
                }
            }
        };

        load();
        return () => { cancelled = true; stopSpeaking(); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleSpeak = () => {
        if (isSpeakingNow()) { stopSpeaking(); setSpeaking(false); }
        else if (briefText) { setSpeaking(true); speakARCA(briefText, 0.92, settings.voiceLanguage, () => setSpeaking(false)); }
    };

    return (
        <div style={{ animation: 'fadeIn 0.5s ease' }}>
            {/* Date + greeting */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{dateStr}</div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    {greeting}
                </h1>
                <div style={{ fontSize: 16, color: 'var(--accent-primary)', marginTop: 4 }}>{settings.userName}</div>
            </div>

            {/* Weather card */}
            {weather && (
                <div className="card mb-md" style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center' }}>
                    <span style={{ fontSize: 36 }}>{weather.icon}</span>
                    <div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{weather.temperature}°C</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{weather.description} · ощущается {weather.feelsLike}°C</div>
                    </div>
                </div>
            )}

            {/* Task summary pills */}
            <div className="flex gap-sm mb-md" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                {todayTasks.length > 0 && (
                    <span style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)', borderRadius: 999, padding: '4px 12px', fontSize: 13, fontWeight: 600 }}>
                        📋 {todayTasks.length} задач{todayTasks.length > 4 ? '' : todayTasks.length > 1 ? 'и' : 'а'} на сегодня
                    </span>
                )}
                {overdueTasks.length > 0 && (
                    <span style={{ background: 'rgba(244,114,182,0.15)', color: 'var(--prio-urgent)', borderRadius: 999, padding: '4px 12px', fontSize: 13, fontWeight: 600 }}>
                        ⚠ {overdueTasks.length} просрочено
                    </span>
                )}
                {todayTasks.length === 0 && overdueTasks.length === 0 && (
                    <span style={{ background: 'rgba(52,211,153,0.15)', color: 'var(--accent-success)', borderRadius: 999, padding: '4px 12px', fontSize: 13, fontWeight: 600 }}>
                        ✓ Задач на сегодня нет
                    </span>
                )}
            </div>

            {/* ARCA brief */}
            <div className="card mb-lg" style={{ position: 'relative' }}>
                <div className="flex items-center gap-sm mb-sm">
                    <div className="jarvis-name">◈ ARCA</div>
                    {briefText && (
                        <button
                            className={`btn btn-ghost btn-sm ${speaking ? 'btn-primary' : ''}`}
                            style={{ marginLeft: 'auto', padding: '4px 8px' }}
                            onClick={toggleSpeak}
                            title={speaking ? 'Стоп' : 'Озвучить'}
                        >
                            {speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                        </button>
                    )}
                </div>
                {loadingBrief ? (
                    <div style={{ display: 'flex', gap: 6, paddingBottom: 8 }}>
                        {[0, 0.2, 0.4].map(d => (
                            <span key={d} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-primary)', display: 'inline-block', animation: `bounce 1s ${d}s infinite` }} />
                        ))}
                    </div>
                ) : (
                    <p style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text-secondary)', margin: 0 }}>{briefText}</p>
                )}
                {speaking && (
                    <div style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 11, color: 'var(--accent-primary)' }}>
                        ◈ говорит...
                    </div>
                )}
            </div>

            <button className="btn btn-primary btn-full" onClick={onStart} disabled={loadingBrief} style={{ fontSize: 15 }}>
                Начать обзор задач <ChevronRight size={16} style={{ display: 'inline' }} />
            </button>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function MorningReviewPage() {
    const navigate = useNavigate();
    const { settings, tasks, saveTask } = useApp();
    const [mode, setMode] = useState<'brief' | 'cards' | 'chat'>('brief');
    const [step, setStep] = useState(0);
    const [done, setDone] = useState(false);
    const [aiSummary, setAiSummary] = useState('');
    const [loadingSummary, setLoadingSummary] = useState(false);

    const todayTasks = getTasksForToday(tasks);
    const overdueTasks = getOverdueTasks(tasks);
    const allTasks = [...overdueTasks, ...todayTasks];
    const dateStr = format(new Date(), "EEEE, d MMMM", { locale: ru });

    const handleSetStatus = async (task: Task, status: TaskStatus) => {
        await saveTask(applyTaskChanges(task, { status }));
        if (step < allTasks.length - 1) setStep(s => s + 1);
        else finishReview();
    };

    const handlePostpone = async (task: Task) => {
        const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
        await saveTask(applyTaskChanges(task, { dueDate: tomorrow }));
        if (step < allTasks.length - 1) setStep(s => s + 1); else finishReview();
    };

    const finishReview = async () => {
        setDone(true);
        setLoadingSummary(true);
        const taskList = allTasks.map(t => `- ${t.title} (${STATUS_LABELS[t.status]}, ${CATEGORY_LABELS[t.category]})`).join('\n');
        const prompt = `Составь краткий утренний итог (2-3 вдохновляющих предложения) для ${settings.userName}.\nЗадачи: ${taskList}\nДата: ${dateStr}`;
        const summary = await generateSummary(prompt, settings);
        setAiSummary(summary);
        setLoadingSummary(false);
        if (settings.voiceEnabled) speakARCA(summary, 0.92, settings.voiceLanguage);
    };

    const chatContext = `Утренний обзор. Задачи на сегодня:\n${allTasks.map(t => `- ${t.title} (${CATEGORY_LABELS[t.category]}, приоритет: ${t.priority})`).join('\n')}\nДата: ${dateStr}`;

    // Briefing screen
    if (mode === 'brief') {
        return (
            <div>
                <div className="page-header">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="page-title"><Sun size={20} style={{ display: 'inline', marginRight: 8, color: 'var(--accent-warning)' }} />Утренний брифинг</h1>
                        </div>
                        <div className="flex gap-xs">
                            <button className="btn btn-ghost btn-sm" onClick={() => { stopSpeaking(); setMode('cards'); }}>
                                <LayoutGrid size={14} /> Задачи
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => { stopSpeaking(); setMode('chat'); }}>
                                <MessageCircle size={14} /> Чат
                            </button>
                        </div>
                    </div>
                </div>
                <SmartBriefing onStart={() => { stopSpeaking(); setMode('cards'); }} />
            </div>
        );
    }

    if (mode === 'chat') {
        return (
            <div>
                <div className="page-header">
                    <div className="flex items-center justify-between">
                        <h1 className="page-title"><Sun size={20} style={{ display: 'inline', marginRight: 8, color: 'var(--accent-warning)' }} />Утром с ARCA</h1>
                        <div className="flex gap-xs">
                            <button className="btn btn-ghost btn-sm" onClick={() => setMode('brief')}><Sun size={14} /></button>
                            <button className={`btn btn-sm btn-primary`}><MessageCircle size={14} /></button>
                        </div>
                    </div>
                </div>
                <div style={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
                    <ChatPanel placeholder="Обсудите задачи с ARCA..." extraContext={chatContext} />
                </div>
            </div>
        );
    }

    // Cards mode
    if (allTasks.length === 0) {
        return (
            <div>
                <div className="page-header">
                    <h1 className="page-title"><Sun size={20} style={{ display: 'inline', marginRight: 8, color: 'var(--accent-warning)' }} />Утренний обзор</h1>
                    <p className="page-subtitle">{dateStr}</p>
                </div>
                <div className="empty-state">
                    <CheckCircle2 size={48} style={{ opacity: 0.3 }} />
                    <h3>Нет задач на сегодня</h3>
                    <p>Добавьте задачи для утреннего обзора</p>
                    <button className="btn btn-primary" onClick={() => navigate('/tasks/new')}>Добавить задачу</button>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="page-title"><Sun size={20} style={{ display: 'inline', marginRight: 8, color: 'var(--accent-warning)' }} />Обзор задач</h1>
                        <p className="page-subtitle">{dateStr}</p>
                    </div>
                    <div className="flex gap-xs">
                        <button className="btn btn-ghost btn-sm" onClick={() => setMode('brief')}><Sun size={14} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setMode('chat')}><MessageCircle size={14} /></button>
                    </div>
                </div>
            </div>

            {done ? (
                <div className="review-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🌅</div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Отличный старт!</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
                        Обзор завершён · {allTasks.length} задач
                    </p>
                    {loadingSummary ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>◈ ARCA готовит итог...</div>
                    ) : (
                        <div className="card" style={{ textAlign: 'left', marginBottom: 20 }}>
                            <div className="jarvis-name mb-sm">◈ ARCA</div>
                            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{aiSummary}</p>
                        </div>
                    )}
                    <button className="btn btn-primary btn-full" onClick={() => navigate('/')}>На главную</button>
                </div>
            ) : (
                <div>
                    <div className="review-step-indicator">
                        {allTasks.map((_, i) => (
                            <div key={i} className="review-step-dot"
                                style={{ background: i < step ? 'var(--accent-success)' : i === step ? 'var(--accent-primary)' : 'var(--border-medium)' }} />
                        ))}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                        {step + 1} из {allTasks.length}
                    </div>
                    {(() => {
                        const task = allTasks[step];
                        return (
                            <div className="review-card">
                                <div className={`badge badge-${task.category} mb-md`}>{CATEGORY_LABELS[task.category]}</div>
                                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                                    {task.title}
                                </h2>
                                {task.description && <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>{task.description}</p>}
                                {overdueTasks.includes(task) && (
                                    <div style={{ background: 'rgba(244,114,182,0.1)', border: '1px solid rgba(244,114,182,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--prio-urgent)', marginBottom: 16 }}>
                                        ⚠ Просрочена
                                    </div>
                                )}
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Что делаем с этой задачей?</div>
                                <div className="stack">
                                    <button className="btn btn-primary btn-full" onClick={() => handleSetStatus(task, 'in-progress')}>▶ Взять в работу</button>
                                    <button className="btn btn-ghost btn-full" onClick={() => handleSetStatus(task, 'todo')}>⏭ Оставить на сегодня</button>
                                    <button className="btn btn-ghost btn-full" onClick={() => handlePostpone(task)}>📅 Перенести на завтра</button>
                                    <button className="btn btn-danger btn-full" onClick={() => handleSetStatus(task, 'cancelled')}>✕ Отменить</button>
                                </div>
                            </div>
                        );
                    })()}
                    <div className="flex justify-between mt-md">
                        <button className="btn btn-ghost btn-sm" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>
                            <ChevronLeft size={16} /> Назад
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => {
                            if (step < allTasks.length - 1) setStep(s => s + 1); else finishReview();
                        }}>
                            {step === allTasks.length - 1 ? 'Завершить' : 'Далее'} <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
