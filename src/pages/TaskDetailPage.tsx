import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2, MessageCircle, Plus, Check } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '../context/AppContext';
import { buildTask, applyTaskChanges, CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, RECURRENCE_LABELS } from '../services/taskService';
import type { Task, TaskCategory, TaskPriority, TaskStatus, RecurrenceType } from '../types';
import ChatPanel from '../components/ChatPanel';

export default function TaskDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { tasks, saveTask, deleteTask, toast } = useApp();

    const existingTask = id && id !== 'new' ? tasks.find(t => t.id === id) ?? null : null;
    const [task, setTask] = useState<Task | null>(existingTask);
    const [isNew] = useState(id === 'new');
    const [showChat, setShowChat] = useState(false);
    const [newSubtask, setNewSubtask] = useState('');

    const [form, setForm] = useState<Partial<Task>>(task ?? {
        title: '', description: '', category: 'other', priority: 'medium', status: 'todo',
        recurrence: 'none', tags: [], subtasks: [], notes: '',
    });

    const save = async () => {
        if (!form.title?.trim()) { toast('Введите название задачи'); return; }
        if (isNew) {
            const newTask = buildTask(form);
            await saveTask(newTask);
            toast('Задача создана');
        } else if (task) {
            const updated = applyTaskChanges(task, form);
            await saveTask(updated);
            toast('Сохранено');
        }
        navigate('/tasks');
    };

    const handleDelete = async () => {
        if (!task) return;
        await deleteTask(task.id);
        toast('Задача удалена');
        navigate('/tasks');
    };

    const handleSubtaskAdd = async () => {
        if (!newSubtask.trim() || !task) return;
        const subtask = { id: uuidv4(), title: newSubtask.trim(), done: false };
        const updated = applyTaskChanges(task, { subtasks: [...task.subtasks, subtask] });
        await saveTask(updated);
        setTask(updated);
        setNewSubtask('');
    };

    const handleToggleSubtask = async (subtaskId: string) => {
        if (!task) return;
        const subtasks = task.subtasks.map(s => s.id === subtaskId ? { ...s, done: !s.done } : s);
        const updated = applyTaskChanges(task, { subtasks });
        await saveTask(updated);
        setTask(updated);
    };

    const handleChatHistoryChange = async (history: Task['chatHistory']) => {
        if (!task) return;
        const updated = applyTaskChanges(task, { chatHistory: history });
        await saveTask(updated);
        setTask(updated);
    };

    const completedSubtasks = task?.subtasks.filter(s => s.done).length ?? 0;
    const totalSubtasks = task?.subtasks.length ?? 0;

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-md mb-lg" style={{ paddingTop: 12 }}>
                <button className="btn-icon" onClick={() => navigate('/tasks')}><ArrowLeft size={22} /></button>
                <div className="flex-1" />
                {!isNew && (
                    <>
                        <button className="btn-icon" onClick={() => setShowChat(v => !v)} title="Чат с ARCA">
                            <MessageCircle size={22} color={showChat ? 'var(--accent-primary)' : undefined} />
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={handleDelete}><Trash2 size={15} /> Удалить</button>
                    </>
                )}
            </div>

            {/* Form */}
            <div className="stack">
                <div className="form-group">
                    <label className="form-label">Название *</label>
                    <input className="form-input" style={{ fontSize: 18, fontWeight: 600 }}
                        placeholder="Что нужно сделать?" value={form.title ?? ''}
                        onChange={e => setForm(p => ({ ...p, title: e.target.value }))} autoFocus={isNew} />
                </div>

                <div className="form-group">
                    <label className="form-label">Описание</label>
                    <textarea className="form-textarea" placeholder="Детали задачи..."
                        value={form.description ?? ''}
                        onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                </div>

                <div className="grid-2">
                    <div className="form-group">
                        <label className="form-label">Категория</label>
                        <select className="form-select" value={form.category}
                            onChange={e => setForm(p => ({ ...p, category: e.target.value as TaskCategory }))}>
                            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Приоритет</label>
                        <select className="form-select" value={form.priority}
                            onChange={e => setForm(p => ({ ...p, priority: e.target.value as TaskPriority }))}>
                            {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid-2">
                    <div className="form-group">
                        <label className="form-label">Статус</label>
                        <select className="form-select" value={form.status}
                            onChange={e => setForm(p => ({ ...p, status: e.target.value as TaskStatus }))}>
                            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Срок выполнения</label>
                        <input className="form-input" type="date" value={form.dueDate ?? ''}
                            onChange={e => setForm(p => ({ ...p, dueDate: e.target.value || undefined }))} />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Повторение</label>
                    <select className="form-select" value={form.recurrence}
                        onChange={e => setForm(p => ({ ...p, recurrence: e.target.value as RecurrenceType }))}>
                        {Object.entries(RECURRENCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">Заметки</label>
                    <textarea className="form-textarea" placeholder="Дополнительные заметки..."
                        value={form.notes ?? ''}
                        onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                </div>

                {/* Subtasks */}
                {!isNew && task && (
                    <div className="card">
                        <div className="flex items-center justify-between mb-md">
                            <span className="font-semibold" style={{ fontSize: 14 }}>Подзадачи</span>
                            {totalSubtasks > 0 && (
                                <span className="text-xs text-muted">{completedSubtasks}/{totalSubtasks}</span>
                            )}
                        </div>
                        {totalSubtasks > 0 && (
                            <div className="progress-bar mb-md">
                                <div className="progress-fill" style={{ width: `${totalSubtasks ? (completedSubtasks / totalSubtasks) * 100 : 0}%` }} />
                            </div>
                        )}
                        <div className="stack">
                            {task.subtasks.map(st => (
                                <div key={st.id} className="flex items-center gap-sm" style={{ padding: '6px 0' }}>
                                    <button
                                        className={`task-checkbox ${st.done ? 'checked' : ''}`}
                                        onClick={() => handleToggleSubtask(st.id)}
                                    >
                                        {st.done && <Check size={12} />}
                                    </button>
                                    <span style={{ fontSize: 14, textDecoration: st.done ? 'line-through' : 'none', color: st.done ? 'var(--text-muted)' : 'var(--text-primary)', flex: 1 }}>
                                        {st.title}
                                    </span>
                                </div>
                            ))}
                            <div className="flex gap-sm mt-sm">
                                <input className="form-input" style={{ flex: 1 }} placeholder="Новая подзадача..."
                                    value={newSubtask} onChange={e => setNewSubtask(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSubtaskAdd()} />
                                <button className="btn btn-ghost btn-sm" onClick={handleSubtaskAdd}><Plus size={15} /></button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Save button */}
            <div style={{ marginTop: 24, marginBottom: 24 }}>
                <button className="btn btn-primary btn-full btn-lg" onClick={save}>
                    {isNew ? 'Создать задачу' : 'Сохранить изменения'}
                </button>
            </div>

            {/* AI Chat panel */}
            {showChat && task && (
                <div className="card" style={{ height: 400, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                    <div className="flex items-center gap-sm" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-primary)' }}>◈ ARCA — чат по задаче</span>
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <ChatPanel
                            initialHistory={task.chatHistory}
                            onHistoryChange={handleChatHistoryChange}
                            placeholder="Спросить ARCA об этой задаче..."
                            extraContext={`Задача: "${task.title}". Статус: ${task.status}. Описание: ${task.description ?? 'нет'}`}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
