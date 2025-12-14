// game.js

// --- КОНФИГУРАЦИЯ ---
const SUPABASE_URL = 'https://ferhcoqknnobeesscvdv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlcmhjb3Frbm5vYmVlc3NjdmR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MjQ0NDUsImV4cCI6MjA4MTMwMDQ0NX0.pJB2oBN9Asp8mO0Od1lHD6sRjr-swoaJu5Z-ZJvw9jA';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 2. СОСТОЯНИЕ (ПЕРЕМЕННЫЕ) ---
let myId = localStorage.getItem('santa_id');
let myClass = localStorage.getItem('santa_class');
let currentTargetId = null;
let respondingToDealId = null;

// Глобальное хранилище моих сделок (кэш для быстрого доступа)
let myDealsHistory = []; 

// --- 3. ИНИЦИАЛИЗАЦИЯ ---
document.addEventListener('DOMContentLoaded', () => {
    createSnow();
    
    // Проверяем, вошел ли игрок
    if (myId) {
        showGameScreen();
        startGameLoop(); // Запускаем обновления
    } else {
        // Если не вошел - показываем топ-10 на входе
        loadLeaderboard(10, 'login-leaderboard');
    }

    // Привязываем кнопку входа
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) loginBtn.addEventListener('click', login);
});

// --- 4. АВТОРИЗАЦИЯ И ВЫХОД ---

async function login() {
    const code = document.getElementById('access-code').value;
    const btn = document.getElementById('login-btn');
    const err = document.getElementById('login-error');

    btn.disabled = true; btn.innerText = "Проверка..."; err.classList.add('hidden');

    // Вызываем RPC функцию входа
    const { data, error } = await supabase.rpc('login_player', { input_code: code });

    if (error || (data && data.error)) {
        err.innerText = error ? error.message : data.error;
        err.classList.remove('hidden');
        btn.disabled = false; btn.innerText = "ВОЙТИ В ИГРУ";
    } else {
        // Успех
        myId = data.player_id;
        localStorage.setItem('santa_id', myId);
        localStorage.setItem('santa_class', data.class);
        location.reload(); 
    }
}

// НОВАЯ ФУНКЦИЯ: Выход из системы
window.logout = function() {
    if (confirm("Вы действительно хотите выйти из профиля?")) {
        localStorage.removeItem('santa_id');
        localStorage.removeItem('santa_class');
        location.reload();
    }
};

function showGameScreen() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('my-class').innerText = myClass || 'Elf';
}

// --- 5. УПРАВЛЕНИЕ ВКЛАДКАМИ ---
window.switchTab = function(tabName) {
    // Скрываем все вкладки
    ['game', 'history', 'rating'].forEach(t => {
        document.getElementById(`tab-content-${t}`).classList.add('hidden');
        document.getElementById(`tab-btn-${t}`).classList.remove('active');
    });

    // Показываем выбранную
    document.getElementById(`tab-content-${tabName}`).classList.remove('hidden');
    document.getElementById(`tab-btn-${tabName}`).classList.add('active');

    // Подгрузка данных при переключении
    if (tabName === 'rating') loadLeaderboard(50, 'main-leaderboard');
    if (tabName === 'history') renderHistoryTab();
};

// --- 6. ГЛАВНЫЙ ЦИКЛ ОБНОВЛЕНИЯ ---
function startGameLoop() {
    fetchAllMyDeals(); // Грузим историю сразу
    updateMyStats();   // Грузим баланс сразу
    
    // Обновляем данные каждые 3 секунды
    setInterval(() => {
        fetchAllMyDeals(); 
        updateMyStats();
    }, 3000);
}

// А. Загрузка ВСЕХ сделок (через защищенную RPC функцию)
async function fetchAllMyDeals() {
    // Используем RPC 'get_my_deals', чтобы обойти RLS и увидеть входящие
    const { data: deals, error } = await supabase.rpc('get_my_deals', { 
        player_uuid: myId 
    });

    if (error) {
        console.error("Ошибка обновления сделок:", error);
        return;
    }

    if (deals) {
        myDealsHistory = deals;
        // После получения данных обновляем зависимые части интерфейса
        checkIncomingDeals();     
        refreshPlayersForDeals(); 
        
        // Если открыта вкладка истории - обновляем и её
        if (!document.getElementById('tab-content-history').classList.contains('hidden')) {
            renderHistoryTab();
        }
    }
}

// Б. Обновление баланса
async function updateMyStats() {
    const { data } = await supabase.from('players').select('coins').eq('id', myId).single();
    if (data) document.getElementById('my-coins').innerText = data.coins;
}

