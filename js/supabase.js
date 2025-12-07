// Используем глобальную переменную supabase из CDN
if (typeof window.supabase !== 'undefined') {
    const { createClient } = window.supabase;
    
    const SUPABASE_URL = 'https://iuchpmkpvkihsekiunkq.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1Y2hwbWtwdmtpaHNla2l1bmtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMDY3OTAsImV4cCI6MjA4MDY4Mjc5MH0.cMeIaZ9rqDx8Mjt7aIz81bgGU2_k8_HfCEDU_35jOik';

    // Создаем клиент Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Экспортируем глобально для использования в других файлах
    window.gameSupabase = supabase;
    console.log('Supabase клиент инициализирован');
} else {
    console.error('Supabase не загружен. Проверьте подключение CDN.');
}