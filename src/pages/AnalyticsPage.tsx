import { useState, useEffect } from 'react';
import { TrendingUp, Loader2 } from 'lucide-react';
import { subDays, subMonths, parseISO, isWithinInterval } from 'date-fns';
import { useApp } from '../context/AppContext';
import { CATEGORY_LABELS, PRIORITY_LABELS } from '../services/taskService';
import type { TaskCategory, TaskPriority } from '../types';
import { generateSummary } from '../services/aiService';

type Period = 'week' | 'month' | '6months' | 'year';
const PERIOD_LABELS: Record<Period, string> = { week: 'Неделя', month: 'Месяц', '6months': '6 месяцев', year: 'Год' };

export default function AnalyticsPage() {
    const { tasks, settings } = useApp();
    const [period, setPeriod] = useState<Period>('week');
    const [aiNarrative, setAiNarrative] = useState('');
    const [loadingAI, setLoadingAI] = useState(false);

    const getPeriodStart = (p: Period): Date => {
        const now = new Date();
        if (p === 'week') return subDays(now, 7);
        if (p === 'month') return subMonths(now, 1);
        if (p === '6months') return subMonths(now, 6);
        return subMonths(now, 12);
    };

    const periodStart = getPeriodStart(period);
    const periodEnd = new Date();

    const periodTasks = tasks.filter(t => {
        const created = parseISO(t.createdAt);
        return isWithinInterval(created, { start: periodStart, end: periodEnd });
    });

    const total = periodTasks.length;
    const completed = periodTasks.filter(t => t.status === 'done').length;
    const cancelled = periodTasks.filter(t => t.status === 'cancelled').length;
    const inProgress = periodTasks.filter(t => t.status === 'in-progress').length;

    const completionRate = total ? Math.round((completed / total) * 100) : 0;

    const byCategory = (['work', 'personal', 'health', 'finance', 'learning', 'other'] as TaskCategory[]).map(cat => ({
        cat,
        label: CATEGORY_LABELS[cat],
        total: periodTasks.filter(t => t.category === cat).length,
        done: periodTasks.filter(t => t.category === cat && t.status === 'done').length,
    })).filter(x => x.total > 0);

    const byPriority = (['urgent', 'high', 'medium', 'low'] as TaskPriority[]).map(p => ({
        p, label: PRIORITY_LABELS[p],
        total: periodTasks.filter(t => t.priority === p).length,
        done: periodTasks.filter(t => t.priority === p && t.status === 'done').length,
    })).filter(x => x.total > 0);

    const generateAI = async () => {
        setLoadingAI(true);
        const prompt = `Составь краткую аналитическую сводку (4-5 предложений) за ${PERIOD_LABELS[period].toLowerCase()}:
    Всего задач: ${total}. Выполнено: ${completed} (${completionRate}%). В процессе: ${inProgress}. Отменено: ${cancelled}.
    По категориям: ${byCategory.map(c => `${c.label}: ${c.done}/${c.total}`).join(', ')}.
    Пользователь: ${settings.userName}. Дай конкретные инсайты и совет.`;
        const narrative = await generateSummary(prompt, settings);
        setAiNarrative(narrative);
        setLoadingAI(false);
    };

    useEffect(() => { setAiNarrative(''); }, [period]);

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Аналитика</h1>
                <p className="page-subtitle">Ваш прогресс и итоги</p>
            </div>

            {/* Period tabs */}
            <div className="flex gap-xs mb-lg" style={{ flexWrap: 'wrap' }}>
                {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                    <button key={p} className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPeriod(p)}>
                        {PERIOD_LABELS[p]}
                    </button>
                ))}
            </div>

            {/* Stat cards */}
            <div className="stat-grid mb-lg">
                <div className="stat-card">
                    <div className="stat-value">{total}</div>
                    <div className="stat-label">Всего задач</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: 'var(--accent-success)' }}>{completed}</div>
                    <div className="stat-label">Выполнено</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: 'var(--accent-primary)' }}>{completionRate}%</div>
                    <div className="stat-label">Эффективность</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: 'var(--accent-warning)' }}>{inProgress}</div>
                    <div className="stat-label">В процессе</div>
                </div>
            </div>

            {/* Completion bar */}
            {total > 0 && (
                <div className="card mb-lg">
                    <div className="flex items-center justify-between mb-sm">
                        <span style={{ fontSize: 14, fontWeight: 600 }}>Выполнение задач</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-primary)' }}>{completionRate}%</span>
                    </div>
                    <div className="progress-bar" style={{ height: 8 }}>
                        <div className="progress-fill" style={{ width: `${completionRate}%` }} />
                    </div>
                </div>
            )}

            {/* By category */}
            {byCategory.length > 0 && (
                <div className="card mb-lg">
                    <div className="section-title mb-md" style={{ fontSize: 15 }}>По категориям</div>
                    {byCategory.map(({ cat, label, total: t, done: d }) => (
                        <div key={cat} className="chart-bar-row">
                            <span className="chart-bar-label" style={{ color: `var(--cat-${cat})` }}>{label}</span>
                            <div className="chart-bar-track">
                                <div className="chart-bar-fill" style={{ width: `${t ? (d / t) * 100 : 0}%`, background: `linear-gradient(90deg, var(--cat-${cat}), color-mix(in srgb, var(--cat-${cat}) 70%, white))` }} />
                            </div>
                            <span className="chart-bar-value">{d}/{t}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* By priority */}
            {byPriority.length > 0 && (
                <div className="card mb-lg">
                    <div className="section-title mb-md" style={{ fontSize: 15 }}>По приоритетам</div>
                    {byPriority.map(({ p, label, total: t, done: d }) => (
                        <div key={p} className="chart-bar-row">
                            <span className="chart-bar-label" style={{ color: `var(--prio-${p})` }}>{label}</span>
                            <div className="chart-bar-track">
                                <div className="chart-bar-fill" style={{ width: `${t ? (d / t) * 100 : 0}%` }} />
                            </div>
                            <span className="chart-bar-value">{d}/{t}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* AI Narrative */}
            <div className="card mb-lg">
                <div className="flex items-center justify-between mb-md">
                    <div style={{ fontSize: 14, fontWeight: 600 }}>◈ Анализ от ARCA</div>
                    <button className="btn btn-ghost btn-sm" onClick={generateAI} disabled={loadingAI || total === 0}>
                        {loadingAI ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <TrendingUp size={14} />}
                        {loadingAI ? 'Анализирую...' : 'Сгенерировать'}
                    </button>
                </div>
                {aiNarrative ? (
                    <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{aiNarrative}</p>
                ) : (
                    <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                        {total === 0 ? 'Нет задач за выбранный период' : 'Нажмите "Сгенерировать" для AI-анализа'}
                    </p>
                )}
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
