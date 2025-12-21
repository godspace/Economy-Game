// game.js

// --- 1. КОНФИГУРАЦИЯ ---
const SUPABASE_URL = 'https://ferhcoqknnobeesscvdv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlcmhjb3Frbm5vYmVlc3NjdmR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MjQ0NDUsImV4cCI6MjA4MTMwMDQ0NX0.pJB2oBN9Asp8mO0Od1lHD6sRjr-swoaJu5Z-ZJvw9jA';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 2. СОСТОЯНИЕ ---
let myId = localStorage.getItem('santa_id');
let myClass = localStorage.getItem('santa_class');
let isAdmin = false;
let myDealsHistory = []; 
let currentTargetId = null;
let respondingToDealId = null;

// Пагинация
let visiblePlayersCount = 25; 
const PLAYERS_PER_PAGE = 25;

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

    btn.disabled = true; btn.innerText = "Связь с лесом..."; err.classList.add('hidden');

    const { data, error } = await supabaseClient.rpc('login_player', { input_code: code });

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

window.logout = async function() {
    if (confirm("Покинуть волшебный лес?")) {
        if (myId) {
            await supabaseClient.rpc('logout_player', { player_uuid: myId });
        }
        localStorage.removeItem('santa_id');
        localStorage.removeItem('santa_class');
        location.reload();
    }
};

async function showGameScreen() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('my-class').innerText = myClass || 'Elf';

    // [ИСПРАВЛЕНО] Используем безопасную функцию вместо прямого SELECT (ошибка 406)
    updateMyStats(); 
}

