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

/**
 * Score voices by preference. Higher = better.
 * Prefers macOS premium voices «Milena», «Katya» and falls back to any ru-RU.
 */
function scoreVoice(v: SpeechSynthesisVoice, lang: string): number {
    let score = 0;
    if (v.lang === lang) score += 10;
    else if (v.lang.startsWith(lang.split('-')[0])) score += 5;

    const name = v.name.toLowerCase();
    // macOS premium Russian female voices
    if (/milena|katya|victoria|viktoria|irina|alice|alena|oksana/.test(name)) score += 20;
    // Generic female boost
    if (/female|женск/.test(name)) score += 8;
    // Neural / Enhanced voices sound much better
    if (/neural|enhanced|premium|natural/.test(name)) score += 15;
    // Penalise obviously bad voices
    if (/compact|junior|novelty|zarvox|whisper|bad|trinoids/.test(name)) score -= 20;

    return score;
}

let _preferredVoiceName: string | undefined;

export function setPreferredVoice(name: string | undefined): void {
    _preferredVoiceName = name;
}

function getBestVoice(lang: string): SpeechSynthesisVoice | undefined {
    const voices = voicesLoaded ? cachedVoices : window.speechSynthesis.getVoices();
    // If user picked a specific voice, use it
    if (_preferredVoiceName) {
        const picked = voices.find(v => v.name === _preferredVoiceName);
        if (picked) return picked;
    }
    const langStart = lang.split('-')[0];
    const candidates = voices.filter(v => v.lang.startsWith(langStart) || v.lang === lang);
    if (candidates.length === 0) return undefined;
    return candidates.sort((a, b) => scoreVoice(b, lang) - scoreVoice(a, lang))[0];
}

/**
 * Pre-process text for more natural delivery:
 * - Trim markdown artifacts
 * - Ensure proper spacing around punctuation
 * - Insert micro-pauses by splitting at sentence boundaries
 */
function preprocessText(raw: string): string[] {
    // Remove markdown bold/italic markers, code blocks, urls
    let text = raw
        .replace(/```[\s\S]*?```/g, '')    // code blocks
        .replace(/`[^`]+`/g, '')           // inline code
        .replace(/\*\*(.+?)\*\*/g, '$1')  // bold
        .replace(/\*(.+?)\*/g, '$1')      // italic
        .replace(/#+\s/g, '')              // headings
        .replace(/\[(.+?)\]\(.+?\)/g, '$1') // links → text only
        .replace(/https?:\/\/\S+/g, '')    // bare URLs
        .trim();

    // Split into sentences for natural pacing (each gets its own utterance)
    const sentences = text
        .split(/(?<=[.!?…])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

    return sentences.length > 0 ? sentences : [text];
}

/**
 * Speak a list of sentences sequentially with a small pause between them.
 * This is the core of the natural-sounding experience.
 */
function speakSequential(
    sentences: string[],
    options: { speed: number; pitch: number; lang: string },
    onEnd?: () => void,
    index = 0
): void {
    if (index >= sentences.length) {
        isSpeaking = false;
        onEnd?.();
        return;
    }

    const utterance = new SpeechSynthesisUtterance(sentences[index]);
    utterance.lang = options.lang;
    utterance.rate = options.speed;
    utterance.pitch = options.pitch;
    utterance.volume = 1;

    const voice = getBestVoice(options.lang);
    if (voice) utterance.voice = voice;

    const isLast = index === sentences.length - 1;

    utterance.onend = () => {
        if (isLast) {
            isSpeaking = false;
            onEnd?.();
        } else {
            // Natural pause between sentences: ~300ms
            setTimeout(() => {
                speakSequential(sentences, options, onEnd, index + 1);
            }, 280);
        }
    };
    utterance.onerror = (e) => {
        // Skip failed sentence, continue with next
        console.warn('TTS error on sentence', index, e.error);
        speakSequential(sentences, options, onEnd, index + 1);
    };

    window.speechSynthesis.speak(utterance);
}

export function speak(
    text: string,
    options: { speed?: number; pitch?: number; lang?: string } = {},
    onEnd?: () => void
): void {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const lang = options.lang ?? 'ru-RU';
    // Rate 0.87 sounds noticeably more human than 1.0
    const speed = Math.max(0.5, Math.min(2, options.speed ?? 0.87));
    // Slightly higher pitch for a warmer female-ish tone
    const pitch = Math.max(0.5, Math.min(2, options.pitch ?? 1.1));

    const sentences = preprocessText(text);
    isSpeaking = true;
    speakSequential(sentences, { speed, pitch, lang }, onEnd);
}

/**
 * ARCA-specific speak: calm, confident, slightly slower
 */
export function speakARCA(
    text: string,
    speed = 0.85,
    lang = 'ru-RU',
    onEnd?: () => void
): void {
    speak(text, { speed, pitch: 1.08, lang }, onEnd);
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

/**
 * Returns a sorted list of all available voices for the given language,
 * useful for letting the user pick their preferred voice in Settings.
 */
export function getAvailableVoices(lang = 'ru'): SpeechSynthesisVoice[] {
    const voices = voicesLoaded ? cachedVoices : window.speechSynthesis.getVoices();
    return voices
        .filter(v => v.lang.startsWith(lang))
        .sort((a, b) => scoreVoice(b, lang + '-RU') - scoreVoice(a, lang + '-RU'));
}
