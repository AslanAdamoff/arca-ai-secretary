import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, ChevronRight, ChevronLeft, CheckCircle2, MessageCircle, LayoutGrid } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import { getTasksForToday, getOverdueTasks, applyTaskChanges, CATEGORY_LABELS, STATUS_LABELS } from '../services/taskService';
import type { Task, TaskStatus } from '../types';
import ChatPanel from '../components/ChatPanel';
import { generateSummary } from '../services/aiService';

export default function MorningReviewPage() {
    const navigate = useNavigate();
    const { settings, tasks, saveTask } = useApp();
    const [mode, setMode] = useState<'cards' | 'chat'>(settings.reviewMode);
    const [step, setStep] = useState(0);
    const [done, setDone] = useState(false);
    const [aiSummary, setAiSummary] = useState('');
    const [loadingSummary, setLoadingSummary] = useState(false);

    const todayTasks = getTasksForToday(tasks);
    const overdueTasks = getOverdueTasks(tasks);
    const allTasks = [...overdueTasks, ...todayTasks];

    const dateStr = format(new Date(), "EEEE, d MMMM", { locale: ru });

    const handleSetStatus = async (task: Task, status: TaskStatus) => {
        const updated = applyTaskChanges(task, { status });
        await saveTask(updated);
        if (step < allTasks.length - 1) setStep(s => s + 1);
        else finishReview();
    };

    const handlePostponeToTomorrow = async (task: Task) => {
        const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
        const updated = applyTaskChanges(task, { dueDate: tomorrow });
        await saveTask(updated);
        if (step < allTasks.length - 1) setStep(s => s + 1); else finishReview();
    };

    const finishReview = async () => {
        setDone(true);
        setLoadingSummary(true);
        const taskList = allTasks.map(t => `- ${t.title} (${STATUS_LABELS[t.status]}, ${CATEGORY_LABELS[t.category]})`).join('\n');
        const prompt = `Составь краткий утренний бриф (3-4 предложения, вдохновляющий) для пользователя ${settings.userName}. 
    Задачи на сегодня:\n${taskList}\nДата: ${dateStr}`;
        const summary = await generateSummary(prompt, settings);
        setAiSummary(summary);
        setLoadingSummary(false);
    };

    const chatContext = `Сейчас идёт утренний обзор. Задачи на сегодня:\n${allTasks.map(t => `- ${t.title} (${CATEGORY_LABELS[t.category]}, приоритет: ${t.priority})`).join('\n')}\nДата: ${dateStr}`;

    if (allTasks.length === 0) {
        return (
            <div>
                <div className="page-header">
                    <h1 className="page-title"><Sun size={22} style={{ display: 'inline', marginRight: 8, color: 'var(--accent-warning)' }} />Утренний обзор</h1>
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
                        <h1 className="page-title"><Sun size={22} style={{ display: 'inline', marginRight: 8, color: 'var(--accent-warning)' }} />Утренний обзор</h1>
                        <p className="page-subtitle">{dateStr}</p>
                    </div>
                    <div className="flex gap-xs">
                        <button className={`btn btn-sm ${mode === 'cards' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('cards')}>
                            <LayoutGrid size={14} />
                        </button>
                        <button className={`btn btn-sm ${mode === 'chat' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('chat')}>
                            <MessageCircle size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {mode === 'chat' ? (
                <div style={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
                    <ChatPanel placeholder="Обсудите задачи с ARCA..." extraContext={chatContext} />
                </div>
            ) : done ? (
                <div className="review-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🌅</div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Отличный старт!</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
                        Обзор завершён · {allTasks.length} задач{allTasks.length > 4 ? '' : allTasks.length > 1 ? 'и' : 'а'}
                    </p>
                    {loadingSummary ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>◈ ARCA готовит бриф...</div>
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
                    {/* Progress dots */}
                    <div className="review-step-indicator">
                        {allTasks.map((_, i) => (
                            <div key={i} className={`review-step-dot ${i === step ? 'active' : i < step ? '' : ''}`}
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
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
                                    Что делаем с этой задачей?
                                </div>
                                <div className="stack">
                                    <button className="btn btn-primary btn-full" onClick={() => handleSetStatus(task, 'in-progress')}>
                                        ▶ Взять в работу
                                    </button>
                                    <button className="btn btn-ghost btn-full" onClick={() => handleSetStatus(task, 'todo')}>
                                        ⏭ Пропустить — оставить на сегодня
                                    </button>
                                    <button className="btn btn-ghost btn-full" onClick={() => handlePostponeToTomorrow(task)}>
                                        📅 Перенести на завтра
                                    </button>
                                    <button className="btn btn-danger btn-full" onClick={() => handleSetStatus(task, 'cancelled')}>
                                        ✕ Отменить задачу
                                    </button>
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
