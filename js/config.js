// config.js - исправленная конфигурация Supabase
const SUPABASE_URL = 'https://cqyairjaorjtviyfljor.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxeWFpcmphb3JqdHZpeWZsam9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDEwNDQyNDcsImV4cCI6MjAxNjYyMDI0N30.m8SYcRZ_KeVW4Ix0Yk4H-gA4q1y3a9YjzY9vJ2Yz4dA';

// Проверяем, что Supabase библиотека загружена
if (typeof window.supabase === 'undefined') {
    console.error('Supabase библиотека не загружена');
} else {
    // Инициализация Supabase клиента
    try {
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false
            },
            global: {
                headers: {
                    'Accept': 'application/json',
                    'apikey': SUPABASE_ANON_KEY
                }
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
            SESSION_TIMEOUT: 30 * 60 * 1000
        };

        // Экспорт
        window.SUPABASE = supabase;
        window.MATERIAL_COLORS = MATERIAL_COLORS;
        window.GAME_CONFIG = GAME_CONFIG;
        
        console.log('Supabase успешно инициализирован');

    } catch (error) {
        console.error('Ошибка инициализации Supabase:', error);
    }
}