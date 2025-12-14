// game.js

// --- КОНФИГУРАЦИЯ ---
const SUPABASE_URL = 'https://ferhcoqknnobeesscvdv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlcmhjb3Frbm5vYmVlc3NjdmR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MjQ0NDUsImV4cCI6MjA4MTMwMDQ0NX0.pJB2oBN9Asp8mO0Od1lHD6sRjr-swoaJu5Z-ZJvw9jA';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 2. СОСТОЯНИЕ ---
let myId = localStorage.getItem('santa_id');
let myClass = localStorage.getItem('santa_class');
let isAdmin = false;
let myDealsHistory = []; 
let currentTargetId = null;
let respondingToDealId = null;

// --- 3. ИНИЦИАЛИЗАЦИЯ ---
document.addEventListener('DOMContentLoaded', () => {
    createSnow();
    if (myId) {
        showGameScreen();
        startGameLoop();
    } else {
        loadLeaderboard(10, 'login-leaderboard');
    }
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) loginBtn.addEventListener('click', login);
});

// --- 4. АВТОРИЗАЦИЯ ---
async function login() {
    const code = document.getElementById('access-code').value;
    const btn = document.getElementById('login-btn');
    const err = document.getElementById('login-error');

    btn.disabled = true; btn.innerText = "Проверка..."; err.classList.add('hidden');

    const { data, error } = await supabase.rpc('login_player', { input_code: code });

    if (error || (data && data.error)) {
        err.innerText = error ? error.message : data.error;
        err.classList.remove('hidden');
        btn.disabled = false; btn.innerText = "ВОЙТИ В ИГРУ";
    } else {
        myId = data.player_id;
        localStorage.setItem('santa_id', myId);
        localStorage.setItem('santa_class', data.class);
        location.reload(); 
    }
}

window.logout = function() {
    if (confirm("Выйти из профиля?")) {
        localStorage.removeItem('santa_id');
        localStorage.removeItem('santa_class');
        location.reload();
    }
};

async function showGameScreen() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('my-class').innerText = myClass || 'Elf';

    const { data } = await supabase.from('players').select('is_admin').eq('id', myId).single();
    if (data && data.is_admin) {
        isAdmin = true;
        document.getElementById('tab-btn-admin').classList.remove('hidden');
    }
}

// --- 5. ВКЛАДКИ ---
window.switchTab = function(tabName) {
    ['game', 'rating', 'shop', 'admin'].forEach(t => {
        const content = document.getElementById(`tab-content-${t}`);
        const btn = document.getElementById(`tab-btn-${t}`);
        if(content) content.classList.add('hidden');
        if(btn) btn.classList.remove('active');
    });

    document.getElementById(`tab-content-${tabName}`).classList.remove('hidden');
    document.getElementById(`tab-btn-${tabName}`).classList.add('active');

    if (tabName === 'rating') loadLeaderboard(50, 'main-leaderboard');
    if (tabName === 'shop') checkShopStatus();
    if (tabName === 'admin') loadAdminOrders();
};

// --- 6. ИГРОВОЙ ЦИКЛ ---
function startGameLoop() {
    refreshAllData();
    setInterval(refreshAllData, 3000);
}

function refreshAllData() {
    fetchAllMyDeals();
    updateMyStats();
    if(isAdmin) loadAdminOrders();
}

async function fetchAllMyDeals() {
    const { data: deals } = await supabase.rpc('get_my_deals', { player_uuid: myId });
    if (deals) {
        myDealsHistory = deals;
        checkIncomingDeals();     
        refreshPlayersForDeals(); 
        // Если модальное окно открыто, обновляем историю в нем в реальном времени
        if (!document.getElementById('modal-move').classList.contains('hidden')) {
             const activeTarget = currentTargetId || (respondingToDealId ? getPartnerIdFromDeal(respondingToDealId) : null);
             if(activeTarget) renderModalHistory(activeTarget);
        }
    }
}

