import { useState, useEffect } from 'react';
import { User, Bot, Mic, Sun, Key, Download, Upload, Info, Shield, Lock, Cloud, CloudOff, Bell, BellOff, Play } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { exportAllData, importAllData } from '../services/storage';
import type { AIProvider, ReviewMode } from '../types';
import PinScreen from '../components/PinScreen';
import { requestPermission, hasPermission, isPushSupported } from '../services/pushService';
import { getAvailableVoices, speakARCA } from '../services/voiceService';

type PinFlow = 'verify-old' | 'setup' | 'confirm' | null;

export default function SettingsPage() {
    const { settings, updateSettings, toast, syncStatus, firebaseUid } = useApp();
    const [showKey, setShowKey] = useState(false);
    const [pinFlow, setPinFlow] = useState<PinFlow>(null);
    const [newPin, setNewPin] = useState('');
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
    const pushSupported = isPushSupported();
    const pushGranted = hasPermission();

    useEffect(() => {
        // Load voices (may be async in Chrome)
        const load = () => {
            const voices = getAvailableVoices(settings.voiceLanguage?.split('-')[0] ?? 'ru');
            if (voices.length > 0) setAvailableVoices(voices);
        };
        load();
        window.speechSynthesis?.addEventListener('voiceschanged', load);
        return () => window.speechSynthesis?.removeEventListener('voiceschanged', load);
    }, [settings.voiceLanguage]);

    const hasPIN = !!settings.pin;

    const startPinSetup = () => {
        if (hasPIN) {
            setPinFlow('verify-old'); // must verify existing PIN first
        } else {
            setPinFlow('setup');
        }
    };

    const handlePinStep = (step: PinFlow) => (pin?: string) => {
        if (step === 'verify-old') {
            // correct PIN verified → proceed to enter new one
            setPinFlow('setup');
        } else if (step === 'setup' && pin) {
            setNewPin(pin);
            setPinFlow('confirm');
        } else if (step === 'confirm' && pin) {
            if (pin !== newPin) {
                toast('PIN не совпадает — попробуйте снова');
                setPinFlow('setup');
                setNewPin('');
            } else {
                updateSettings({ pin });
                setPinFlow(null);
                setNewPin('');
                toast('PIN установлен ✓');
            }
        }
    };

    const removePin = () => {
        updateSettings({ pin: undefined });
        toast('PIN удалён');
    };

    const handleExport = () => {
        const data = exportAllData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `arca-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        toast('Данные экспортированы');
    };

    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    importAllData(ev.target?.result as string);
                    toast('Данные импортированы — перезагрузите страницу');
                } catch {
                    toast('Ошибка при импорте файла');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    // Show PIN screen overlay during setup flow
    if (pinFlow === 'verify-old') {
        return (
            <PinScreen
                mode="unlock"
                savedPin={settings.pin}
                title="Текущий PIN"
                subtitle="Введите текущий PIN для изменения"
                onSuccess={handlePinStep('verify-old')}
                onCancel={() => setPinFlow(null)}
            />
        );
    }
    if (pinFlow === 'setup') {
        return (
            <PinScreen
                mode="setup"
                title={hasPIN ? 'Новый PIN' : 'Создайте PIN'}
                subtitle="Введите 4 цифры"
                onSuccess={handlePinStep('setup')}
                onCancel={() => setPinFlow(null)}
            />
        );
    }
    if (pinFlow === 'confirm') {
        return (
            <PinScreen
                mode="confirm"
                title="Подтвердите PIN"
                subtitle="Введите PIN ещё раз"
                onSuccess={handlePinStep('confirm')}
                onCancel={() => { setPinFlow(null); setNewPin(''); }}
            />
        );
    }

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Настройки</h1>
                <p className="page-subtitle">Персонализация и конфигурация</p>
            </div>

            {/* Profile */}
            <div className="card mb-md">
                <div className="flex items-center gap-sm mb-md">
                    <User size={16} color="var(--accent-primary)" />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Профиль</span>
                </div>
                <div className="form-group">
                    <label className="form-label">Ваше имя</label>
                    <input className="form-input" value={settings.userName}
                        onChange={e => updateSettings({ userName: e.target.value })}
                        placeholder="Как вас зовут?" />
                </div>
            </div>

            {/* Appearance */}
            <div className="card mb-md">
                <div className="flex items-center gap-sm mb-md">
                    <Sun size={16} color="var(--accent-warning)" />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Внешний вид</span>
                </div>
                <div className="settings-row">
                    <div className="settings-row-info">
                        <div className="settings-row-label">Тёмная тема</div>
                        <div className="settings-row-desc">Переключить тёмный / светлый режим</div>
                    </div>
                    <label className="toggle">
                        <input type="checkbox" checked={settings.theme === 'dark'}
                            onChange={e => updateSettings({ theme: e.target.checked ? 'dark' : 'light' })} />
                        <span className="toggle-slider" />
                    </label>
                </div>
            </div>

            {/* Security / PIN */}
            <div className="card mb-md">
                <div className="flex items-center gap-sm mb-md">
                    <Shield size={16} color="var(--accent-success)" />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Безопасность</span>
                </div>
                <div className="settings-row">
                    <div className="settings-row-info">
                        <div className="settings-row-label">PIN-код</div>
                        <div className="settings-row-desc">
                            {hasPIN ? '🔒 Установлен — приложение защищено' : '🔓 Не установлен'}
                        </div>
                    </div>
                    <button className={`btn btn-sm ${hasPIN ? 'btn-ghost' : 'btn-primary'}`} onClick={startPinSetup}>
                        <Lock size={14} />
                        {hasPIN ? 'Изменить' : 'Установить'}
                    </button>
                </div>
                {hasPIN && (
                    <div className="settings-row" style={{ marginTop: 8 }}>
                        <div className="settings-row-info">
                            <div className="settings-row-label" style={{ color: 'var(--accent-danger)' }}>Снять защиту</div>
                            <div className="settings-row-desc">Удалить PIN-код</div>
                        </div>
                        <button className="btn btn-danger btn-sm" onClick={removePin}>Удалить</button>
                    </div>
                )}
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
                    Блокировка через 5 мин бездействия · Блокировка при сворачивании
                </div>
            </div>

            {/* Notifications */}
            <div className="card mb-md">
                <div className="flex items-center gap-sm mb-md">
                    {settings.notificationsEnabled ? <Bell size={16} color="var(--accent-warning)" /> : <BellOff size={16} color="var(--text-muted)" />}
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Уведомления</span>
                    {!pushSupported && (
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>Не поддерживается</span>
                    )}
                </div>
                <div className="settings-row">
                    <div className="settings-row-info">
                        <div className="settings-row-label">Включить уведомления</div>
                        <div className="settings-row-desc">
                            {pushGranted ? '🔔 Разрешение выдано' : '🔕 Нужно разрешение браузера'}
                        </div>
                    </div>
                    <label className="toggle">
                        <input type="checkbox"
                            checked={settings.notificationsEnabled && pushGranted}
                            disabled={!pushSupported}
                            onChange={async e => {
                                if (e.target.checked && !pushGranted) {
                                    const granted = await requestPermission();
                                    if (!granted) { toast('Разрешение на уведомления не выдано'); return; }
                                }
                                updateSettings({ notificationsEnabled: e.target.checked });
                            }} />
                        <span className="toggle-slider" />
                    </label>
                </div>
                {settings.notificationsEnabled && pushGranted && (
                    <>
                        <div className="settings-row" style={{ marginTop: 12 }}>
                            <div className="settings-row-info">
                                <div className="settings-row-label">Утренний брифинг</div>
                                <div className="settings-row-desc">ARCA будит тебя и открывает обзор дня</div>
                            </div>
                            <input type="time" className="form-input" style={{ width: 110 }}
                                value={settings.briefingTime}
                                onChange={e => updateSettings({ briefingTime: e.target.value })} />
                        </div>
                        <div className="settings-row" style={{ marginTop: 12 }}>
                            <div className="settings-row-info">
                                <div className="settings-row-label">Напоминание о задаче</div>
                                <div className="settings-row-desc">За сколько минут до дедлайна</div>
                            </div>
                            <select className="form-select" style={{ width: 110 }}
                                value={settings.taskReminderMinutes}
                                onChange={e => updateSettings({ taskReminderMinutes: Number(e.target.value) })}>
                                <option value={15}>За 15 мин</option>
                                <option value={30}>За 30 мин</option>
                                <option value={60}>За 1 час</option>
                                <option value={120}>За 2 часа</option>
                            </select>
                        </div>
                    </>
                )}
            </div>

            {/* Review mode */}
            <div className="card mb-md">
                <div className="flex items-center gap-sm mb-md">
                    <Info size={16} color="var(--accent-secondary)" />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Режим обзора</span>
                </div>
                <div className="settings-row">
                    <div className="settings-row-info">
                        <div className="settings-row-label">Режим по умолчанию</div>
                        <div className="settings-row-desc">Карточки или чат с ARCA</div>
                    </div>
                    <select className="form-select" style={{ width: 120 }} value={settings.reviewMode}
                        onChange={e => updateSettings({ reviewMode: e.target.value as ReviewMode })}>
                        <option value="cards">Карточки</option>
                        <option value="chat">Чат</option>
                    </select>
                </div>
            </div>

            {/* AI */}
            <div className="card mb-md">
                <div className="flex items-center gap-sm mb-md">
                    <Bot size={16} color="var(--accent-primary)" />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>ИИ-Ассистент</span>
                </div>
                <div className="settings-row">
                    <div className="settings-row-info">
                        <div className="settings-row-label">Провайдер</div>
                    </div>
                    <select className="form-select" style={{ width: 120 }} value={settings.aiProvider}
                        onChange={e => updateSettings({ aiProvider: e.target.value as AIProvider })}>
                        <option value="demo">Demo</option>
                        <option value="openai">OpenAI</option>
                        <option value="gemini">Gemini</option>
                    </select>
                </div>

                {settings.aiProvider === 'openai' && (
                    <div className="form-group mt-md">
                        <label className="form-label">OpenAI API Key</label>
                        <div className="flex gap-sm">
                            <input className="form-input" type={showKey ? 'text' : 'password'}
                                placeholder="sk-..." value={settings.openaiApiKey ?? ''}
                                onChange={e => updateSettings({ openaiApiKey: e.target.value })} />
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowKey(v => !v)}>
                                <Key size={14} />
                            </button>
                        </div>
                        <div className="text-xs text-muted mt-sm">Ключ хранится локально на вашем устройстве</div>
                    </div>
                )}

                {settings.aiProvider === 'gemini' && (
                    <div className="form-group mt-md">
                        <label className="form-label">Gemini API Key</label>
                        <div className="flex gap-sm">
                            <input className="form-input" type={showKey ? 'text' : 'password'}
                                placeholder="AIza..." value={settings.geminiApiKey ?? ''}
                                onChange={e => updateSettings({ geminiApiKey: e.target.value })} />
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowKey(v => !v)}>
                                <Key size={14} />
                            </button>
                        </div>
                    </div>
                )}

                {settings.aiProvider === 'demo' && (
                    <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)', marginTop: 12 }}>
                        Demo режим — ARCA отвечает шаблонными ответами без реального AI. Добавьте API ключ для полного функционала.
                    </div>
                )}
            </div>

            {/* Voice */}
            <div className="card mb-md">
                <div className="flex items-center gap-sm mb-md">
                    <Mic size={16} color="var(--prio-urgent)" />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Голос</span>
                </div>
                <div className="settings-row">
                    <div className="settings-row-info">
                        <div className="settings-row-label">Голосовое управление</div>
                        <div className="settings-row-desc">Говорить с ARCA, слушать ответы</div>
                    </div>
                    <label className="toggle">
                        <input type="checkbox" checked={settings.voiceEnabled}
                            onChange={e => updateSettings({ voiceEnabled: e.target.checked })} />
                        <span className="toggle-slider" />
                    </label>
                </div>
                {settings.voiceEnabled && (
                    <>
                        <div className="settings-row">
                            <div className="settings-row-info">
                                <div className="settings-row-label">Язык распознавания</div>
                            </div>
                            <select className="form-select" style={{ width: 120 }} value={settings.voiceLanguage}
                                onChange={e => updateSettings({ voiceLanguage: e.target.value })}>
                                <option value="ru-RU">Русский</option>
                                <option value="en-US">English</option>
                            </select>
                        </div>
                        <div className="settings-row">
                            <div className="settings-row-info">
                                <div className="settings-row-label">Скорость речи</div>
                            </div>
                            <input type="range" min="0.5" max="2" step="0.1" value={settings.voiceSpeed}
                                onChange={e => updateSettings({ voiceSpeed: parseFloat(e.target.value) })}
                                style={{ accentColor: 'var(--accent-primary)', width: 100 }} />
                        </div>
                        {availableVoices.length > 0 && (
                            <div className="settings-row">
                                <div className="settings-row-info">
                                    <div className="settings-row-label">Голос ARCA</div>
                                    <div className="settings-row-desc">Выберите лучший голос на вашем устройстве</div>
                                </div>
                                <div className="flex gap-xs" style={{ alignItems: 'center' }}>
                                    <select className="form-select" style={{ fontSize: 12, maxWidth: 160 }}
                                        value={settings.preferredVoiceName ?? ''}
                                        onChange={e => updateSettings({ preferredVoiceName: e.target.value || undefined })}>
                                        <option value="">Авто (лучший)</option>
                                        {availableVoices.map(v => (
                                            <option key={v.name} value={v.name}>{v.name}</option>
                                        ))}
                                    </select>
                                    <button className="btn btn-ghost btn-sm"
                                        onClick={() => speakARCA('Привет! Я ваш персональный ассистент ARCA.')}>
                                        <Play size={12} style={{ marginRight: 4 }} />Тест
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Integrations (stubs) */}
            <div className="card mb-md">
                <div className="flex items-center gap-sm mb-md">
                    <span style={{ fontSize: 16 }}>🔗</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Интеграции</span>
                </div>
                {['Google Calendar', 'Microsoft Outlook', 'Notion', 'Telegram'].map(name => (
                    <div key={name} className="settings-row">
                        <div className="settings-row-info">
                            <div className="settings-row-label">{name}</div>
                            <div className="settings-row-desc" style={{ color: 'var(--prio-medium)' }}>Скоро</div>
                        </div>
                        <button className="btn btn-ghost btn-sm" disabled style={{ opacity: 0.4 }}>Подключить</button>
                    </div>
                ))}
            </div>

            {/* Sync status */}
            <div className="card mb-md">
                <div className="flex items-center gap-sm mb-md">
                    {syncStatus === 'offline' || syncStatus === 'error'
                        ? <CloudOff size={16} color="var(--text-muted)" />
                        : <Cloud size={16} color="var(--accent-primary)" />}
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Синхронизация</span>
                    <span style={{
                        marginLeft: 'auto', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                        background: syncStatus === 'synced' ? 'rgba(52,211,153,0.15)' : syncStatus === 'syncing' ? 'rgba(99,102,241,0.15)' : 'rgba(156,163,175,0.15)',
                        color: syncStatus === 'synced' ? 'var(--accent-success)' : syncStatus === 'syncing' ? 'var(--accent-primary)' : 'var(--text-muted)',
                    }}>
                        {syncStatus === 'synced' ? '● Синхронизировано' : syncStatus === 'syncing' ? '◌ Синхронизация...' : syncStatus === 'error' ? '✕ Ошибка' : '○ Офлайн'}
                    </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {firebaseUid
                        ? <>Firebase ID: <code style={{ fontFamily: 'monospace', fontSize: 11 }}>{firebaseUid.slice(0, 16)}…</code> · Данные сохраняются в облаке</>
                        : 'Настройте VITE_FIREBASE_* переменные для облачной синхронизации'}
                </div>
            </div>

            {/* Data */}
            <div className="card mb-md">
                <div className="flex items-center gap-sm mb-md">
                    <Download size={16} color="var(--accent-success)" />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Данные</span>
                </div>
                <div className="stack">
                    <button className="btn btn-ghost btn-full" onClick={handleExport}>
                        <Download size={15} /> Экспортировать все данные (JSON)
                    </button>
                    <button className="btn btn-ghost btn-full" onClick={handleImport}>
                        <Upload size={15} /> Импортировать данные
                    </button>
                </div>
            </div>

            {/* App info */}
            <div className="card mb-lg" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--accent-primary)', marginBottom: 4 }}>◈ ARCA</div>
                    AI Secretary v1.0 · Adaptive Resource & Communication Assistant<br />
                    Данные хранятся локально на устройстве
                </div>
            </div>
        </div>
    );
}
