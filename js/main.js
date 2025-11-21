import { initDOMElements, setupEventListeners, showLoading, hideLoading, showError } from './ui.js';
import { initSupabase, checkAuth } from './auth.js';
import { loadTopRanking } from './data.js';

async function initApp() {
    try {
        console.log('Starting app initialization...');
        
        initDOMElements();
        showLoading();
        await initSupabase();
        setupEventListeners();
        await loadTopRanking();
        await checkAuth();
        hideLoading();
        
        console.log('App initialized successfully');
        
    } catch (error) {
        console.error('Error initializing app:', error);
        showError('Не удалось загрузить приложение: ' + error.message);
    }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initApp, 100);
});