// Вспомогательная: найти ID партнера по ID сделки
function getPartnerIdFromDeal(dealId) {
    const deal = myDealsHistory.find(d => d.id === dealId);
    if (!deal) return null;
    return deal.initiator_id === myId ? deal.receiver_id : deal.initiator_id;
}

async function updateMyStats() {
    const { data } = await supabase.from('players').select('coins').eq('id', myId).single();
    if (data) document.getElementById('my-coins').innerText = data.coins;
}

// --- СПИСОК ИГРОКОВ (АНОНИМНЫЙ) ---
async function refreshPlayersForDeals() {
    if (document.getElementById('tab-content-game').classList.contains('hidden')) return;

    // ВАЖНО: Мы больше не запрашиваем coins, чтобы не палить их
    const { data: players } = await supabase
        .from('players')
        .select('id, class_name') // убрали coins
        .neq('id', myId)
        .eq('is_online', true);

    const list = document.getElementById('players-list');
    list.innerHTML = '';

    if (!players || players.length === 0) {
        list.innerHTML = '<p class="col-span-2 text-center text-gray-500 text-sm">Пока никого нет...</p>';
        return;
    }

    players.forEach(p => {
        const outgoing = myDealsHistory.filter(d => d.initiator_id === myId && d.receiver_id === p.id).length;
        const incoming = myDealsHistory.filter(d => d.initiator_id === p.id && d.receiver_id === myId).length;
        const hasPendingDeal = myDealsHistory.some(d => d.initiator_id === myId && d.receiver_id === p.id && d.status === 'pending');
        
        const isClassmate = p.class_name === myClass;
        const isLimitReached = outgoing >= 5;

        let btnHtml = '';
        if (isClassmate) {
            btnHtml = `<button disabled class="w-full text-xs bg-slate-800 text-gray-600 py-2 rounded cursor-not-allowed border border-gray-800">Одноклассник 🚫</button>`;
        } else if (isLimitReached) {
            btnHtml = `<button disabled class="w-full text-xs bg-slate-800 text-gray-500 py-2 rounded cursor-not-allowed border border-gray-800">Лимит (5) 🔒</button>`;
        } else if (hasPendingDeal) {
            btnHtml = `<button disabled class="w-full text-xs bg-yellow-900/30 text-yellow-600 py-2 rounded cursor-wait border border-yellow-900/50 animate-pulse">Ждем ответа... ⏳</button>`;
        } else {
            btnHtml = `<button onclick="openDealModal('${p.id}')" class="w-full text-xs bg-red-900 hover:bg-red-700 text-white py-2 rounded transition font-bold shadow-md border border-red-800">Предложить</button>`;
        }

        const el = document.createElement('div');
        el.className = 'bg-slate-800 p-3 rounded border border-slate-700 flex flex-col justify-between shadow-sm';
        
        // АНОНИМНАЯ КАРТОЧКА
        el.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                     <span class="text-xl">🎅</span>
                     <div class="leading-tight">
                        <div class="text-sm font-bold text-gray-200">Тайный Санта</div>
                        <div class="text-[10px] text-gray-500">Анонимный игрок</div>
                     </div>
                </div>
            </div>
            
            <div class="flex justify-between text-[10px] text-gray-500 mb-3 px-1 border-t border-slate-700/50 pt-2">
                <span title="Вы предложили">Исх: <b class="${outgoing >= 5 ? 'text-red-400' : 'text-gray-300'}">${outgoing}/5</b></span>
                <span title="Вам предложили">Вх: <b class="${incoming >= 5 ? 'text-red-400' : 'text-gray-300'}">${incoming}/5</b></span>
            </div>
            ${btnHtml}
        `;
        list.appendChild(el);
    });
}

function checkIncomingDeals() {
    const deals = myDealsHistory.filter(d => d.receiver_id === myId && d.status === 'pending');
    const container = document.getElementById('incoming-deals');
    container.innerHTML = '';
    deals.forEach(deal => {
        const el = document.createElement('div');
        el.className = 'bg-yellow-900/40 border border-yellow-500 p-3 rounded animate-pulse shadow-lg';
        el.innerHTML = `<div class="flex justify-between items-center mb-1"><span class="text-sm text-yellow-200 font-bold">🔔 Предложение!</span></div><button onclick="openResponseModal('${deal.id}')" class="w-full text-xs bg-yellow-600 hover:bg-yellow-500 text-white py-2 rounded font-bold shadow-md transition">Принять вызов</button>`;
        container.appendChild(el);
    });
}

// --- НОВОЕ: ИСТОРИЯ В МОДАЛКЕ ---
function renderModalHistory(partnerId) {
    const container = document.getElementById('modal-history-list');
    container.innerHTML = '';

    // Фильтруем сделки ТОЛЬКО с этим партнером
    const history = myDealsHistory.filter(d => 
        (d.initiator_id === myId && d.receiver_id === partnerId) || 
        (d.receiver_id === myId && d.initiator_id === partnerId)
    );

    // Сортируем: новые сверху
    history.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (history.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-4 italic">История взаимодействий пуста.</div>';
        return;
    }

    history.forEach(d => {
        // Не показываем "pending" (ожидающие), если я инициатор, чтобы не засорять. Показываем только результаты.
        if (d.status === 'pending') return;

        const el = document.createElement('div');
        el.className = 'bg-slate-900/80 p-2 rounded border border-slate-700 flex justify-between items-center';

        const iamInitiator = d.initiator_id === myId;
        const myMove = iamInitiator ? d.initiator_move : d.receiver_move;
        const theirMove = iamInitiator ? d.receiver_move : d.initiator_move;
        const myPoints = iamInitiator ? d.points_initiator : d.points_receiver;

        const moveIcon = (m) => m === 'cooperate' ? '🤝' : '😈';
        const color = myPoints > 0 ? 'text-green-400' : 'text-red-400';

        el.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">Вы:</span>
                <span class="text-lg">${moveIcon(myMove)}</span>
            </div>
            <div class="font-bold ${color}">${myPoints > 0 ? '+' : ''}${myPoints}</div>
            <div class="flex items-center gap-2">
                <span class="text-lg">${moveIcon(theirMove)}</span>
                <span class="text-xs text-gray-500">:Они</span>
            </div>
        `;
        container.appendChild(el);
    });
}


