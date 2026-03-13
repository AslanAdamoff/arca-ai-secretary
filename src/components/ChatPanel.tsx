import { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, VolumeX } from 'lucide-react';
import type { ChatMessage } from '../types';
import { useApp } from '../context/AppContext';
import { sendMessage } from '../services/aiService';
import { startListening, stopListening, speak, stopSpeaking } from '../services/voiceService';
import { v4 as uuidv4 } from 'uuid';

interface Props {
    initialHistory?: ChatMessage[];
    onHistoryChange?: (history: ChatMessage[]) => void;
    placeholder?: string;
    extraContext?: string;
}

export default function ChatPanel({ initialHistory = [], onHistoryChange, placeholder = 'Написать ARCA...', extraContext }: Props) {
    const { settings } = useApp();
    const [history, setHistory] = useState<ChatMessage[]>(initialHistory);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [listening, setListening] = useState(false);
    const [speaking, setSpeaking] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    const send = async (text: string) => {
        if (!text.trim() || loading) return;
        const userMsg: ChatMessage = { id: uuidv4(), role: 'user', content: text.trim(), timestamp: new Date().toISOString() };
        const newHistory = [...history, userMsg];
        setHistory(newHistory);
        setInput('');
        setLoading(true);

        const result = await sendMessage(newHistory, text, settings, null, extraContext);
        const assistantMsg: ChatMessage = {
            id: uuidv4(),
            role: 'assistant',
            content: result.error ? `Ошибка: ${result.error}` : result.content,
            timestamp: new Date().toISOString(),
        };
        const finalHistory = [...newHistory, assistantMsg];
        setHistory(finalHistory);
        onHistoryChange?.(finalHistory);
        setLoading(false);

        if (settings.voiceEnabled && !result.error) {
            setSpeaking(true);
            speak(result.content, { speed: settings.voiceSpeed, pitch: settings.voicePitch, lang: settings.voiceLanguage });
            setTimeout(() => setSpeaking(false), result.content.length * 60);
        }
    };

    const toggleVoice = () => {
        if (listening) {
            stopListening();
            setListening(false);
        } else {
            setListening(true);
            startListening(
                (text) => { setListening(false); setInput(text); },
                () => setListening(false),
                settings.voiceLanguage
            );
        }
    };

    const toggleSpeaking = () => {
        if (speaking) { stopSpeaking(); setSpeaking(false); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Messages area */}
            <div className="chat-container" style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
                {history.length === 0 && (
                    <div className="empty-state">
                        <p>Начните разговор с ARCA</p>
                    </div>
                )}
                {history.map(msg => (
                    <div key={msg.id} className={`chat-bubble ${msg.role}`}>
                        {msg.content}
                    </div>
                ))}
                {loading && (
                    <div className="chat-bubble assistant" style={{ color: 'var(--text-muted)' }}>
                        <span style={{ display: 'flex', gap: 4 }}>
                            <Dot delay={0} /><Dot delay={0.2} /><Dot delay={0.4} />
                        </span>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input row */}
            <div className="chat-input-row">
                {settings.voiceEnabled && (
                    <button className={`voice-btn ${listening ? 'listening' : ''}`} onClick={toggleVoice} title={listening ? 'Остановить' : 'Говорить'}>
                        {listening ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                )}
                {speaking && (
                    <button className="voice-btn" onClick={toggleSpeaking} title="Остановить речь">
                        <VolumeX size={18} />
                    </button>
                )}
                <textarea
                    className="form-textarea"
                    style={{ minHeight: 44, maxHeight: 120, resize: 'none', borderRadius: 12 }}
                    placeholder={placeholder}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                    rows={1}
                />
                <button className="btn btn-primary btn-icon" onClick={() => send(input)} disabled={!input.trim() || loading} style={{ borderRadius: 12, padding: 10 }}>
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
}

function Dot({ delay }: { delay: number }) {
    return (
        <span style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)',
            display: 'inline-block',
            animation: `bounce 1s ${delay}s infinite`,
        }} />
    );
}
