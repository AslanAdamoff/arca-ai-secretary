import { Routes, Route } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import PinScreen from './components/PinScreen';
import HomeScreen from './pages/HomeScreen';
import TasksPage from './pages/TasksPage';
import TaskDetailPage from './pages/TaskDetailPage';
import ChatPage from './pages/ChatPage';
import MorningReviewPage from './pages/MorningReviewPage';
import EveningReviewPage from './pages/EveningReviewPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import { useApp } from './context/AppContext';

export default function App() {
  const { isLocked, unlock, settings } = useApp();

  if (isLocked) {
    return (
      <PinScreen
        mode="unlock"
        savedPin={settings.pin}
        onSuccess={unlock}
      />
    );
  }

  return (
    <div className="app-shell">
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/new" element={<TaskDetailPage />} />
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/morning" element={<MorningReviewPage />} />
          <Route path="/evening" element={<EveningReviewPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