// --- МАГАЗИН И АДМИНКА (Без изменений логики) ---
async function buyItem(itemName, cost) {
    if (!confirm(`Купить ${itemName} за ${cost} монет?`)) return;
    const btn = document.getElementById('btn-buy-bounty');
    btn.disabled = true; btn.innerText = "Обработка...";
    const { data, error } = await supabase.rpc('buy_item', { my_id: myId, item_label: itemName, cost: cost });
    if (error || (data && data.error)) { alert("❌ " + (error ? error.message : data.error)); btn.disabled = false; btn.innerText = "КУПИТЬ"; } 
    else { alert("✅ Успешно!"); checkShopStatus(); updateMyStats(); }
}

async function checkShopStatus() {
    const { data } = await supabase.from('shop_orders').select('*').eq('player_id', myId).eq('status', 'pending');
    const btn = document.getElementById('btn-buy-bounty');
    const msg = document.getElementById('shop-status');
    if (data && data.length > 0) { btn.disabled = true; btn.classList.add('bg-gray-600', 'cursor-not-allowed'); btn.classList.remove('from-blue-600', 'to-cyan-500'); btn.innerText = "ЖДЕМ ВЫДАЧИ..."; msg.classList.remove('hidden'); } 
    else { btn.disabled = false; btn.classList.remove('bg-gray-600', 'cursor-not-allowed'); btn.classList.add('from-blue-600', 'to-cyan-500'); btn.innerText = "КУПИТЬ"; msg.classList.add('hidden'); }
}

