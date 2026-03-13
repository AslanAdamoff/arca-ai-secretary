import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Sun, Moon, Plus, TrendingUp, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTasksForToday, getOverdueTasks } from '../services/taskService';

export default function HomeScreen() {
    const navigate = useNavigate();
    const { settings, tasks } = useApp();
    const hour = new Date().getHours();
    const todayTasks = getTasksForToday(tasks);
    const overdue = getOverdueTasks(tasks);
    const doneTodayCount = tasks.filter(t => t.completedAt?.startsWith(format(new Date(), 'yyyy-MM-dd'))).length;

    const greeting = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
    const greetingIcon = hour < 18 ? <Sun size={20} /> : <Moon size={20} />;
    const dateStr = format(new Date(), "EEEE, d MMMM", { locale: ru });
    const dateCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

    return (
        <div>
            {/* JARVIS Greeting */}
            <div className="jarvis-greeting mb-lg">
                <div className="jarvis-name">◈ ARCA — Ваш ассистент</div>
                <div className="jarvis-message">{greeting}, {settings.userName} {greetingIcon}</div>
                <div className="jarvis-sub">{dateCapitalized}</div>

                {/* Summary chips */}
                <div className="flex gap-sm mt-md" style={{ flexWrap: 'wrap' }}>
                    {todayTasks.length > 0 && (
                        <span className="badge badge-work">
                            <Clock size={11} /> {todayTasks.length} на сегодня
                        </span>
                    )}
                    {doneTodayCount > 0 && (
                        <span className="badge badge-health">
                            <CheckCircle2 size={11} /> {doneTodayCount} выполнено
                        </span>
                    )}
                    {overdue.length > 0 && (
                        <span className="badge badge-urgent">
                            <AlertTriangle size={11} /> {overdue.length} просрочено
                        </span>
                    )}
                    {todayTasks.length === 0 && doneTodayCount === 0 && overdue.length === 0 && (
                        <span className="badge badge-other">Нет активных задач</span>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="section-header">
                <span className="section-title">Быстрые действия</span>
            </div>
            <div className="quick-actions mb-lg">
                <button className="quick-action-card" onClick={() => navigate('/morning')}>
                    <div className="quick-action-icon" style={{ background: 'rgba(99,102,241,0.15)' }}>
                        <Sun size={20} color="var(--accent-primary)" />
                    </div>
                    <div className="quick-action-title">Утренний обзор</div>
                    <div className="quick-action-desc">Разобрать задачи на день</div>
                </button>
                <button className="quick-action-card" onClick={() => navigate('/evening')}>
                    <div className="quick-action-icon" style={{ background: 'rgba(34,211,238,0.12)' }}>
                        <Moon size={20} color="var(--accent-secondary)" />
                    </div>
                    <div className="quick-action-title">Вечерний обзор</div>
                    <div className="quick-action-desc">Итоги + план на завтра</div>
                </button>
                <button className="quick-action-card" onClick={() => navigate('/chat')}>
                    <div className="quick-action-icon" style={{ background: 'rgba(167,139,250,0.15)' }}>
                        <span style={{ fontSize: 20 }}>🤖</span>
                    </div>
                    <div className="quick-action-title">Чат с ARCA</div>
                    <div className="quick-action-desc">ИИ-ассистент всегда готов</div>
                </button>
                <button className="quick-action-card" onClick={() => navigate('/analytics')}>
                    <div className="quick-action-icon" style={{ background: 'rgba(52,211,153,0.12)' }}>
                        <TrendingUp size={20} color="var(--accent-success)" />
                    </div>
                    <div className="quick-action-title">Аналитика</div>
                    <div className="quick-action-desc">Прогресс и итоги</div>
                </button>
            </div>

            {/* Today's Tasks */}
            <div className="section-header">
                <span className="section-title">Сегодня</span>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/tasks')}>Все</button>
            </div>

            {todayTasks.length === 0 && overdue.length === 0 ? (
                <div className="card card-sm" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                    <CheckCircle2 size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.3 }} />
                    <div style={{ fontSize: 14 }}>Нет задач на сегодня</div>
                    <button className="btn btn-primary btn-sm mt-md" onClick={() => navigate('/tasks/new')} style={{ margin: '12px auto 0' }}>
                        <Plus size={15} /> Добавить задачу
                    </button>
                </div>
            ) : (
                <div className="stack">
                    {overdue.slice(0, 3).map(t => (
                        <button key={t.id} className="task-card" data-priority={t.priority} onClick={() => navigate(`/tasks/${t.id}`)}>
                            <div className="task-checkbox">
                                <AlertTriangle size={11} color="var(--prio-urgent)" />
                            </div>
                            <div>
                                <div style={{ fontWeight: 500, fontSize: 14 }}>{t.title}</div>
                                <div className="text-xs text-muted">Просрочена</div>
                            </div>
                        </button>
                    ))}
                    {todayTasks.slice(0, 5).map(t => (
                        <button key={t.id} className="task-card" data-priority={t.priority} onClick={() => navigate(`/tasks/${t.id}`)}>
                            <div className="task-checkbox" />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 500, fontSize: 14 }}>{t.title}</div>
                                {t.description && <div className="text-xs text-muted truncate">{t.description}</div>}
                            </div>
                            <span className={`badge badge-${t.category}`} style={{ fontSize: 11 }}>
                                {t.category === 'work' ? 'Работа' : t.category === 'personal' ? 'Личное' :
                                    t.category === 'health' ? 'Здоровье' : t.category === 'finance' ? 'Финансы' :
                                        t.category === 'learning' ? 'Обучение' : 'Прочее'}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* Add fab */}
            <button
                onClick={() => navigate('/tasks/new')}
                style={{
                    position: 'fixed', bottom: 'calc(var(--nav-height) + 16px)', right: 20,
                    width: 52, height: 52, borderRadius: '50%',
                    background: 'var(--accent-primary)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: 'var(--shadow-glow)', zIndex: 90,
                    transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
                <Plus size={22} />
            </button>
        </div>
    );
}
