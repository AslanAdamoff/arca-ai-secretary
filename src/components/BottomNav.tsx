import { useNavigate, useLocation } from 'react-router-dom';
import { Home, CheckSquare, MessageCircle, BarChart2, Settings } from 'lucide-react';

const NAV_ITEMS = [
    { path: '/', icon: Home, label: 'Главная' },
    { path: '/tasks', icon: CheckSquare, label: 'Задачи' },
    { path: '/chat', icon: MessageCircle, label: 'ARCA' },
    { path: '/analytics', icon: BarChart2, label: 'Итоги' },
    { path: '/settings', icon: Settings, label: 'Настройки' },
];

export default function BottomNav() {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    return (
        <nav className="bottom-nav">
            {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
                const active = pathname === path || (path !== '/' && pathname.startsWith(path));
                return (
                    <button
                        key={path}
                        className={`nav-item ${active ? 'active' : ''}`}
                        onClick={() => navigate(path)}
                        aria-label={label}
                    >
                        <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                        <span>{label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
