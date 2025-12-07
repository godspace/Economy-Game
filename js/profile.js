// Проверяем загрузку Supabase
document.addEventListener('DOMContentLoaded', function() {
    // Ждем немного для загрузки Supabase
    setTimeout(initProfile, 100);
});

function initProfile() {
    // Проверяем авторизацию
    const playerData = sessionStorage.getItem('player');
    if (!playerData) {
        window.location.href = 'index.html';
        return;
    }

    if (!window.gameSupabase) {
        console.error('Supabase не загружен');
        return;
    }

    const supabase = window.gameSupabase;
    const player = JSON.parse(playerData);
    
    // Обновляем UI
    updateUI(player);
    
    // Загружаем список игроков
    loadPlayersList(supabase, player);
    
    // Настраиваем кнопку выхода
    document.getElementById('logoutBtn').addEventListener('click', function() {
        sessionStorage.removeItem('player');
        window.location.href = 'index.html';
    });
    
    // Защита от изменения через консоль
    setupConsoleProtection(player);
}

function updateUI(player) {
    // Устанавливаем имя
    document.getElementById('playerName').textContent = 
        `${player.first_name} ${player.last_name}`;
    
    // Класс
    document.getElementById('playerClass').textContent = player.class;
    
    // Код
    document.getElementById('playerCode').textContent = player.code;
    
    // Баланс
    document.getElementById('balanceValue').textContent = player.balance;
    
    // Инициалы для аватара
    const initials = (player.first_name[0] + player.last_name[0]).toUpperCase();
    document.getElementById('avatarInitials').textContent = initials;
}

async function loadPlayersList(supabase, currentPlayer) {
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '<div class="loading">Загрузка списка игроков...</div>';
    
    try {
        // Загружаем только видимых игроков, исключая текущего
        const { data: players, error } = await supabase
            .from('players')
            .select('id, first_name, last_name, class, balance')
            .eq('is_visible', true)
            .neq('id', currentPlayer.id)
            .order('last_login', { ascending: false });
        
        if (error) throw error;
        
        if (!players || players.length === 0) {
            playersList.innerHTML = '<div class="loading">Пока нет других игроков...</div>';
            return;
        }
        
        // Генерируем HTML для списка игроков
        playersList.innerHTML = players.map(p => `
            <div class="player-item">
                <div class="player-item-avatar">
                    ${p.first_name[0]}${p.last_name[0]}
                </div>
                <div class="player-item-info">
                    <h4>${p.first_name} ${p.last_name}</h4>
                    <div class="player-item-class">${p.class} • ${p.balance || 0} монет</div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading players:', error);
        playersList.innerHTML = 
            '<div class="error-message">Не удалось загрузить список игроков</div>';
    }
}

function setupConsoleProtection(player) {
    // Защита от изменения sessionStorage
    const originalSetItem = sessionStorage.setItem;
    sessionStorage.setItem = function(key, value) {
        if (key === 'player') {
            console.warn('Изменение данных игрока через консоль заблокировано!');
            return false;
        }
        return originalSetItem.apply(this, arguments);
    };
    
    // Защита от открытия DevTools (необязательно, можно закомментировать)
    /*
    document.addEventListener('keydown', function(e) {
        if (e.keyCode === 123 || 
            (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) ||
            (e.ctrlKey && e.keyCode === 85)) {
            e.preventDefault();
            return false;
        }
    });
    */
}