import { state, dom, cache, shouldUpdate, markUpdated } from './config.js';

export async function loadTopRanking(forceRefresh = false) {
    try {
        if (!state.supabase) {
            console.error('Supabase not initialized');
            return;
        }
        
        // Проверка кэша
        const now = Date.now();
        if (!forceRefresh && cache.topRanking.data && 
            (now - cache.topRanking.timestamp < cache.topRanking.ttl)) {
            renderTopRanking(cache.topRanking.data);
            return;
        }
        
        const { data: users, error } = await state.supabase
            .from('profiles')
            .select('id, username, class, coins, reputation')
            .order('coins', { ascending: false })
            .limit(10);
        
        if (error) {
            console.error('Ошибка загрузки топа рейтинга:', error);
            return;
        }
        
        // Сохраняем в кэш
        cache.topRanking.data = users;
        cache.topRanking.timestamp = now;
        markUpdated('topRanking');
        
        renderTopRanking(users);
    } catch (error) {
        console.error('Ошибка загрузки топа рейтинга:', error);
    }
}

function renderTopRanking(users) {
    if (!dom.topRankingTable) return;
    
    dom.topRankingTable.innerHTML = '';
    
    if (users.length === 0) {
        dom.topRankingTable.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 20px;">
                    <div class="empty-state">
                        <i class="fas fa-trophy"></i>
                        <p>Нет данных для рейтинга</p>
                    </div>
                </td>
            </tr>
        `;
    } else {
        // Используем DocumentFragment для оптимизации рендеринга
        const fragment = document.createDocumentFragment();
        
        users.forEach((user, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${user.username}</td>
                <td>${user.class}</td>
                <td>${user.coins}</td>
                <td>${user.reputation}</td>
            `;
            fragment.appendChild(row);
        });
        
        dom.topRankingTable.appendChild(fragment);
    }
}

// Re-export функций из других модулей для удобства
export { loadUsers } from './users.js';
export { loadDeals, loadRanking } from './deals.js';
export { loadInvestments } from './investments.js';