// В. Список игроков (с логикой блокировок)
// В. Список игроков (с логикой блокировок и статусов)
async function refreshPlayersForDeals() {
    if (document.getElementById('tab-content-game').classList.contains('hidden')) return;

    const { data: players } = await supabase
        .from('players')
        .select('id, class_name, coins')
        .neq('id', myId)
        .eq('is_online', true);

    const list = document.getElementById('players-list');
    list.innerHTML = '';

    if (!players || players.length === 0) {
        list.innerHTML = '<p class="col-span-2 text-center text-gray-500 text-sm">Пока никого нет...</p>';
        return;
    }

    players.forEach(p => {
        // 1. Считаем общие лимиты
        const outgoing = myDealsHistory.filter(d => d.initiator_id === myId && d.receiver_id === p.id).length;
        const incoming = myDealsHistory.filter(d => d.initiator_id === p.id && d.receiver_id === myId).length;
        
        // 2. Проверяем, висит ли УЖЕ отправленное предложение (pending)
        const hasPendingDeal = myDealsHistory.some(d => 
            d.initiator_id === myId && 
            d.receiver_id === p.id && 
            d.status === 'pending'
        );

        // Условия блокировки
        const isClassmate = p.class_name === myClass;
        const isLimitReached = outgoing >= 5;

        // Рисуем кнопку
        let btnHtml = '';
        if (isClassmate) {
            btnHtml = `<button disabled class="w-full text-xs bg-gray-800 text-gray-600 py-2 rounded cursor-not-allowed border border-gray-700">Одноклассник 🚫</button>`;
        } else if (isLimitReached) {
            btnHtml = `<button disabled class="w-full text-xs bg-gray-800 text-gray-500 py-2 rounded cursor-not-allowed border border-gray-700">Лимит исчерпан 🔒</button>`;
        } else if (hasPendingDeal) {
            // НОВОЕ СОСТОЯНИЕ КНОПКИ
            btnHtml = `<button disabled class="w-full text-xs bg-yellow-900/50 text-yellow-500 py-2 rounded cursor-wait border border-yellow-700/50 animate-pulse">Ждем ответа... ⏳</button>`;
        } else {
            btnHtml = `<button onclick="openDealModal('${p.id}')" class="w-full text-xs bg-red-900 hover:bg-red-700 text-white py-2 rounded transition font-bold shadow-md">Предложить сделку</button>`;
        }

        const el = document.createElement('div');
        el.className = 'bg-slate-800 p-3 rounded border border-slate-700 flex flex-col justify-between shadow-sm';
        
        el.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <span class="text-xs font-bold ${isClassmate ? 'text-gray-500' : 'text-green-400'}">
                   ${isClassmate ? '🏫' : '🎄'} ${p.class_name}
                </span>
                <span class="text-xs text-yellow-500 font-mono">💰 ${p.coins}</span>
            </div>
            <div class="text-sm font-bold text-white mb-1">Тайный Санта</div>
            
            <div class="flex justify-between text-[10px] text-gray-400 mb-3 px-1 border-t border-slate-700/50 pt-1">
                <span title="Сколько раз вы предложили">Исх: <b class="${outgoing >= 5 ? 'text-red-400' : 'text-white'}">${outgoing}/5</b></span>
                <span title="Сколько раз вам предложили">Вх: <b class="${incoming >= 5 ? 'text-red-400' : 'text-white'}">${incoming}/5</b></span>
            </div>

            ${btnHtml}
        `;
        list.appendChild(el);
    });
}

// Г. Проверка входящих (Уведомления)
function checkIncomingDeals() {
    const deals = myDealsHistory.filter(d => d.receiver_id === myId && d.status === 'pending');
    const container = document.getElementById('incoming-deals');
    container.innerHTML = '';

    if (deals.length > 0) {
        deals.forEach(deal => {
            const el = document.createElement('div');
            el.className = 'bg-yellow-900/40 border border-yellow-500 p-3 rounded animate-pulse shadow-lg';
            el.innerHTML = `
                <div class="flex justify-between items-center mb-1">
                    <span class="text-sm text-yellow-200 font-bold">🔔 Новое предложение!</span>
                    <span class="text-[10px] text-yellow-400">Только что</span>
                </div>
                <div class="text-xs text-gray-300 mb-2">Кто-то хочет сыграть с вами.</div>
                <button onclick="openResponseModal('${deal.id}')" class="w-full text-xs bg-yellow-600 hover:bg-yellow-500 text-white py-2 rounded font-bold shadow-md transition">
                    Принять вызов
                </button>
            `;
            container.appendChild(el);
        });
    }
}

// Д. Отрисовка Истории Сделок
function renderHistoryTab() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    
    // Показываем только завершенные или ожидающие (где мы не инициатор, т.к. инициатор видит ожидание в "Исх")
    const visibleDeals = myDealsHistory.filter(d => !(d.status === 'pending' && d.initiator_id === myId));

    if (visibleDeals.length === 0) {
        list.innerHTML = '<p class="text-center text-gray-500 py-4">История пуста. Начните игру!</p>';
        return;
    }

    visibleDeals.forEach(d => {
        const el = document.createElement('div');
        el.className = 'border-b border-slate-700 pb-3 mb-3 last:border-0';
        
        let statusHtml = '';
        let resultHtml = '';

        if (d.status === 'pending') {
            statusHtml = `<span class="text-yellow-400 font-bold text-xs bg-yellow-900/30 px-2 py-1 rounded">⏳ Ждет ответа</span>`;
            resultHtml = `<div class="text-xs text-gray-500 mt-1">Ожидает вашего решения...</div>`;
        } else {
            const iamInitiator = d.initiator_id === myId;
            const myMove = iamInitiator ? d.initiator_move : d.receiver_move;
            const theirMove = iamInitiator ? d.receiver_move : d.initiator_move;
            const myPoints = iamInitiator ? d.points_initiator : d.points_receiver;

            const moveIcon = (move) => move === 'cooperate' ? '🤝' : '😈';
            const pointsColor = myPoints > 0 ? 'text-green-400' : 'text-red-400';
            const pointsSign = myPoints > 0 ? '+' : '';

            statusHtml = `<span class="text-gray-400 text-xs">Завершена</span>`;
            resultHtml = `
                <div class="flex justify-between items-center mt-2 bg-slate-800 p-2 rounded border border-slate-700">
                    <div class="text-center w-1/3">
                        <div class="text-[10px] text-gray-500 uppercase">Вы</div>
                        <div class="text-xl my-1">${moveIcon(myMove)}</div>
                    </div>
                    <div class="font-bold ${pointsColor} text-xl w-1/3 text-center">
                        ${pointsSign}${myPoints}
                    </div>
                    <div class="text-center w-1/3">
                        <div class="text-[10px] text-gray-500 uppercase">Они</div>
                        <div class="text-xl my-1">${moveIcon(theirMove)}</div>
                    </div>
                </div>
            `;
        }

        el.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <span class="text-xs text-gray-500 font-mono">${new Date(d.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                ${statusHtml}
            </div>
            ${resultHtml}
        `;
        list.appendChild(el);
    });
}

