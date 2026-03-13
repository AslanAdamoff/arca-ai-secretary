import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, ChevronRight, ChevronLeft, MessageCircle, LayoutGrid, Check } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import { getTasksForToday, getTasksForTomorrow, applyTaskChanges, CATEGORY_LABELS, STATUS_LABELS } from '../services/taskService';
import type { Task, TaskStatus } from '../types';
import ChatPanel from '../components/ChatPanel';
import { generateSummary } from '../services/aiService';

export default function EveningReviewPage() {
    const navigate = useNavigate();
    const { settings, tasks, saveTask } = useApp();
    const [mode, setMode] = useState<'cards' | 'chat'>(settings.reviewMode);
    const [phase, setPhase] = useState<'today' | 'tomorrow' | 'complete'>('today');
    const [step, setStep] = useState(0);
    const [aiSummary, setAiSummary] = useState('');
    const [loadingSummary, setLoadingSummary] = useState(false);

    const todayTasks = getTasksForToday(tasks);
    const tomorrowTasks = getTasksForTomorrow(tasks);
    const dateStr = format(new Date(), "EEEE, d MMMM", { locale: ru });
    const tomorrowStr = format(addDays(new Date(), 1), "EEEE, d MMMM", { locale: ru });

    const handleStatusToday = async (task: Task, status: TaskStatus) => {
        const updated = applyTaskChanges(task, { status });
        await saveTask(updated);
        if (step < todayTasks.length - 1) setStep(s => s + 1);
        else { setPhase('tomorrow'); setStep(0); }
    };

    const handlePostponeToTomorrow = async (task: Task) => {
        const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
        const updated = applyTaskChanges(task, { dueDate: tomorrow });
        await saveTask(updated);
        handleStatusToday(task, 'todo');
    };

    const handleCancelTomorrow = async (task: Task) => {
        const updated = applyTaskChanges(task, { status: 'cancelled' });
        await saveTask(updated);
        if (step < tomorrowTasks.length - 1) setStep(s => s + 1); else finishTomorrow();
    };

    const finishTomorrow = async () => {
        setPhase('complete');
        setLoadingSummary(true);
        const completedToday = todayTasks.filter(t => t.status === 'done').length;
        const planned = tomorrowTasks.length;
        const prompt = `Составь вечерний итог (3-4 предложения, спокойный/поддерживающий тон) для ${settings.userName}.
    Итоги дня: ${completedToday} из ${todayTasks.length} задач выполнено.
    Планы на завтра: ${planned} задач${planned > 1 ? 'и' : 'а'}.
    Дата сегодня: ${dateStr}.`;
        const summary = await generateSummary(prompt, settings);
        setAiSummary(summary);
        setLoadingSummary(false);
    };

    const chatContext = `Вечерний обзор.\nЗадачи сегодня:\n${todayTasks.map(t => `- ${t.title} (${STATUS_LABELS[t.status]})`).join('\n')}\nЗадачи на завтра:\n${tomorrowTasks.map(t => `- ${t.title}`).join('\n')}`;

    const activeTasks = phase === 'today' ? todayTasks : tomorrowTasks;

    return (
        <div>
            <div className="page-header">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="page-title"><Moon size={22} style={{ display: 'inline', marginRight: 8, color: 'var(--accent-secondary)' }} />Вечерний обзор</h1>
                        <p className="page-subtitle">{phase === 'today' ? `Итоги: ${dateStr}` : `План: ${tomorrowStr}`}</p>
                    </div>
                    <div className="flex gap-xs">
                        <button className={`btn btn-sm ${mode === 'cards' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('cards')}><LayoutGrid size={14} /></button>
                        <button className={`btn btn-sm ${mode === 'chat' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('chat')}><MessageCircle size={14} /></button>
                    </div>
                </div>
            </div>

            {mode === 'chat' ? (
                <div style={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
                    <ChatPanel placeholder="Обсудите итоги дня с ARCA..." extraContext={chatContext} />
                </div>
            ) : phase === 'complete' ? (
                <div className="review-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🌙</div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Хорошей ночи!</h2>
                    {loadingSummary ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>◈ ARCA подводит итоги...</div>
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
                    <div className="flex gap-sm mb-lg">
                        <button className={`btn btn-sm ${phase === 'today' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setPhase('today'); setStep(0); }}>Итоги дня</button>
                        <button className={`btn btn-sm ${phase === 'tomorrow' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setPhase('tomorrow'); setStep(0); }}>Планы на завтра</button>
                    </div>

                    {activeTasks.length === 0 ? (
                        <div className="empty-state">
                            <Check size={42} style={{ opacity: 0.3 }} />
                            <h3>{phase === 'today' ? 'Нет активных задач сегодня' : 'Нет задач на завтра'}</h3>
                            {phase === 'today' ? (
                                <button className="btn btn-ghost btn-sm" onClick={() => { setPhase('tomorrow'); setStep(0); }}>Перейти к завтрашним задачам</button>
                            ) : (
                                <button className="btn btn-primary btn-sm" onClick={finishTomorrow}>Завершить обзор</button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="review-step-indicator">
                                {activeTasks.map((_, i) => (
                                    <div key={i} className="review-step-dot"
                                        style={{ background: i < step ? 'var(--accent-success)' : i === step ? 'var(--accent-primary)' : 'var(--border-medium)', width: i === step ? 20 : 6 }} />
                                ))}
                            </div>
                            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                                {step + 1} из {activeTasks.length}
                            </div>

                            {(() => {
                                const task = activeTasks[step];
                                return (
                                    <div className="review-card">
                                        <div className={`badge badge-${task.category} mb-md`}>{CATEGORY_LABELS[task.category]}</div>
                                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{task.title}</h2>
                                        {task.description && <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>{task.description}</p>}

                                        {phase === 'today' ? (
                                            <>
                                                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Получилось выполнить?</div>
                                                <div className="stack">
                                                    <button className="btn btn-primary btn-full" onClick={() => handleStatusToday(task, 'done')}>✅ Выполнено</button>
                                                    <button className="btn btn-ghost btn-full" onClick={() => handlePostponeToTomorrow(task)}>📅 Перенести на завтра</button>
                                                    <button className="btn btn-ghost btn-full" onClick={() => handleStatusToday(task, 'in-progress')}>🔄 В процессе</button>
                                                    <button className="btn btn-danger btn-full" onClick={() => handleStatusToday(task, 'cancelled')}>✕ Отменить</button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Подтвердите задачу на завтра</div>
                                                <div className="stack">
                                                    <button className="btn btn-primary btn-full" onClick={() => { if (step < activeTasks.length - 1) setStep(s => s + 1); else finishTomorrow(); }}>✓ Подтвердить</button>
                                                    <button className="btn btn-danger btn-full" onClick={() => handleCancelTomorrow(task)}>✕ Убрать</button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })()}

                            <div className="flex justify-between mt-md">
                                <button className="btn btn-ghost btn-sm" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>
                                    <ChevronLeft size={16} /> Назад
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => {
                                    if (step < activeTasks.length - 1) setStep(s => s + 1);
                                    else if (phase === 'today') { setPhase('tomorrow'); setStep(0); }
                                    else finishTomorrow();
                                }}>
                                    {step === activeTasks.length - 1 ? (phase === 'today' ? 'К завтрашним' : 'Завершить') : 'Далее'} <ChevronRight size={16} />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