async function loadAdminOrders() {
    if (document.getElementById('tab-content-admin').classList.contains('hidden')) return;
    const { data: orders } = await supabase.rpc('get_admin_orders');
    const container = document.getElementById('admin-orders-list');
    container.innerHTML = '';
    if (!orders || orders.length === 0) { container.innerHTML = '<p class="text-gray-500 text-center">Нет заказов</p>'; return; }
    orders.forEach(order => {
        const el = document.createElement('div');
        el.className = 'bg-slate-800 p-3 rounded border border-slate-600 flex justify-between items-center';
        el.innerHTML = `<div><div class="font-bold text-white">${order.player_name}</div><div class="text-xs text-yellow-400">Покупка: ${order.item_name}</div></div><button onclick="deliverOrder('${order.id}')" class="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded text-xs">ВЫДАТЬ</button>`;
        container.appendChild(el);
    });
}
window.deliverOrder = async function(orderId) { if(!confirm("Выдать?")) return; const { error } = await supabase.rpc('deliver_order', { order_uuid: orderId }); if(!error) loadAdminOrders(); };

async function loadLeaderboard(limit, tableId) {
    const { data: players } = await supabase.from('players').select('class_name, first_name, last_name, coins').order('coins', { ascending: false }).limit(limit);
    const container = document.getElementById(tableId).tagName === 'TABLE' ? document.getElementById(tableId).tBodies[0] || document.getElementById(tableId) : document.getElementById(tableId);
    container.innerHTML = '';
    if (!players) return;
    players.forEach((p, index) => {
        const row = document.createElement('tr');
        let rankColor = "text-gray-400";
        if (index === 0) rankColor = "text-yellow-400 font-bold";
        if (index === 1) rankColor = "text-gray-300 font-bold";
        if (index === 2) rankColor = "text-orange-400 font-bold";
        row.innerHTML = `<td class="${rankColor} text-center">${index + 1}</td><td class="text-white">${p.last_name} ${p.first_name}</td><td class="text-xs text-gray-400">${p.class_name}</td><td class="text-right font-mono text-yellow-500 font-bold">${p.coins}</td>`;
        container.appendChild(row);
    });
}

// --- МОДАЛКИ (ОБНОВЛЕННЫЕ) ---
window.openDealModal = (targetId) => {
    currentTargetId = targetId;
    respondingToDealId = null;
    renderModalHistory(targetId); // <--- ГРУЗИМ ИСТОРИЮ
    document.getElementById('modal-title').innerText = "Предложить сделку";
    document.getElementById('modal-move').classList.remove('hidden');
    document.getElementById('modal-move').classList.add('flex');
};

window.openResponseModal = (dealId) => {
    respondingToDealId = dealId;
    currentTargetId = null;
    const partnerId = getPartnerIdFromDeal(dealId);
    if(partnerId) renderModalHistory(partnerId); // <--- ГРУЗИМ ИСТОРИЮ
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
        const { data } = await supabase.rpc('create_deal', { my_id: myId, target_id: currentTargetId, my_move: moveType });
        if (data && data.error) alert("❌ " + data.error);
        else alert("✅ Предложение отправлено!");
    } else if (respondingToDealId) {
        const { data } = await supabase.rpc('accept_deal', { deal_id_input: respondingToDealId, responder_id: myId, responder_move_input: moveType });
        if (data && data.error) alert("❌ " + data.error);
        else { alert(`✅ Результат: ${data.p2_change > 0 ? '+' : ''}${data.p2_change}`); fetchAllMyDeals(); updateMyStats(); }
    }
};

function createSnow() { const container = document.getElementById('snow-container'); if(!container) return; for(let i=0; i<25; i++){ const div = document.createElement('div'); div.classList.add('snowflake'); div.innerHTML = '❄'; div.style.left = Math.random() * 100 + 'vw'; div.style.animationDuration = (Math.random() * 5 + 5) + 's'; div.style.opacity = Math.random(); div.style.fontSize = (Math.random() * 10 + 8) + 'px'; container.appendChild(div); } }