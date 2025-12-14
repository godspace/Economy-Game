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

// --- ИНИЦИАЛИЗАЦИЯ ---
document.addEventListener('DOMContentLoaded', () => {
    createSnow();
    
    // Если уже вошли
    if (myId) {
        showGameScreen();
        startGameLoop();
    } else {
        // Если не вошли - грузим топ-10 для экрана входа
        loadLeaderboard(10, 'login-leaderboard');
    }

    // Привязка кнопки входа
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
    // Скрываем все
    document.getElementById('tab-content-game').classList.add('hidden');
    document.getElementById('tab-content-rating').classList.add('hidden');
    document.getElementById('tab-btn-game').classList.remove('active');
    document.getElementById('tab-btn-rating').classList.remove('active');

    // Показываем нужное
    document.getElementById(`tab-content-${tabName}`).classList.remove('hidden');
    document.getElementById(`tab-btn-${tabName}`).classList.add('active');

    // Если открыли рейтинг - обновляем его
    if (tabName === 'rating') {
        loadLeaderboard(50, 'main-leaderboard');
    }
};

// --- ИГРОВОЙ ЦИКЛ ---
function startGameLoop() {
    updateMyStats();
    refreshPlayersForDeals();
    checkIncomingDeals();

    setInterval(() => {
        updateMyStats();
        refreshPlayersForDeals();
        checkIncomingDeals();
    }, 3000);
}

// 1. Обновление моих монет
async function updateMyStats() {
    const { data } = await supabase.from('players').select('coins').eq('id', myId).single();
    if (data) document.getElementById('my-coins').innerText = data.coins;
}

// 2. Список игроков ДЛЯ СДЕЛОК (Анонимно)
async function refreshPlayersForDeals() {
    // Если мы на вкладке рейтинга, не грузим этот список зря
    if (document.getElementById('tab-content-game').classList.contains('hidden')) return;

    const { data: players } = await supabase
        .from('players')
        .select('id, class_name, coins') // Имена специально не запрашиваем
        .neq('id', myId)
        .eq('is_online', true);

    const list = document.getElementById('players-list');
    list.innerHTML = '';

    if (!players || players.length === 0) {
        list.innerHTML = '<p class="col-span-2 text-center text-gray-500 text-sm">Ждем других игроков...</p>';
        return;
    }

    players.forEach(p => {
        const el = document.createElement('div');
        el.className = 'bg-slate-800 p-3 rounded border border-slate-700 flex flex-col justify-between';
        // ВАЖНО: Тут жестко пишем "Тайный Санта"
        el.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <span class="text-xs text-green-400 font-bold">🎄 ${p.class_name}</span>
                <span class="text-xs text-yellow-500">💰 ${p.coins}</span>
            </div>
            <div class="text-sm font-bold text-white mb-2">Тайный Санта</div>
            <button onclick="openDealModal('${p.id}')" class="w-full text-xs bg-red-900 hover:bg-red-700 text-white py-2 rounded transition">
                Сделка
            </button>
        `;
        list.appendChild(el);
    });
}

// 3. Загрузка РЕЙТИНГА (С именами)
async function loadLeaderboard(limit, tableId) {
    const { data: players } = await supabase
        .from('players')
        .select('class_name, first_name, last_name, coins')
        .order('coins', { ascending: false })
        .limit(limit);

    const table = document.getElementById(tableId);
    // Если это таблица в игре, нужно чистить tbody, если на логине - просто table
    const container = table.tagName === 'TABLE' && table.tBodies.length > 0 ? table.tBodies[0] : table;
    container.innerHTML = '';

    if (!players) return;

    players.forEach((p, index) => {
        const row = document.createElement('tr');
        // ВАЖНО: Тут выводим настоящие имена
        row.innerHTML = `
            <td class="font-bold">${index + 1}</td>
            <td>${p.last_name} ${p.first_name}</td>
            <td class="text-xs text-gray-400">${p.class_name}</td>
            <td class="text-right font-mono text-yellow-500">${p.coins}</td>
        `;
        container.appendChild(row);
    });
}

// 4. Входящие сделки
async function checkIncomingDeals() {
    const { data: deals } = await supabase
        .from('deals')
        .select('*')
        .eq('receiver_id', myId)
        .eq('status', 'pending');

    const container = document.getElementById('incoming-deals');
    container.innerHTML = '';

    if (deals && deals.length > 0) {
        deals.forEach(deal => {
            const el = document.createElement('div');
            el.className = 'bg-yellow-900/40 border border-yellow-500 p-3 rounded animate-pulse';
            el.innerHTML = `
                <div class="text-sm text-yellow-200 font-bold mb-1">🔔 Предложение!</div>
                <div class="text-xs text-gray-300 mb-2">Кто-то из списка хочет сделку.</div>
                <button onclick="openResponseModal('${deal.id}')" class="w-full text-xs bg-yellow-600 hover:bg-yellow-500 text-white py-2 rounded font-bold">
                    Принять
                </button>
            `;
            container.appendChild(el);
        });
    }
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
}