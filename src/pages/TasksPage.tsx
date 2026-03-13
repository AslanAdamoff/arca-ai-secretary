import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import { CATEGORY_LABELS, STATUS_LABELS } from '../services/taskService';
import type { TaskCategory, TaskStatus } from '../types';

export default function TasksPage() {
    const navigate = useNavigate();
    const { tasks } = useApp();
    const [search, setSearch] = useState('');
    const [filterCat, setFilterCat] = useState<TaskCategory | 'all'>('all');
    const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
    const [showFilters, setShowFilters] = useState(false);

    const filtered = tasks.filter(t => {
        const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase());
        const matchCat = filterCat === 'all' || t.category === filterCat;
        const matchStatus = filterStatus === 'all' || t.status === filterStatus;
        return matchSearch && matchCat && matchStatus;
    }).sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        const statusOrder = { 'in-progress': 0, todo: 1, done: 2, cancelled: 3 };
        if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });



    return (
        <div>
            <div className="page-header">
                <div className="flex items-center justify-between">
                    <h1 className="page-title">Задачи</h1>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/tasks/new')}>
                        <Plus size={16} /> Добавить
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="flex gap-sm mb-md">
                <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        className="form-input"
                        style={{ paddingLeft: 38 }}
                        placeholder="Поиск задач..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <button className={`btn btn-ghost btn-sm ${showFilters ? 'btn-primary' : ''}`} onClick={() => setShowFilters(v => !v)}>
                    <Filter size={16} />
                </button>
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="card card-sm mb-md">
                    <div className="form-group mb-sm">
                        <label className="form-label">Категория</label>
                        <div className="flex gap-xs" style={{ flexWrap: 'wrap' }}>
                            {(['all', 'work', 'personal', 'health', 'finance', 'learning', 'other'] as const).map(cat => (
                                <button
                                    key={cat}
                                    className={`badge ${cat !== 'all' ? `badge-${cat}` : ''}`}
                                    style={{
                                        cursor: 'pointer',
                                        border: filterCat === cat ? '2px solid currentColor' : '2px solid transparent',
                                        background: cat === 'all' && filterCat === 'all' ? 'var(--bg-hover)' : undefined,
                                        padding: '4px 12px',
                                    }}
                                    onClick={() => setFilterCat(cat)}
                                >
                                    {cat === 'all' ? 'Все' : CATEGORY_LABELS[cat]}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Статус</label>
                        <div className="flex gap-xs" style={{ flexWrap: 'wrap' }}>
                            {(['all', 'todo', 'in-progress', 'done', 'cancelled'] as const).map(st => (
                                <button
                                    key={st}
                                    className="badge badge-other"
                                    style={{
                                        cursor: 'pointer',
                                        border: filterStatus === st ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                        padding: '4px 12px',
                                    }}
                                    onClick={() => setFilterStatus(st)}
                                >
                                    {st === 'all' ? 'Все' : STATUS_LABELS[st]}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Task list */}
            {filtered.length === 0 ? (
                <div className="empty-state">
                    <span style={{ fontSize: 40 }}>📋</span>
                    <h3>Задач нет</h3>
                    <p>Добавьте первую задачу</p>
                </div>
            ) : (
                <div className="stack">
                    {filtered.map(task => (
                        <button
                            key={task.id}
                            className={`task-card ${task.status === 'done' ? 'done' : ''}`}
                            data-priority={task.priority}
                            onClick={() => navigate(`/tasks/${task.id}`)}
                            style={{ width: '100%', textAlign: 'left' }}
                        >
                            {/* Priority indicator */}
                            <div
                                style={{
                                    width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                                    background: task.priority === 'urgent' ? 'var(--prio-urgent)' :
                                        task.priority === 'high' ? 'var(--prio-high)' :
                                            task.priority === 'medium' ? 'var(--prio-medium)' : 'var(--prio-low)',
                                }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontWeight: 500, fontSize: 14,
                                    textDecoration: task.status === 'done' ? 'line-through' : 'none',
                                    color: task.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)',
                                }}>{task.title}</div>
                                <div className="flex gap-xs mt-sm" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                                    <span className={`badge badge-${task.category}`}>{CATEGORY_LABELS[task.category]}</span>
                                    {task.dueDate && (
                                        <span className="text-xs text-muted">
                                            {format(parseISO(task.dueDate), 'd MMM', { locale: ru })}
                                        </span>
                                    )}
                                    {task.subtasks.length > 0 && (
                                        <span className="text-xs text-muted">
                                            {task.subtasks.filter(s => s.done).length}/{task.subtasks.length} подзадач
                                        </span>
                                    )}
                                </div>
                            </div>
                            <ChevronRight size={16} color="var(--text-muted)" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
