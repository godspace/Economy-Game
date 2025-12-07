// Проверяем, что Supabase загружен
if (typeof window.supabase !== 'undefined') {
    try {
        const { createClient } = window.supabase;
        
        const SUPABASE_URL = 'https://iuchpmkpvkihsekiunkq.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1Y2hwbWtwdmtpaHNla2l1bmtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMDY3OTAsImV4cCI6MjA4MDY4Mjc5MH0.cMeIaZ9rqDx8Mjt7aIz81bgGU2_k8_HfCEDU_35jOik';

        // Создаем клиент с правильными заголовками
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            db: {
                schema: 'public'
            },
            auth: {
                persistSession: false
            },
            global: {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        });
        
        // Экспортируем глобально
        window.gameSupabase = supabase;
        console.log('Supabase клиент инициализирован успешно');
        
    } catch (error) {
        console.error('Ошибка инициализации Supabase:', error);
    }
} else {
    console.error('Supabase CDN не загружен');
    document.addEventListener('DOMContentLoaded', function() {
        alert('Ошибка загрузки системы. Обновите страницу.');
    });
}