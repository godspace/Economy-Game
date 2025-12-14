// game.js

// --- КОНФИГУРАЦИЯ ---
const SUPABASE_URL = 'https://ferhcoqknnobeesscvdv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlcmhjb3Frbm5vYmVlc3NjdmR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MjQ0NDUsImV4cCI6MjA4MTMwMDQ0NX0.pJB2oBN9Asp8mO0Od1lHD6sRjr-swoaJu5Z-ZJvw9jA';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Состояние
let myId = localStorage.getItem('santa_id');
let myClass = localStorage.getItem('santa_class');
let currentTargetId = null;
let respondingToDealId = null;

// Глобальное хранилище моих сделок (чтобы не дергать базу 100 раз)
let myDealsHistory = []; 

// --- ИНИЦИАЛИЗАЦИЯ ---
document.addEventListener('DOMContentLoaded', () => {
    createSnow();
    
    if (myId) {
        showGameScreen();
        startGameLoop();
    } else {
        loadLeaderboard(10, 'login-leaderboard');
    }

    document.getElementById('login-btn').addEventListener('click', login);
});

// --- ВХОД ---
async function login() {
    const code = document.getElementById('access-code').value;
    const btn = document.getElementById('login-btn');
    const err = document.getElementById('login-error');

    btn.disabled = true; btn.innerText = "Проверка..."; err.classList.add('hidden');

    const { data, error } = await supabase.rpc('login_player', { input_code: code });

    if (error || (data && data.error)) {
        err.innerText = error ? error.message : data.error;
        err.classList.remove('hidden');
        btn.disabled = false; btn.innerText = "ВОЙТИ";
    } else {
        myId = data.player_id;
        localStorage.setItem('santa_id', myId);
        localStorage.setItem('santa_class', data.class);
        location.reload(); 
    }
}

function showGameScreen() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('my-class').innerText = myClass || 'Elf';
}

// --- УПРАВЛЕНИЕ ВКЛАДКАМИ ---
window.switchTab = function(tabName) {
    ['game', 'history', 'rating'].forEach(t => {
        document.getElementById(`tab-content-${t}`).classList.add('hidden');
        document.getElementById(`tab-btn-${t}`).classList.remove('active');
    });

    document.getElementById(`tab-content-${tabName}`).classList.remove('hidden');
    document.getElementById(`tab-btn-${tabName}`).classList.add('active');

    if (tabName === 'rating') loadLeaderboard(50, 'main-leaderboard');
    if (tabName === 'history') renderHistoryTab(); // Рендерим историю при открытии
};

// --- ИГРОВОЙ ЦИКЛ ---
function startGameLoop() {
    fetchAllMyDeals(); // Сначала грузим историю сделок (нужна для лимитов)
    updateMyStats();
    
    setInterval(() => {
        fetchAllMyDeals(); 
        updateMyStats();
    }, 3000); // Раз в 3 сек обновляем всё
}

// 1. Загрузка ВСЕХ сделок, где я участвую
// 1. Загрузка ВСЕХ сделок через защищенную функцию
async function fetchAllMyDeals() {
    // ВАЖНО: Используем RPC, чтобы обойти RLS политики
    const { data: deals, error } = await supabase.rpc('get_my_deals', { 
        player_uuid: myId 
    });

    if (error) {
        console.error("Ошибка получения сделок:", error);
        return;
    }

    if (deals) {
        myDealsHistory = deals;
        
        // После загрузки обновляем интерфейс
        checkIncomingDeals();     
        refreshPlayersForDeals(); 
        
        // Обновляем историю, если открыта вкладка
        if (!document.getElementById('tab-content-history').classList.contains('hidden')) {
            renderHistoryTab();
        }
    }
}

// 2. Обновление баланса
async function updateMyStats() {
    const { data } = await supabase.from('players').select('coins').eq('id', myId).single();
    if (data) document.getElementById('my-coins').innerText = data.coins;
}

