import { supabaseClient, currentUser, topRankingTable } from './config.js';
import { loadRanking } from './deals.js';

export async function loadTopRanking() {
    try {
        if (!supabaseClient) {
            console.error('Supabase not initialized');
            return;
        }
        
        const { data: users, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .order('coins', { ascending: false })
            .limit(10);
        
        if (error) {
            console.error('Ошибка загрузки топа рейтинга:', error);
            return;
        }
        
        if (topRankingTable) {
            topRankingTable.innerHTML = '';
            
            if (users.length === 0) {
                topRankingTable.innerHTML = `
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
                users.forEach((user, index) => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${index + 1}</td>
                        <td>${user.username}</td>
                        <td>${user.class}</td>
                        <td>${user.coins}</td>
                        <td>${user.reputation}</td>
                    `;
                    topRankingTable.appendChild(row);
                });
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки топа рейтинга:', error);
    }
}

// Re-export функций из других модулей для удобства
export { loadUsers } from './users.js';
export { loadDeals, loadRanking } from './deals.js';
export { loadInvestments } from './investments.js';