// Е. Загрузка Рейтинга
async function loadLeaderboard(limit, tableId) {
    const { data: players } = await supabase
        .from('players')
        .select('class_name, first_name, last_name, coins')
        .order('coins', { ascending: false })
        .limit(limit);

    const table = document.getElementById(tableId);
    const container = table.tagName === 'TABLE' && table.tBodies.length > 0 ? table.tBodies[0] : table;
    container.innerHTML = '';

    if (!players) return;

    players.forEach((p, index) => {
        const row = document.createElement('tr');
        // Подсветка топ-3
        let rankColor = "text-gray-400";
        if (index === 0) rankColor = "text-yellow-400 font-bold";
        if (index === 1) rankColor = "text-gray-300 font-bold";
        if (index === 2) rankColor = "text-orange-400 font-bold";

        row.innerHTML = `
            <td class="${rankColor} text-center">${index + 1}</td>
            <td class="text-white">${p.last_name} ${p.first_name}</td>
            <td class="text-xs text-gray-400">${p.class_name}</td>
            <td class="text-right font-mono text-yellow-500 font-bold">${p.coins}</td>
        `;
        container.appendChild(row);
    });
}

// --- 7. ЛОГИКА МОДАЛЬНЫХ ОКОН И ХОДОВ ---

window.openDealModal = (targetId) => {
    currentTargetId = targetId;
    respondingToDealId = null;
    document.getElementById('modal-title').innerText = "Предложить сделку";
    document.getElementById('modal-move').classList.remove('hidden');
    document.getElementById('modal-move').classList.add('flex');
};

window.openResponseModal = (dealId) => {
    respondingToDealId = dealId;
    currentTargetId = null;
    document.getElementById('modal-title').innerText = "Ваш ответ?";
    document.getElementById('modal-move').classList.remove('hidden');
    document.getElementById('modal-move').classList.add('flex');
};

window.closeModal = () => {
    document.getElementById('modal-move').classList.add('hidden');
    document.getElementById('modal-move').classList.remove('flex');
};

window.makeMove = async (moveType) => {
    closeModal();
    
    // Сценарий 1: Создание сделки
    if (currentTargetId) {
        const { data } = await supabase.rpc('create_deal', {
            my_id: myId, target_id: currentTargetId, my_move: moveType
        });
        if (data && data.error) alert("❌ " + data.error);
        else alert("✅ Предложение отправлено! Ожидайте ответа.");
    } 
    // Сценарий 2: Ответ на сделку
    else if (respondingToDealId) {
        const { data } = await supabase.rpc('accept_deal', {
            deal_id_input: respondingToDealId, responder_id: myId, responder_move_input: moveType
        });
        if (data && data.error) alert("❌ " + data.error);
        else {
            const change = data.p2_change > 0 ? `+${data.p2_change}` : data.p2_change;
            alert(`✅ Сделка завершена!\nВаш результат: ${change} монет`);
            fetchAllMyDeals(); // Сразу обновляем историю
            updateMyStats();
        }
    }
};

// --- 8. ВИЗУАЛЬНЫЕ ЭФФЕКТЫ ---
function createSnow() {
    const container = document.getElementById('snow-container');
    if(!container) return;
    for(let i=0; i<25; i++){
        const div = document.createElement('div');
        div.classList.add('snowflake');
        div.innerHTML = '❄';
        div.style.left = Math.random() * 100 + 'vw';
        div.style.animationDuration = (Math.random() * 5 + 5) + 's';
        div.style.opacity = Math.random();
        div.style.fontSize = (Math.random() * 10 + 8) + 'px';
        container.appendChild(div);
    }
}