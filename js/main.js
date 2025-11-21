import { initDOMElements, setupEventListeners, showLoading, hideLoading, showError } from './ui.js';
import { initSupabase, checkAuth } from './auth.js';
import { loadTopRanking } from './data.js';

async function initApp() {
    try {
        console.log('Starting app initialization...');
        
        // Сначала инициализируем DOM элементы
        initDOMElements();
        
        // Показываем сообщение о загрузке
        showLoading();
        
        // Затем инициализируем Supabase
        await initSupabase();
        
        // Настройка обработчиков событий
        setupEventListeners();
        
        // Загружаем топ рейтинга для страницы авторизации
        await loadTopRanking();
        
        // Проверка авторизации
        await checkAuth();
        
        // Скрываем сообщение о загрузке
        hideLoading();
        
        console.log('App initialized successfully');
        
    } catch (error) {
        console.error('Error initializing app:', error);
        showError('Не удалось загрузить приложение: ' + error.message);
    }
}

// Запуск приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    // Даем время для загрузки всех скриптов
    setTimeout(initApp, 100);
});