// 3. Список игроков (с проверкой классов и лимитов)
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
        list.innerHTML = '<p class="col-span-2 text-center text-gray-500 text-sm">Ждем эльфов...</p>';
        return;
    }

    players.forEach(p => {
        // Считаем сделки с ЭТИМ игроком
        const outgoing = myDealsHistory.filter(d => d.initiator_id === myId && d.receiver_id === p.id).length;
        const incoming = myDealsHistory.filter(d => d.initiator_id === p.id && d.receiver_id === myId).length;
        
        const isClassmate = p.class_name === myClass;
        const isLimitReached = outgoing >= 5;

        // Формируем кнопку
        let btnHtml = '';
        if (isClassmate) {
            btnHtml = `<button disabled class="w-full text-xs bg-gray-700 text-gray-400 py-2 rounded cursor-not-allowed border border-gray-600">Одноклассник 🚫</button>`;
        } else if (isLimitReached) {
            btnHtml = `<button disabled class="w-full text-xs bg-gray-700 text-gray-400 py-2 rounded cursor-not-allowed">Лимит (5/5)</button>`;
        } else {
            btnHtml = `<button onclick="openDealModal('${p.id}')" class="w-full text-xs bg-red-900 hover:bg-red-700 text-white py-2 rounded transition font-bold">Предложить сделку</button>`;
        }

        const el = document.createElement('div');
        el.className = 'bg-slate-800 p-3 rounded border border-slate-700 flex flex-col justify-between';
        
        el.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <span class="text-xs font-bold ${isClassmate ? 'text-gray-500' : 'text-green-400'}">
                   ${isClassmate ? '🏫' : '🎄'} ${p.class_name}
                </span>
                <span class="text-xs text-yellow-500">💰 ${p.coins}</span>
            </div>
            <div class="text-sm font-bold text-white mb-1">Тайный Санта</div>
            
            <div class="flex justify-between text-[10px] text-gray-400 mb-2 px-1">
                <span title="Вы предложили">Исх: <b class="${outgoing >= 5 ? 'text-red-400' : 'text-white'}">${outgoing}/5</b></span>
                <span title="Вам предложили">Вх: <b class="${incoming >= 5 ? 'text-red-400' : 'text-white'}">${incoming}/5</b></span>
            </div>

            ${btnHtml}
        `;
        list.appendChild(el);
    });
}

// 4. Отрисовка Вкладки "СДЕЛКИ" (История)
function renderHistoryTab() {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    
    if (myDealsHistory.length === 0) {
        list.innerHTML = '<p class="text-center text-gray-500">История пуста.</p>';
        return;
    }

    myDealsHistory.forEach(d => {
        // Пропускаем "pending" сделки, где мы инициаторы (они еще не случились)
        if(d.status === 'pending' && d.initiator_id === myId) return;

        const el = document.createElement('div');
        el.className = 'border-b border-slate-700 pb-2 mb-2 last:border-0';
        
        let statusHtml = '';
        let resultHtml = '';

        if (d.status === 'pending') {
             // Если висит входящая
            statusHtml = `<span class="text-yellow-400 font-bold">⏳ Ожидает ответа</span>`;
            resultHtml = `<span class="text-xs text-gray-500">Результат будет известен после выбора</span>`;
        } else {
            // Сделка завершена. Определяем роли.
            const iamInitiator = d.initiator_id === myId;
            const myMove = iamInitiator ? d.initiator_move : d.receiver_move;
            const theirMove = iamInitiator ? d.receiver_move : d.initiator_move;
            const myPoints = iamInitiator ? d.points_initiator : d.points_receiver;

            // Красивое отображение ходов
            const moveIcon = (move) => move === 'cooperate' ? '🤝' : '😈';
            
            // Цвет результата
            let pointsColor = myPoints > 0 ? 'text-green-400' : 'text-red-400';
            let pointsSign = myPoints > 0 ? '+' : '';

            statusHtml = `<span class="text-gray-300 text-xs">Завершена</span>`;
            resultHtml = `
                <div class="flex justify-between items-center mt-1 bg-slate-900/50 p-2 rounded">
                    <div class="text-center">
                        <div class="text-xs text-gray-500">Вы</div>
                        <div class="text-lg">${moveIcon(myMove)}</div>
                    </div>
                    <div class="font-bold ${pointsColor} text-lg">
                        ${pointsSign}${myPoints}
                    </div>
                    <div class="text-center">
                        <div class="text-xs text-gray-500">Они</div>
                        <div class="text-lg">${moveIcon(theirMove)}</div>
                    </div>
                </div>
            `;
        }

        el.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <span class="text-xs text-gray-400">${new Date(d.created_at).toLocaleTimeString().slice(0,5)}</span>
                ${statusHtml}
            </div>
            ${resultHtml}
        `;
        list.appendChild(el);
    });
}

