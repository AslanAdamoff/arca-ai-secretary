import { useState, useEffect } from 'react';
import { Delete } from 'lucide-react';

interface PinScreenProps {
  mode: 'unlock' | 'setup' | 'confirm';
  savedPin?: string;
  onSuccess: (pin?: string) => void;
  onCancel?: () => void;
  title?: string;
  subtitle?: string;
}

export default function PinScreen({ mode, savedPin, onSuccess, onCancel, title, subtitle }: PinScreenProps) {
  const [digits, setDigits] = useState('');
  const [shake, setShake] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(0);

  const PIN_LENGTH = 4;

  // Countdown timer for too many wrong attempts
  useEffect(() => {
    if (lockCountdown <= 0) return;
    const t = setTimeout(() => {
      setLockCountdown(c => {
        if (c <= 1) { setLocked(false); setAttempts(0); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [lockCountdown]);

  const handleDigit = (d: string) => {
    if (locked || digits.length >= PIN_LENGTH) return;
    const next = digits + d;
    setDigits(next);
    setErrorMsg('');

    if (next.length === PIN_LENGTH) {
      setTimeout(() => handleSubmit(next), 150);
    }
  };

  const handleDelete = () => {
    if (locked) return;
    setDigits(d => d.slice(0, -1));
    setErrorMsg('');
  };

  const handleSubmit = (pin: string) => {
    if (mode === 'unlock') {
      if (pin === savedPin) {
        onSuccess();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        triggerError(newAttempts >= 5
          ? `Слишком много попыток. Подождите 30 секунд`
          : `Неверный PIN. Попытка ${newAttempts}/5`
        );
        if (newAttempts >= 5) {
          setLocked(true);
          setLockCountdown(30);
        }
        setDigits('');
      }
    } else if (mode === 'setup' || mode === 'confirm') {
      onSuccess(pin);
    }
  };

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const defaultTitle = mode === 'unlock' ? 'Введите PIN' : mode === 'setup' ? 'Создайте PIN' : 'Повторите PIN';
  const defaultSubtitle = mode === 'unlock' ? 'Для доступа к ARCA' : mode === 'setup' ? '4 цифры' : 'Подтвердите PIN';

  return (
    <div className="pin-screen">
      {/* Header */}
      <div className="pin-header">
        <div className="pin-logo">◈</div>
        <h2 className="pin-title">{title ?? defaultTitle}</h2>
        <p className="pin-subtitle">{subtitle ?? defaultSubtitle}</p>
      </div>

      {/* Dots */}
      <div className={`pin-dots ${shake ? 'shake' : ''}`}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div key={i} className={`pin-dot ${i < digits.length ? 'filled' : ''} ${errorMsg ? 'error' : ''}`} />
        ))}
      </div>

      {/* Error */}
      <div className="pin-error" style={{ minHeight: 24 }}>
        {locked
          ? `Заблокировано. Подождите ${lockCountdown} сек.`
          : errorMsg}
      </div>

      {/* Keypad */}
      <div className="pin-keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key, i) => {
          if (key === '') return <div key={i} />;
          if (key === '⌫') return (
            <button key={i} className="pin-key pin-key-action" onClick={handleDelete}>
              <Delete size={22} />
            </button>
          );
          return (
            <button key={i} className="pin-key" onClick={() => handleDigit(key)} disabled={locked}>
              {key}
            </button>
          );
        })}
      </div>

      {/* Cancel */}
      {onCancel && (
        <button className="btn btn-ghost mt-md" onClick={onCancel} style={{ width: '100%' }}>
          Отмена
        </button>
      )}

      <style>{`
        .pin-screen {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--space-xl);
          background: var(--bg-primary);
          gap: var(--space-lg);
        }
        .pin-header { text-align: center; }
        .pin-logo { font-size: 48px; color: var(--accent-primary); margin-bottom: var(--space-sm); }
        .pin-title { font-family: var(--font-display); font-size: 22px; font-weight: 700; margin: 0 0 6px; }
        .pin-subtitle { font-size: 14px; color: var(--text-muted); margin: 0; }

        .pin-dots {
          display: flex;
          gap: 16px;
        }
        .pin-dots.shake {
          animation: pinShake 0.5s ease;
        }
        .pin-dot {
          width: 18px; height: 18px;
          border-radius: 50%;
          border: 2px solid var(--border-default);
          background: transparent;
          transition: all 0.15s ease;
        }
        .pin-dot.filled {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
          transform: scale(1.1);
        }
        .pin-dot.error {
          border-color: var(--accent-danger);
          background: var(--accent-danger);
        }

        .pin-error {
          font-size: 13px;
          color: var(--accent-danger);
          text-align: center;
          min-height: 20px;
        }

        .pin-keypad {
          display: grid;
          grid-template-columns: repeat(3, 72px);
          gap: 14px;
        }
        .pin-key {
          width: 72px; height: 72px;
          border-radius: 50%;
          border: 1.5px solid var(--border-default);
          background: var(--bg-elevated);
          color: var(--text-primary);
          font-size: 24px;
          font-weight: 600;
          font-family: var(--font-display);
          cursor: pointer;
          transition: all 0.12s ease;
          display: flex; align-items: center; justify-content: center;
        }
        .pin-key:hover:not(:disabled) {
          background: var(--bg-hover);
          border-color: var(--accent-primary);
          transform: scale(1.05);
        }
        .pin-key:active:not(:disabled) {
          transform: scale(0.95);
          background: var(--accent-primary);
          color: white;
        }
        .pin-key:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .pin-key-action {
          background: transparent;
          border-color: transparent;
          color: var(--text-secondary);
        }
        .pin-key-action:hover {
          background: var(--bg-elevated) !important;
          border-color: transparent !important;
        }

        @keyframes pinShake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}
