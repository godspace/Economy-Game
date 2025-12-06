// config.js - конфигурация Supabase
const SUPABASE_URL = 'https://cqyairjaorjtviyfljor.supabase.co'; // Замените на ваш URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxeWFpcmphb3JqdHZpeWZsam9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwNDgyNTIsImV4cCI6MjA4MDYyNDI1Mn0.2vf0fHS4N6fubaW1eKfc0eg6JDqarB0AmH4uLRP1mx4'; // Замените на ваш ключ

// Проверка домена (для production)
const ALLOWED_DOMAINS = [
    'https://godspace.github.io/Economy-Game/',
    'localhost'
];

// Проверяем текущий домен
const CURRENT_DOMAIN = window.location.hostname;
if (!ALLOWED_DOMAINS.includes(CURRENT_DOMAIN) && !CURRENT_DOMAIN.includes('localhost')) {
    console.warn('Домен не разрешен для этого приложения');
}

// Инициализация Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
    }
});

// Цветовая палитра Material Design
const MATERIAL_COLORS = [
    '#FF5252', '#FF4081', '#E040FB', '#7C4DFF', '#536DFE',
    '#448AFF', '#40C4FF', '#18FFFF', '#64FFDA', '#69F0AE',
    '#B2FF59', '#EEFF41', '#FFFF00', '#FFD740', '#FFAB40',
    '#FF6E40', '#FF3D00', '#795548', '#9E9E9E', '#607D8B'
];

// Константы игры
const GAME_CONFIG = {
    MAX_DEALS_PER_PLAYER: 5,
    COINS: {
        BOTH_COOPERATE: 2,
        ONE_CHEAT: { CHEATER: 3, VICTIM: -1 },
        BOTH_CHEAT: -1
    },
    RATE_LIMIT_MS: 2000,
    ITEMS: {
        BAUNTY: { name: 'Baunty', price: 99 }
    },
    SESSION_TIMEOUT: 30 * 60 * 1000 // 30 минут
};

// Защита от инспектирования
if (typeof window !== 'undefined') {
    // Блокировка консоли в production (опционально)
    if (!window.location.hostname.includes('localhost')) {
        console.log('%c⚠️ Внимание!', 'color: red; font-size: 20px; font-weight: bold;');
        console.log('%cЭта часть браузера предназначена для разработчиков.', 'font-size: 14px;');
        console.log('%cНе вводите здесь никакой код, который вам незнаком.', 'font-size: 14px; color: red;');
    }
    
    // Защита от копирования (базовая)
    document.addEventListener('copy', (e) => {
        if (!e.target.closest('.allow-copy')) {
            e.preventDefault();
        }
    });
}

// Экспорт
window.SUPABASE = supabase;
window.MATERIAL_COLORS = MATERIAL_COLORS;
window.GAME_CONFIG = GAME_CONFIG;