// 5. Проверка входящих (Уведомления)
function checkIncomingDeals() {
    const deals = myDealsHistory.filter(d => d.receiver_id === myId && d.status === 'pending');
    const container = document.getElementById('incoming-deals');
    container.innerHTML = '';

    if (deals.length > 0) {
        deals.forEach(deal => {
            const el = document.createElement('div');
            el.className = 'bg-yellow-900/40 border border-yellow-500 p-3 rounded animate-pulse';
            el.innerHTML = `
                <div class="text-sm text-yellow-200 font-bold mb-1">🔔 Предложение!</div>
                <div class="text-xs text-gray-300 mb-2">Кто-то хочет сделку.</div>
                <button onclick="openResponseModal('${deal.id}')" class="w-full text-xs bg-yellow-600 hover:bg-yellow-500 text-white py-2 rounded font-bold">
                    Ответить
                </button>
            `;
            container.appendChild(el);
        });
    }
}

// 6. Рейтинг
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
        row.innerHTML = `
            <td class="font-bold text-gray-400">${index + 1}</td>
            <td class="text-white">${p.last_name} ${p.first_name}</td>
            <td class="text-xs text-gray-400">${p.class_name}</td>
            <td class="text-right font-mono text-yellow-500 font-bold">${p.coins}</td>
        `;
        container.appendChild(row);
    });
}

// --- ЛОГИКА МОДАЛОК ---
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
    
    if (currentTargetId) {
        const { data } = await supabase.rpc('create_deal', {
            my_id: myId, target_id: currentTargetId, my_move: moveType
        });
        if (data && data.error) alert(data.error);
        else alert("Предложение отправлено!");
    } 
    else if (respondingToDealId) {
        const { data } = await supabase.rpc('accept_deal', {
            deal_id_input: respondingToDealId, responder_id: myId, responder_move_input: moveType
        });
        if (data && data.error) alert(data.error);
        else {
            const change = data.p2_change > 0 ? `+${data.p2_change}` : data.p2_change;
            alert(`Итог сделки для вас: ${change} монет`);
            fetchAllMyDeals(); // Сразу обновить историю
            updateMyStats();
        }
    }
};

// --- ВИЗУАЛ ---
function createSnow() {
    const container = document.getElementById('snow-container');
    if(!container) return;
    for(let i=0; i<20; i++){
        const div = document.createElement('div');
        div.classList.add('snowflake');
        div.innerHTML = '❄';
        div.style.left = Math.random() * 100 + 'vw';
        div.style.animationDuration = (Math.random() * 5 + 5) + 's';
        div.style.opacity = Math.random();
        div.style.fontSize = (Math.random() * 10 + 10) + 'px';
        container.appendChild(div);
    }
};

// --- ВЫХОД ИЗ ИГРЫ ---
window.logout = function() {
    if (confirm("Вы действительно хотите выйти?")) {
        localStorage.removeItem('santa_id');
        localStorage.removeItem('santa_class');
        location.reload(); // Перезагрузка вернет на экран входа
    }
};