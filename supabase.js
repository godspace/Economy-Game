// Конфигурация Supabase
const SUPABASE_URL = 'https://oitjuzgvjqpprnhrzfvb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pdGp1emd2anFwcHJuaHJ6ZnZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MTc1MjEsImV4cCI6MjA4MTI5MzUyMX0.ICc5rwbtrU_-S-xnNvdhP-XAzZNMajzdA8M5SIZd60w';

// Инициализация клиента Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Хэширование для конфиденциальности
async function hashCode(code) {
    const encoder = new TextEncoder();
    const data = encoder.encode(code + 'game-salt-2024'); // Добавляем соль для безопасности
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Генерация сессионного токена
function generateSessionToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// Проверка сессии
async function checkSession() {
    const token = localStorage.getItem('session_token');
    if (!token) return null;
    
    const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('session_token', token)
        .gt('session_expiry', new Date().toISOString())
        .single();
    
    if (error || !data) {
        localStorage.removeItem('session_token');
        return null;
    }
    
    // Обновляем время активности
    await supabase
        .from('players')
        .update({ last_active: new Date().toISOString() })
        .eq('id', data.id);
    
    return data;
}

// Защита от автокликов
let lastClickTime = 0;
const CLICK_DELAY = 1000; // 1 секунда между действиями

function isRateLimited() {
    const now = Date.now();
    if (now - lastClickTime < CLICK_DELAY) {
        return true;
    }
    lastClickTime = now;
    return false;
}

// Валидация ввода
function validateCode(code) {
    return /^\d{6}$/.test(code);
}

// Аудит действий для защиты от читов
async function logAuditAction(playerId, action, oldCoins, newCoins) {
    const ipHash = await hashCode(navigator.userAgent + Math.random());
    
    await supabase.from('audit_log').insert({
        player_id: playerId,
        action: action,
        old_coins: oldCoins,
        new_coins: newCoins,
        ip_hash: ipHash,
        user_agent_hash: await hashCode(navigator.userAgent)
    });
}