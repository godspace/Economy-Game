import { state, dom, cache, shouldUpdate, markUpdated } from './config.js';

export async function loadTopRanking(forceRefresh = false) {
    try {
        if (!state.supabase) {
            console.error('Supabase not initialized');
            return;
        }
        
        // Проверка кэша и необходимости обновления
        const now = Date.now();
        if (!forceRefresh && cache.topRanking.data && 
            (now - cache.topRanking.timestamp < cache.topRanking.ttl) &&
            shouldUpdate('topRanking')) {
            renderTopRanking(cache.topRanking.data);
            return;
        }
        
        console.log('Loading top ranking data...');
        
        const { data: users, error } = await state.supabase
            .from('profiles')
            .select('id, username, class, coins, reputation')
            .order('coins', { ascending: false })
            .limit(10);
        
        if (error) {
            console.error('Ошибка загрузки топа рейтинга:', error);
            // Показываем сообщение об ошибке, если таблица видима
            if (dom.topRankingTable && dom.topRankingTable.closest('.tab-content.active')) {
                renderTopRankingError('Не удалось загрузить рейтинг');
            }
            return;
        }
        
        // Сохраняем в кэш
        cache.topRanking.data = users;
        cache.topRanking.timestamp = now;
        markUpdated('topRanking');
        
        renderTopRanking(users);
    } catch (error) {
        console.error('Ошибка загрузки топа рейтинга:', error);
        if (dom.topRankingTable && dom.topRankingTable.closest('.tab-content.active')) {
            renderTopRankingError('Ошибка при загрузке данных');
        }
    }
}

function renderTopRanking(users) {
    if (!dom.topRankingTable) {
        console.warn('Top ranking table element not found');
        return;
    }
    
    try {
        dom.topRankingTable.innerHTML = '';
        
        if (!users || users.length === 0) {
            renderEmptyTopRanking();
            return;
        }
        
        const fragment = document.createDocumentFragment();
        
        users.forEach((user, index) => {
            const row = document.createElement('tr');
            
            // Добавляем класс для текущего пользователя
            if (state.currentUserProfile && user.id === state.currentUserProfile.id) {
                row.classList.add('current-user');
            }
            
            // Добавляем классы для первых трех мест
            if (index === 0) row.classList.add('first-place');
            if (index === 1) row.classList.add('second-place');
            if (index === 2) row.classList.add('third-place');
            
            row.innerHTML = `
                <td>
                    ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                </td>
                <td>
                    ${user.username}
                    ${state.currentUserProfile && user.id === state.currentUserProfile.id ? '<span class="you-badge">(Вы)</span>' : ''}
                </td>
                <td>${user.class || 'Не указан'}</td>
                <td class="coins-cell">${user.coins} <i class="fas fa-coins"></i></td>
                <td class="reputation-cell">${user.reputation} <i class="fas fa-star"></i></td>
            `;
            
            fragment.appendChild(row);
        });
        
        dom.topRankingTable.appendChild(fragment);
    } catch (error) {
        console.error('Ошибка рендеринга топа рейтинга:', error);
        renderTopRankingError('Ошибка отображения данных');
    }
}

function renderEmptyTopRanking() {
    if (!dom.topRankingTable) return;
    
    dom.topRankingTable.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center; padding: 40px 20px;">
                <div class="empty-state">
                    <i class="fas fa-trophy" style="font-size: 3rem; color: #ccc; margin-bottom: 15px;"></i>
                    <h3 style="margin: 0 0 10px 0; color: #666;">Рейтинг пуст</h3>
                    <p style="margin: 0; color: #888;">Еще нет данных для отображения рейтинга</p>
                </div>
            </td>
        </tr>
    `;
}

function renderTopRankingError(message) {
    if (!dom.topRankingTable) return;
    
    dom.topRankingTable.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center; padding: 40px 20px;">
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ff6b6b; margin-bottom: 15px;"></i>
                    <h3 style="margin: 0 0 10px 0; color: #666;">Ошибка загрузки</h3>
                    <p style="margin: 0; color: #888;">${message}</p>
                    <button onclick="loadTopRanking(true)" class="btn-outline" style="margin-top: 15px;">
                        <i class="fas fa-redo"></i> Попробовать снова
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// Функция для автоматического обновления топа рейтинга
let topRankingInterval = null;

export function startTopRankingAutoRefresh(interval = 60000) { // 1 минута по умолчанию
    stopTopRankingAutoRefresh();
    
    topRankingInterval = setInterval(() => {
        // Обновляем только если таб с рейтингом активен
        const rankingTab = document.getElementById('rankingTab');
        if (rankingTab && rankingTab.classList.contains('active')) {
            loadTopRanking(true);
        }
    }, interval);
}

export function stopTopRankingAutoRefresh() {
    if (topRankingInterval) {
        clearInterval(topRankingInterval);
        topRankingInterval = null;
    }
}

// Функция для загрузки расширенной статистики
export async function loadExtendedStats() {
    try {
        if (!state.supabase || !state.currentUserProfile) {
            return null;
        }
        
        const [userRankResult, totalUsersResult, dailyDealsResult] = await Promise.all([
            // Ранг пользователя
            state.supabase
                .from('profiles')
                .select('id')
                .gt('coins', state.currentUserProfile.coins)
                .then(({ count }) => ({ rank: count + 1 })),
            
            // Общее количество пользователей
            state.supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true }),
            
            // Количество сделок за сегодня
            state.supabase
                .from('deals')
                .select('id', { count: 'exact', head: true })
                .or(`from_user.eq.${state.currentUserProfile.id},to_user.eq.${state.currentUserProfile.id}`)
                .gte('created_at', new Date().toISOString().split('T')[0])
        ]);
        
        return {
            userRank: userRankResult.rank,
            totalUsers: totalUsersResult.count,
            dailyDeals: dailyDealsResult.count
        };
    } catch (error) {
        console.error('Ошибка загрузки расширенной статистики:', error);
        return null;
    }
}

// Re-export функций из других модулей для удобства
export { loadUsers } from './users.js';
export { loadDeals, loadRanking } from './deals.js';
export { loadInvestments } from './investments.js';

// Экспортируем для глобального использования
window.loadTopRanking = loadTopRanking;