// eslint-disable-next-line @typescript-eslint/no-explicit-any
let recognition: any = null;
let isSpeaking = false;
let voicesLoaded = false;
let cachedVoices: SpeechSynthesisVoice[] = [];

// Pre-load voices as soon as possible (Chrome requires this)
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const loadVoices = () => {
        cachedVoices = window.speechSynthesis.getVoices();
        voicesLoaded = cachedVoices.length > 0;
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
}

export function isSTTSupported(): boolean {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

export function isTTSSupported(): boolean {
    return 'speechSynthesis' in window;
}

export function isSpeakingNow(): boolean {
    return isSpeaking;
}

function getBestVoice(lang: string): SpeechSynthesisVoice | undefined {
    const voices = voicesLoaded ? cachedVoices : window.speechSynthesis.getVoices();

    // Priority: exact lang female, exact lang any, any Russian, fallback
    if (lang.startsWith('ru')) {
        return (
            voices.find(v => v.lang.startsWith('ru') && /female|женск|milena|katya|viktoria|irina/i.test(v.name)) ||
            voices.find(v => v.lang === 'ru-RU') ||
            voices.find(v => v.lang.startsWith('ru'))
        );
    }
    return (
        voices.find(v => v.lang === lang && /female/i.test(v.name)) ||
        voices.find(v => v.lang === lang) ||
        voices.find(v => v.lang.startsWith(lang.split('-')[0]))
    );
}

export function speak(
    text: string,
    options: { speed?: number; pitch?: number; lang?: string } = {},
    onEnd?: () => void
): void {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const lang = options.lang ?? 'ru-RU';
    utterance.lang = lang;
    utterance.rate = Math.max(0.5, Math.min(2, options.speed ?? 1.0));
    utterance.pitch = Math.max(0.5, Math.min(2, options.pitch ?? 1.05));

    const voice = getBestVoice(lang);
    if (voice) utterance.voice = voice;

    isSpeaking = true;
    utterance.onend = () => { isSpeaking = false; onEnd?.(); };
    utterance.onerror = () => { isSpeaking = false; onEnd?.(); };

    // Chrome bug: long utterances get cut off — split at sentence boundaries
    window.speechSynthesis.speak(utterance);

    // Keep-alive hack for Chrome (cancels silence bug)
    const keepAlive = setInterval(() => {
        if (!window.speechSynthesis.speaking) { clearInterval(keepAlive); return; }
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
    }, 10000);
    utterance.onend = () => { isSpeaking = false; clearInterval(keepAlive); onEnd?.(); };
    utterance.onerror = () => { isSpeaking = false; clearInterval(keepAlive); onEnd?.(); };
}

/**
 * ARCA-specific speak: slightly slower, deeper, more authoritative
 */
export function speakARCA(
    text: string,
    speed = 0.95,
    lang = 'ru-RU',
    onEnd?: () => void
): void {
    speak(text, { speed, pitch: 1.0, lang }, onEnd);
}

export function stopSpeaking(): void {
    window.speechSynthesis?.cancel();
    isSpeaking = false;
}

export function startListening(
    onResult: (text: string) => void,
    onError: (err: string) => void,
    language = 'ru-RU'
): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { onError('STT не поддерживается'); return; }

    recognition = new SR();
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const text = event.results[0][0].transcript;
        onResult(text);
    };
    recognition.onerror = (event: any) => { onError(event.error); }; // eslint-disable-line @typescript-eslint/no-explicit-any
    recognition.start();
}

export function stopListening(): void {
    recognition?.stop();
}
