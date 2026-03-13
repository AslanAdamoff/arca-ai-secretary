import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Sparkles, Check, ChevronRight, Loader, X, Calendar } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { useApp } from '../context/AppContext';
import { decomposeGoal, type DecomposedTask } from '../services/aiService';
import { buildTask } from '../services/taskService';

const PRIORITY_COLORS: Record<string, string> = {
    urgent: 'var(--prio-urgent)',
    high: 'var(--prio-high)',
    medium: 'var(--prio-medium)',
    low: 'var(--prio-low)',
};
const PRIORITY_LABELS: Record<string, string> = {
    urgent: '🔴 Срочно', high: '🟠 Высокий', medium: '🟡 Средний', low: '🟢 Низкий',
};
const CAT_LABELS: Record<string, string> = {
    work: '💼 Работа', personal: '👤 Личное', health: '💪 Здоровье',
    finance: '💰 Финансы', learning: '📚 Обучение', other: '📌 Прочее',
};

export default function GoalDecomposerPage() {
    const navigate = useNavigate();
    const { settings, saveTask, toast } = useApp();
    const [goal, setGoal] = useState('');
    const [context, setContext] = useState('');
    const [loading, setLoading] = useState(false);
    const [tasks, setTasks] = useState<DecomposedTask[]>([]);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(false);

    const handleDecompose = async () => {
        if (!goal.trim()) return;
        setLoading(true);
        setTasks([]);
        setSelected(new Set());
        setDone(false);
        const result = await decomposeGoal(goal, settings, context || undefined);
        setTasks(result);
        setSelected(new Set(result.map((_, i) => i))); // select all by default
        setLoading(false);
    };

    const toggleTask = (idx: number) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(idx) ? next.delete(idx) : next.add(idx);
            return next;
        });
    };

    const handleSave = async () => {
        if (selected.size === 0) return;
        setSaving(true);
        const toCreate = tasks.filter((_, i) => selected.has(i));
        for (const t of toCreate) {
            const task = buildTask({
                title: t.title,
                description: t.description,
                category: t.category,
                priority: t.priority,
                dueDate: t.daysFromNow === 0 ? format(new Date(), 'yyyy-MM-dd')
                    : format(addDays(new Date(), t.daysFromNow), 'yyyy-MM-dd'),
            });
            await saveTask(task);
        }
        setSaving(false);
        setDone(true);
        toast(`✓ Добавлено ${selected.size} задач`);
    };

    if (done) {
        return (
            <div>
                <div className="page-header">
                    <h1 className="page-title"><Target size={20} style={{ display: 'inline', marginRight: 8, color: 'var(--accent-primary)' }} />Цель разобрана</h1>
                </div>
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <div style={{ fontSize: 56, marginBottom: 16 }}>🎯</div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                        {selected.size} задач добавлено!
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
                        ARCA разложила цель на конкретные шаги и добавила их в план
                    </p>
                    <div className="stack">
                        <button className="btn btn-primary btn-full" onClick={() => navigate('/tasks')}>Посмотреть задачи</button>
                        <button className="btn btn-ghost btn-full" onClick={() => { setGoal(''); setTasks([]); setDone(false); }}>Разобрать другую цель</button>
                        <button className="btn btn-ghost btn-full" onClick={() => navigate('/')}>На главную</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">
                    <Target size={20} style={{ display: 'inline', marginRight: 8, color: 'var(--accent-primary)' }} />
                    Разобрать цель
                </h1>
                <p className="page-subtitle">ARCA разобьёт вашу цель на конкретные задачи</p>
            </div>

            {/* Goal input */}
            <div className="card mb-md">
                <div className="jarvis-name mb-sm">◈ ARCA</div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                    Опишите цель — я разложу её на шаги с приоритетами и дедлайнами
                </p>
                <textarea
                    className="form-textarea"
                    placeholder="Например: Подготовить годовой отчёт к пятнице..."
                    value={goal}
                    onChange={e => setGoal(e.target.value)}
                    rows={3}
                    style={{ marginBottom: 12 }}
                />
                <textarea
                    className="form-textarea"
                    placeholder="Дополнительный контекст (необязательно): команда, ограничения, ресурсы..."
                    value={context}
                    onChange={e => setContext(e.target.value)}
                    rows={2}
                    style={{ marginBottom: 16 }}
                />
                <button
                    className="btn btn-primary btn-full"
                    onClick={handleDecompose}
                    disabled={!goal.trim() || loading}
                >
                    {loading ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                            <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                            ARCA анализирует...
                        </span>
                    ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                            <Sparkles size={16} />
                            Разобрать цель
                        </span>
                    )}
                </button>
            </div>

            {/* Task list */}
            {tasks.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-sm" style={{ paddingLeft: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {tasks.length} задач · выбрано {selected.size}
                        </span>
                        <div className="flex gap-xs">
                            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set(tasks.map((_, i) => i)))}>Все</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Ничего</button>
                        </div>
                    </div>

                    <div className="stack mb-md">
                        {tasks.map((task, idx) => {
                            const isSelected = selected.has(idx);
                            const dueLabel = task.daysFromNow === 0 ? 'Сегодня'
                                : task.daysFromNow === 1 ? 'Завтра'
                                : `Через ${task.daysFromNow} дн.`;
                            return (
                                <div key={idx}
                                    className="card"
                                    onClick={() => toggleTask(idx)}
                                    style={{
                                        cursor: 'pointer',
                                        border: `1.5px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                                        opacity: isSelected ? 1 : 0.5,
                                        transition: 'all 0.2s ease',
                                    }}>
                                    <div className="flex items-center gap-sm">
                                        <div style={{
                                            width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                                            background: isSelected ? 'var(--accent-primary)' : 'transparent',
                                            border: `1.5px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-medium)'}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {isSelected && <Check size={12} color="white" />}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                                                {task.title}
                                            </div>
                                            {task.description && (
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                                                    {task.description}
                                                </div>
                                            )}
                                            <div className="flex gap-xs flex-wrap">
                                                <span style={{ fontSize: 11, color: PRIORITY_COLORS[task.priority] }}>
                                                    {PRIORITY_LABELS[task.priority]}
                                                </span>
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>·</span>
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                    {CAT_LABELS[task.category]}
                                                </span>
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>·</span>
                                                <span style={{ fontSize: 11, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                    <Calendar size={10} /> {dueLabel}
                                                </span>
                                            </div>
                                        </div>
                                        {!isSelected && <X size={14} color="var(--text-muted)" />}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <button
                        className="btn btn-primary btn-full"
                        onClick={handleSave}
                        disabled={selected.size === 0 || saving}
                    >
                        {saving ? 'Сохраняю...' : `Добавить ${selected.size} задач в план`}
                        {!saving && <ChevronRight size={16} style={{ display: 'inline', marginLeft: 4 }} />}
                    </button>
                </div>
            )}
        </div>
    );
}
