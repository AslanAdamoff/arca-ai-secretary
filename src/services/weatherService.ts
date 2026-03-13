export interface WeatherData {
    temperature: number;
    feelsLike: number;
    description: string;
    icon: string; // emoji
    city?: string;
}

const WMO_CODES: Record<number, { desc: string; icon: string }> = {
    0: { desc: 'Ясно', icon: '☀️' },
    1: { desc: 'Преимущественно ясно', icon: '🌤️' },
    2: { desc: 'Переменная облачность', icon: '⛅' },
    3: { desc: 'Пасмурно', icon: '☁️' },
    45: { desc: 'Туман', icon: '🌫️' },
    48: { desc: 'Иней', icon: '🌫️' },
    51: { desc: 'Лёгкая морось', icon: '🌦️' },
    53: { desc: 'Морось', icon: '🌦️' },
    55: { desc: 'Сильная морось', icon: '🌧️' },
    61: { desc: 'Лёгкий дождь', icon: '🌦️' },
    63: { desc: 'Дождь', icon: '🌧️' },
    65: { desc: 'Сильный дождь', icon: '🌧️' },
    71: { desc: 'Лёгкий снег', icon: '🌨️' },
    73: { desc: 'Снег', icon: '❄️' },
    75: { desc: 'Сильный снег', icon: '❄️' },
    80: { desc: 'Ливень', icon: '🌧️' },
    81: { desc: 'Сильный ливень', icon: '⛈️' },
    95: { desc: 'Гроза', icon: '⛈️' },
    96: { desc: 'Гроза с градом', icon: '⛈️' },
    99: { desc: 'Сильная гроза', icon: '🌩️' },
};

function getWMO(code: number): { desc: string; icon: string } {
    return WMO_CODES[code] ?? { desc: 'Неизвестно', icon: '🌡️' };
}

async function getCoords(): Promise<{ lat: number; lon: number }> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) { reject(new Error('Геолокация недоступна')); return; }
        navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            () => resolve({ lat: 41.0, lon: 28.9 }), // fallback: Istanbul-ish
            { timeout: 5000 }
        );
    });
}

export async function getWeather(): Promise<WeatherData> {
    const { lat, lon } = await getCoords();

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,apparent_temperature,weathercode` +
        `&timezone=auto&forecast_days=1`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather API error');
    const data = await res.json();

    const code = data.current.weathercode as number;
    const { desc, icon } = getWMO(code);

    return {
        temperature: Math.round(data.current.temperature_2m),
        feelsLike: Math.round(data.current.apparent_temperature),
        description: desc,
        icon,
    };
}