// --- 5. ВКЛАДКИ ---
window.switchTab = function(tabName) {
    ['game', 'rating', 'shop', 'admin'].forEach(t => {
        document.getElementById(`tab-content-${t}`).classList.add('hidden');
        document.getElementById(`tab-btn-${t}`).classList.remove('active');
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
    const { data: deals } = await supabaseClient.rpc('get_my_deals', { player_uuid: myId });
    if (deals) {
        myDealsHistory = deals;
        checkIncomingDeals();     
        refreshPlayersForDeals(); 
        
        if (!document.getElementById('modal-move').classList.contains('hidden')) {
             const activeTarget = currentTargetId || (respondingToDealId ? getPartnerIdFromDeal(respondingToDealId) : null);
             if(activeTarget) renderModalHistory(activeTarget);
        }
    }
}

function getPartnerIdFromDeal(dealId) {
    const deal = myDealsHistory.find(d => d.id === dealId);
    if (!deal) return null;
    return deal.initiator_id === myId ? deal.receiver_id : deal.initiator_id;
}

// [ИСПРАВЛЕНО] Новая функция обновления статистики через RPC
async function updateMyStats() {
    const { data, error } = await supabaseClient.rpc('get_my_stats', { player_uuid: myId });
    
    if (data && !error) {
        document.getElementById('my-coins').innerText = data.coins;
        
        // Проверяем админку здесь
        if (data.is_admin) {
            isAdmin = true;
            document.getElementById('tab-btn-admin').classList.remove('hidden');
        }
    }
}

// --- СПИСОК ИГРОКОВ (СОРТИРОВКА + ПАГИНАЦИЯ) ---
async function refreshPlayersForDeals() {
    if (document.getElementById('tab-content-game').classList.contains('hidden')) return;

    const { data: players, error } = await supabaseClient.rpc('get_active_players', { my_id: myId });

    if (error) {
        console.error("Ошибка загрузки игроков:", error);
        return;
    }

    const list = document.getElementById('players-list');
    list.innerHTML = '';

    if (!players || players.length === 0) {
        list.innerHTML = '<p class="col-span-1 text-center text-[#e9c46a] text-lg py-10 italic">В лесу пока тихо... Ждем эльфов.</p>';
        return;
    }

    const processedPlayers = players.map(p => {
        // [ИСПРАВЛЕНО] Маппинг данных с учетом новых имен колонок из SQL (ret_*)
        // SQL возвращает: ret_id, ret_class_name, outgoing, incoming, etc.
        return {
            id: p.ret_id,                 // Исправлено
            class_name: p.ret_class_name, // Исправлено (ошибка Ambiguous column решена)
            outgoing: p.outgoing,
            incoming: p.incoming,
            hasPendingDeal: p.has_pending,
            isClassmate: p.is_classmate,
            
            // Логика сортировки
            isLimitReached: p.outgoing >= 5,
            sortWeight: calculateSortWeight(p)
        };
    });

    processedPlayers.sort((a, b) => a.sortWeight - b.sortWeight);
    const visiblePlayers = processedPlayers.slice(0, visiblePlayersCount);

    visiblePlayers.forEach(p => {
        let btnHtml = '';
        if (p.isClassmate) {
            btnHtml = `<button disabled class="w-full py-3 rounded-xl bg-[#2c3e30] text-[#6c757d] font-bold border border-[#495057] text-sm">🚫 СВОЙ КЛАСС</button>`;
        } else if (p.isLimitReached) {
            btnHtml = `<button disabled class="w-full py-3 rounded-xl bg-[#2c3e30] text-[#6c757d] font-bold border border-[#495057] text-sm">🔒 ЛИМИТ (5/5)</button>`;
        } else if (p.hasPendingDeal) {
            btnHtml = `<button disabled class="w-full py-3 rounded-xl bg-[#e9c46a]/20 text-[#e9c46a] font-bold border border-[#e9c46a] animate-pulse text-sm">⏳ ЖДЕМ ОТВЕТА...</button>`;
        } else {
            btnHtml = `<button onclick="openDealModal('${p.id}')" class="w-full py-4 rounded-xl bg-[#d64045] hover:bg-[#b02e33] text-white text-lg font-bold shadow-lg transition active:scale-95 border-2 border-white/20">ПРЕДЛОЖИТЬ</button>`;
        }

        const cardOpacity = (p.isClassmate || p.isLimitReached) ? 'opacity-60 bg-[#152518]' : 'bg-[#1a2f1d]';
        const borderColor = (p.isClassmate || p.isLimitReached) ? 'border-[#2c3e30]' : 'border-[#60a846]';

        const el = document.createElement('div');
        el.className = `${cardOpacity} p-5 rounded-2xl border-2 ${borderColor} shadow-lg flex flex-col justify-between gap-4 relative overflow-hidden transition-all duration-300`;
        
        const deco = `<div class="absolute -right-4 -top-4 text-[#60a846] opacity-10 text-8xl pointer-events-none">🎄</div>`;

        el.innerHTML = `
            ${deco}
            <div class="flex items-center gap-4 relative z-10">
                 <div class="bg-[#fffdf5] rounded-full p-3 shadow-md border-2 border-[#e9c46a]">
                    <span class="text-4xl block leading-none">🎅</span>
                 </div>
                 <div class="leading-tight">
                    <div class="text-2xl font-bold text-[#fffdf5] tracking-wide text-shadow">Тайный Санта</div>
                    <div class="text-sm text-[#e9c46a] font-bold uppercase tracking-wider">Анонимный игрок</div>
                 </div>
            </div>
            
            <div class="flex justify-between items-center bg-[#0f1c11]/50 rounded-lg p-3 border border-[#60a846]/30 relative z-10">
                <div class="text-center w-1/2 border-r border-[#60a846]/30">
                    <div class="text-[10px] text-[#e9c46a] uppercase tracking-widest mb-1">Вы предл.</div>
                    <div class="text-xl font-bold ${p.outgoing >= 5 ? 'text-[#d64045]' : 'text-white'}">${p.outgoing}/5</div>
                </div>
                <div class="text-center w-1/2">
                    <div class="text-[10px] text-[#e9c46a] uppercase tracking-widest mb-1">Вам предл.</div>
                    <div class="text-xl font-bold ${p.incoming >= 5 ? 'text-[#d64045]' : 'text-white'}">${p.incoming}/5</div>
                </div>
            </div>

            <div class="relative z-10">
                ${btnHtml}
            </div>
        `;
        list.appendChild(el);
    });

    if (processedPlayers.length > visiblePlayersCount) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.innerText = `ПОКАЗАТЬ ЕЩЕ (${processedPlayers.length - visiblePlayersCount})`;
        loadMoreBtn.className = "w-full py-3 mt-4 rounded-xl border-2 border-[#e9c46a] text-[#e9c46a] font-bold uppercase hover:bg-[#e9c46a] hover:text-[#1a2f1d] transition";
        loadMoreBtn.onclick = () => {
            visiblePlayersCount += PLAYERS_PER_PAGE;
            refreshPlayersForDeals();
        };
        list.appendChild(loadMoreBtn);
    }
}

function calculateSortWeight(p) {
    if (p.has_pending) return -1;
    if (p.outgoing >= 5) return 10;
    if (p.is_classmate) return 20;
    return 0;
}

function checkIncomingDeals() {
    const deals = myDealsHistory.filter(d => d.receiver_id === myId && d.status === 'pending');
    const container = document.getElementById('incoming-deals');
    container.innerHTML = '';
    deals.forEach(deal => {
        const el = document.createElement('div');
        el.className = 'bg-[#e9c46a] border-4 border-white p-4 rounded-xl shadow-2xl animate-bounce-slow mb-4 text-[#1a2f1d]';
        el.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <span class="text-xl font-bold uppercase tracking-wider">🔔 Внимание!</span>
            </div>
            <div class="text-sm mb-3 font-bold">Кто-то вызывает вас на сделку!</div>
            <button onclick="openResponseModal('${deal.id}')" class="w-full py-3 rounded-lg bg-[#1a2f1d] text-[#e9c46a] font-bold shadow-md hover:scale-105 transition text-lg border-2 border-[#1a2f1d]">
                ОТКРЫТЬ
            </button>
        `;
        container.appendChild(el);
    });
}

function renderModalHistory(partnerId) {
    const container = document.getElementById('modal-history-list');
    container.innerHTML = '';

    const history = myDealsHistory.filter(d => 
        (d.initiator_id === myId && d.receiver_id === partnerId) || 
        (d.receiver_id === myId && d.initiator_id === partnerId)
    );
    history.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (history.length === 0) {
        container.innerHTML = '<div class="text-center text-[#e9c46a] py-6 italic text-sm opacity-70">История взаимодействий пуста...</div>';
        return;
    }

    history.forEach(d => {
        if (d.status === 'pending') return;

        const el = document.createElement('div');
        el.className = 'bg-[#0f1c11] p-3 rounded-lg border border-[#60a846]/50 flex justify-between items-center shadow-sm mb-2';

        const iamInitiator = d.initiator_id === myId;
        const myMove = iamInitiator ? d.initiator_move : d.receiver_move;
        const theirMove = iamInitiator ? d.receiver_move : d.initiator_move;
        const myPoints = iamInitiator ? d.points_initiator : d.points_receiver;

        const moveIcon = (m) => m === 'cooperate' ? '🤝' : '😈';
        const color = myPoints > 0 ? 'text-[#e9c46a]' : 'text-[#d64045]';

        el.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="text-[10px] text-[#60a846] uppercase font-bold">Вы</span>
                <span class="text-2xl">${moveIcon(myMove)}</span>
            </div>
            <div class="font-bold ${color} text-xl px-3 py-1 bg-black/30 rounded border border-white/10 min-w-[50px] text-center">${myPoints > 0 ? '+' : ''}${myPoints}</div>
            <div class="flex items-center gap-2">
                <span class="text-2xl">${moveIcon(theirMove)}</span>
                <span class="text-[10px] text-[#60a846] uppercase font-bold">Они</span>
            </div>
        `;
        container.appendChild(el);
    });
}

// --- МАГАЗИН И АДМИНКА ---
async function buyItem(itemName, cost) {
    if (!confirm(`Купить ${itemName} за ${cost} монет?`)) return;
    const btn = document.getElementById('btn-buy-bounty');
    btn.disabled = true; btn.innerText = "Магия...";
    const { data, error } = await supabaseClient.rpc('buy_item', { my_id: myId, item_label: itemName, cost: cost });
    if (error || (data && data.error)) { alert("❌ " + (error ? error.message : data.error)); btn.disabled = false; btn.innerText = "КУПИТЬ"; } 
    else { alert("✅ Успешно! Лесные духи приняли оплату."); checkShopStatus(); updateMyStats(); }
}

async function checkShopStatus() {
    const { data } = await supabaseClient.from('shop_orders').select('*').eq('player_id', myId).eq('status', 'pending');
    const btn = document.getElementById('btn-buy-bounty');
    const msg = document.getElementById('shop-status');
    if (data && data.length > 0) { btn.disabled = true; btn.classList.add('opacity-50', 'cursor-not-allowed'); btn.classList.remove('btn-primary'); btn.innerText = "ЖДЕМ ВЫДАЧИ..."; msg.classList.remove('hidden'); } 
    else { btn.disabled = false; btn.classList.remove('opacity-50', 'cursor-not-allowed'); btn.classList.add('btn-primary'); btn.innerText = "КУПИТЬ"; msg.classList.add('hidden'); }
}

async function loadAdminOrders() {
    if (document.getElementById('tab-content-admin').classList.contains('hidden')) return;
    const { data: orders } = await supabaseClient.rpc('get_admin_orders');
    const container = document.getElementById('admin-orders-list');
    container.innerHTML = '';
    if (!orders || orders.length === 0) { container.innerHTML = '<p class="text-[#e9c46a] text-center text-sm opacity-70">Корзина пуста</p>'; return; }
    orders.forEach(order => {
        const el = document.createElement('div');
        el.className = 'bg-[#1a2f1d] p-4 rounded-xl border-2 border-[#60a846] flex justify-between items-center shadow-md';
        el.innerHTML = `<div><div class="font-bold text-white text-lg">${order.player_name}</div><div class="text-sm text-[#e9c46a] font-bold">Покупка: ${order.item_name}</div></div><button onclick="deliverOrder('${order.id}')" class="bg-[#e9c46a] hover:bg-[#d4a373] text-[#1a2f1d] font-bold py-2 px-4 rounded-lg shadow-md text-sm uppercase">Выдать</button>`;
        container.appendChild(el);
    });
}
window.deliverOrder = async function(orderId) { if(!confirm("Выдать товар?")) return; const { error } = await supabaseClient.rpc('deliver_order', { order_uuid: orderId }); if(!error) loadAdminOrders(); };

async function loadLeaderboard(limit, tableId) {
    // [ИСПРАВЛЕНО] Используем RPC вместо прямого SELECT, так как прямой доступ закрыт
    const { data: players, error } = await supabaseClient.rpc('get_leaderboard', { limit_count: limit });

    if (error) {
        console.error("Ошибка загрузки рейтинга:", error);
        return;
    }

    const container = document.getElementById(tableId).tagName === 'TABLE' ? document.getElementById(tableId).tBodies[0] || document.getElementById(tableId) : document.getElementById(tableId);
    container.innerHTML = '';
    
    if (!players || players.length === 0) {
        container.innerHTML = '<tr><td colspan="4" class="text-center text-[#e9c46a] py-4">Список пуст...</td></tr>';
        return;
    }

    players.forEach((p, index) => {
        const row = document.createElement('tr');
        let rankColor = "text-[#fffdf5]/70";
        if (index === 0) rankColor = "text-[#e9c46a] font-bold text-lg";
        if (index === 1) rankColor = "text-[#e0e0e0] font-bold";
        if (index === 2) rankColor = "text-[#cd7f32] font-bold";
        
        row.innerHTML = `
            <td class="${rankColor} text-center">${index + 1}</td>
            <td class="text-[#fffdf5] font-medium tracking-wide">${p.last_name} ${p.first_name}</td>
            <td class="text-xs text-[#e9c46a] font-bold opacity-80">${p.class_name}</td>
            <td class="text-right text-[#e9c46a] font-bold text-lg tracking-wider">${p.coins}</td>
        `;
        container.appendChild(row);
    });
}

// --- МОДАЛКИ ---
window.openDealModal = (targetId) => { currentTargetId = targetId; respondingToDealId = null; renderModalHistory(targetId); document.getElementById('modal-title').innerText = "Предложить сделку"; document.getElementById('modal-move').classList.remove('hidden'); document.getElementById('modal-move').classList.add('flex'); };
window.openResponseModal = (dealId) => { respondingToDealId = dealId; currentTargetId = null; const partnerId = getPartnerIdFromDeal(dealId); if(partnerId) renderModalHistory(partnerId); document.getElementById('modal-title').innerText = "Ваш ответ?"; document.getElementById('modal-move').classList.remove('hidden'); document.getElementById('modal-move').classList.add('flex'); };
window.closeModal = () => { document.getElementById('modal-move').classList.add('hidden'); document.getElementById('modal-move').classList.remove('flex'); };
window.makeMove = async (moveType) => { closeModal(); if (currentTargetId) { const { data } = await supabaseClient.rpc('create_deal', { my_id: myId, target_id: currentTargetId, my_move: moveType }); if (data && data.error) alert("❌ " + data.error); else alert("✅ Предложение отправлено!"); } else if (respondingToDealId) { const { data } = await supabaseClient.rpc('accept_deal', { deal_id_input: respondingToDealId, responder_id: myId, responder_move_input: moveType }); if (data && data.error) alert("❌ " + data.error); else { alert(`✅ Результат: ${data.p2_change > 0 ? '+' : ''}${data.p2_change}`); fetchAllMyDeals(); updateMyStats(); } } };

function createSnow() { const container = document.getElementById('snow-container'); if(!container) return; for(let i=0; i<25; i++){ const div = document.createElement('div'); div.classList.add('snowflake'); div.innerHTML = '❄'; div.style.left = Math.random() * 100 + 'vw'; div.style.animationDuration = (Math.random() * 5 + 5) + 's'; div.style.opacity = Math.random(); div.style.fontSize = (Math.random() * 10 + 8) + 'px'; container.appendChild(div); } }