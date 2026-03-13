import { useApp } from '../context/AppContext';
import ChatPanel from '../components/ChatPanel';

export default function ChatPage() {
    const { settings } = useApp();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--nav-height) - 32px)' }}>
            <div className="page-header" style={{ paddingBottom: 12 }}>
                <h1 className="page-title">◈ ARCA</h1>
                <p className="page-subtitle">Ваш персональный ИИ-ассистент · {settings.aiProvider === 'demo' ? 'Demo режим' : settings.aiProvider === 'openai' ? 'GPT-4o' : 'Gemini'}</p>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <ChatPanel placeholder="Задайте вопрос или поставьте задачу..." />
            </div>
        </div>
    );
}
