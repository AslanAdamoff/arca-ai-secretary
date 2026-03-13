// eslint-disable-next-line @typescript-eslint/no-explicit-any
let recognition: any = null;

export function isSTTSupported(): boolean {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

export function isTTSSupported(): boolean {
    return 'speechSynthesis' in window;
}

export function startListening(
    onResult: (text: string) => void,
    onError: (err: string) => void,
    language: string = 'ru-RU'
): void {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { onError('STT не поддерживается'); return; }

    recognition = new SR();
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        onResult(text);
    };
    recognition.onerror = (event: any) => {
        onError(event.error);
    };
    recognition.start();
}

export function stopListening(): void {
    recognition?.stop();
}

export function speak(
    text: string,
    options: { speed?: number; pitch?: number; lang?: string } = {}
): void {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang ?? 'ru-RU';
    utterance.rate = options.speed ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;

    // Pick a female Russian voice if available
    const voices = window.speechSynthesis.getVoices();
    const ruVoice = voices.find(v => v.lang.startsWith('ru') && v.name.toLowerCase().includes('female'))
        || voices.find(v => v.lang.startsWith('ru'));
    if (ruVoice) utterance.voice = ruVoice;

    window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
    window.speechSynthesis?.cancel();
}
