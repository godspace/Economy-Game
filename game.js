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

    btn.disabled = true; btn.innerText = "Связь с лесом..."; err.classList.add('hidden');

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
    if (confirm("Покинуть волшебный лес?")) {
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

async function updateMyStats() {
    const { data } = await supabase.from('players').select('coins').eq('id', myId).single();
    if (data) document.getElementById('my-coins').innerText = data.coins;
}

// --- СПИСОК ИГРОКОВ (КРУПНЫЕ КАРТОЧКИ) ---
async function refreshPlayersForDeals() {
    if (document.getElementById('tab-content-game').classList.contains('hidden')) return;

    const { data: players } = await supabase
        .from('players')
        .select('id, class_name') 
        .neq('id', myId)
        .eq('is_online', true);

    const list = document.getElementById('players-list');
    list.innerHTML = '';

    if (!players || players.length === 0) {
        list.innerHTML = '<p class="col-span-1 text-center text-[#6a994e] text-lg py-10 italic">В лесу пока тихо... Ждем эльфов.</p>';
        return;
    }

    players.forEach(p => {
        const outgoing = myDealsHistory.filter(d => d.initiator_id === myId && d.receiver_id === p.id).length;
        const incoming = myDealsHistory.filter(d => d.initiator_id === p.id && d.receiver_id === myId).length;
        const hasPendingDeal = myDealsHistory.some(d => d.initiator_id === myId && d.receiver_id === p.id && d.status === 'pending');
        
        const isClassmate = p.class_name === myClass;
        const isLimitReached = outgoing >= 5;

        // КНОПКИ (Увеличенные)
        let btnHtml = '';
        if (isClassmate) {
            btnHtml = `<button disabled class="w-full py-3 rounded-xl bg-[#2a4d31] text-[#6a994e] font-bold border border-[#6a994e] opacity-50 text-sm">🚫 СВОЙ КЛАСС</button>`;
        } else if (isLimitReached) {
            btnHtml = `<button disabled class="w-full py-3 rounded-xl bg-[#2a4d31] text-[#6a994e] font-bold border border-[#6a994e] opacity-50 text-sm">🔒 ЛИМИТ (5)</button>`;
        } else if (hasPendingDeal) {
            btnHtml = `<button disabled class="w-full py-3 rounded-xl bg-[#a7c957]/20 text-[#a7c957] font-bold border border-[#a7c957] animate-pulse text-sm">⏳ ЖДЕМ ОТВЕТА...</button>`;
        } else {
            // АКТИВНАЯ КНОПКА
            btnHtml = `<button onclick="openDealModal('${p.id}')" class="w-full py-4 rounded-xl bg-[#bc4749] hover:bg-[#a33a3c] text-[#f2e8cf] text-lg font-bold shadow-lg transition active:scale-95 border-b-4 border-[#8f3234]">ПРЕДЛОЖИТЬ</button>`;
        }

        const el = document.createElement('div');
        // Карточка теперь Sage Green (#6a994e) но чуть темнее для фона
        el.className = 'bg-[#4a7036] p-5 rounded-2xl border-2 border-[#6a994e] shadow-lg flex flex-col justify-between gap-4 relative overflow-hidden';
        
        // Декор
        const deco = `<div class="absolute -right-4 -top-4 text-[#6a994e] opacity-30 text-8xl pointer-events-none">🎄</div>`;

        el.innerHTML = `
            ${deco}
            <div class="flex items-center gap-4 relative z-10">
                 <div class="bg-[#f2e8cf] rounded-full p-3 shadow-md">
                    <span class="text-4xl block leading-none">🎅</span>
                 </div>
                 <div class="leading-tight">
                    <div class="text-2xl font-bold text-[#f2e8cf] tracking-wide">Тайный Санта</div>
                    <div class="text-sm text-[#a7c957] font-bold uppercase tracking-wider">Анонимный игрок</div>
                 </div>
            </div>
            
            <div class="flex justify-between items-center bg-[#386641] rounded-lg p-3 border border-[#6a994e] relative z-10">
                <div class="text-center w-1/2 border-r border-[#6a994e]">
                    <div class="text-[10px] text-[#a7c957] uppercase tracking-widest mb-1">Вы предл.</div>
                    <div class="text-xl font-bold ${outgoing >= 5 ? 'text-[#bc4749]' : 'text-[#f2e8cf]'}">${outgoing}/5</div>
                </div>
                <div class="text-center w-1/2">
                    <div class="text-[10px] text-[#a7c957] uppercase tracking-widest mb-1">Вам предл.</div>
                    <div class="text-xl font-bold ${incoming >= 5 ? 'text-[#bc4749]' : 'text-[#f2e8cf]'}">${incoming}/5</div>
                </div>
            </div>

            <div class="relative z-10">
                ${btnHtml}
            </div>
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
        el.className = 'bg-[#a7c957] border-4 border-[#f2e8cf] p-4 rounded-xl shadow-xl animate-bounce-slow mb-4';
        el.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <span class="text-xl text-[#386641] font-bold uppercase">🔔 Внимание!</span>
            </div>
            <div class="text-sm text-[#386641] mb-3 font-bold">Кто-то вызывает вас на сделку!</div>
            <button onclick="openResponseModal('${deal.id}')" class="w-full py-3 rounded-lg bg-[#386641] text-[#f2e8cf] font-bold shadow-md hover:bg-[#2a4d31] transition text-lg">
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
        container.innerHTML = '<div class="text-center text-[#6a994e] py-6 italic text-sm">История чиста, как первый снег...</div>';
        return;
    }

    history.forEach(d => {
        if (d.status === 'pending') return;

        const el = document.createElement('div');
        el.className = 'bg-[#2a4d31] p-3 rounded-lg border border-[#4a7036] flex justify-between items-center shadow-sm';

        const iamInitiator = d.initiator_id === myId;
        const myMove = iamInitiator ? d.initiator_move : d.receiver_move;
        const theirMove = iamInitiator ? d.receiver_move : d.initiator_move;
        const myPoints = iamInitiator ? d.points_initiator : d.points_receiver;

        const moveIcon = (m) => m === 'cooperate' ? '🤝' : '😈';
        const color = myPoints > 0 ? 'text-[#a7c957]' : 'text-[#bc4749]';

        el.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="text-[10px] text-[#6a994e] uppercase">Вы</span>
                <span class="text-2xl">${moveIcon(myMove)}</span>
            </div>
            <div class="font-bold ${color} text-xl bg-[#0f1c11] px-3 py-1 rounded border border-[#6a994e]">${myPoints > 0 ? '+' : ''}${myPoints}</div>
            <div class="flex items-center gap-2">
                <span class="text-2xl">${moveIcon(theirMove)}</span>
                <span class="text-[10px] text-[#6a994e] uppercase">Они</span>
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
    const { data, error } = await supabase.rpc('buy_item', { my_id: myId, item_label: itemName, cost: cost });
    if (error || (data && data.error)) { alert("❌ " + (error ? error.message : data.error)); btn.disabled = false; btn.innerText = "КУПИТЬ"; } 
    else { alert("✅ Успешно! Лесные духи приняли оплату."); checkShopStatus(); updateMyStats(); }
}

async function checkShopStatus() {
    const { data } = await supabase.from('shop_orders').select('*').eq('player_id', myId).eq('status', 'pending');
    const btn = document.getElementById('btn-buy-bounty');
    const msg = document.getElementById('shop-status');
    if (data && data.length > 0) { btn.disabled = true; btn.classList.add('opacity-50', 'cursor-not-allowed'); btn.classList.remove('btn-primary'); btn.innerText = "ЖДЕМ ВЫДАЧИ..."; msg.classList.remove('hidden'); } 
    else { btn.disabled = false; btn.classList.remove('opacity-50', 'cursor-not-allowed'); btn.classList.add('btn-primary'); btn.innerText = "КУПИТЬ"; msg.classList.add('hidden'); }
}

async function loadAdminOrders() {
    if (document.getElementById('tab-content-admin').classList.contains('hidden')) return;
    const { data: orders } = await supabase.rpc('get_admin_orders');
    const container = document.getElementById('admin-orders-list');
    container.innerHTML = '';
    if (!orders || orders.length === 0) { container.innerHTML = '<p class="text-[#6a994e] text-center text-sm">Корзина пуста</p>'; return; }
    orders.forEach(order => {
        const el = document.createElement('div');
        el.className = 'bg-[#2a4d31] p-4 rounded-xl border border-[#6a994e] flex justify-between items-center';
        el.innerHTML = `<div><div class="font-bold text-champagne text-lg">${order.player_name}</div><div class="text-sm text-[#a7c957] font-bold">Покупка: ${order.item_name}</div></div><button onclick="deliverOrder('${order.id}')" class="bg-[#a7c957] hover:bg-[#8da34f] text-[#386641] font-bold py-2 px-4 rounded-lg shadow-md text-sm">ВЫДАТЬ</button>`;
        container.appendChild(el);
    });
}
window.deliverOrder = async function(orderId) { if(!confirm("Выдать товар?")) return; const { error } = await supabase.rpc('deliver_order', { order_uuid: orderId }); if(!error) loadAdminOrders(); };

async function loadLeaderboard(limit, tableId) {
    const { data: players } = await supabase.from('players').select('class_name, first_name, last_name, coins').order('coins', { ascending: false }).limit(limit);
    const container = document.getElementById(tableId).tagName === 'TABLE' ? document.getElementById(tableId).tBodies[0] || document.getElementById(tableId) : document.getElementById(tableId);
    container.innerHTML = '';
    if (!players) return;
    players.forEach((p, index) => {
        const row = document.createElement('tr');
        let rankColor = "text-[#f2e8cf]/70";
        if (index === 0) rankColor = "text-[#a7c957] font-bold scale-110 origin-left";
        if (index === 1) rankColor = "text-[#f2e8cf] font-bold";
        if (index === 2) rankColor = "text-[#bc4749] font-bold";
        row.innerHTML = `<td class="${rankColor} text-center">${index + 1}</td><td class="text-[#f2e8cf] font-medium">${p.last_name} ${p.first_name}</td><td class="text-xs text-[#6a994e] font-bold">${p.class_name}</td><td class="text-right text-[#a7c957] font-bold text-lg">${p.coins}</td>`;
        container.appendChild(row);
    });
}

// --- МОДАЛКИ ---
window.openDealModal = (targetId) => { currentTargetId = targetId; respondingToDealId = null; renderModalHistory(targetId); document.getElementById('modal-title').innerText = "Предложить сделку"; document.getElementById('modal-move').classList.remove('hidden'); document.getElementById('modal-move').classList.add('flex'); };
window.openResponseModal = (dealId) => { respondingToDealId = dealId; currentTargetId = null; const partnerId = getPartnerIdFromDeal(dealId); if(partnerId) renderModalHistory(partnerId); document.getElementById('modal-title').innerText = "Ваш ответ?"; document.getElementById('modal-move').classList.remove('hidden'); document.getElementById('modal-move').classList.add('flex'); };
window.closeModal = () => { document.getElementById('modal-move').classList.add('hidden'); document.getElementById('modal-move').classList.remove('flex'); };
window.makeMove = async (moveType) => { closeModal(); if (currentTargetId) { const { data } = await supabase.rpc('create_deal', { my_id: myId, target_id: currentTargetId, my_move: moveType }); if (data && data.error) alert("❌ " + data.error); else alert("✅ Предложение отправлено!"); } else if (respondingToDealId) { const { data } = await supabase.rpc('accept_deal', { deal_id_input: respondingToDealId, responder_id: myId, responder_move_input: moveType }); if (data && data.error) alert("❌ " + data.error); else { alert(`✅ Результат: ${data.p2_change > 0 ? '+' : ''}${data.p2_change}`); fetchAllMyDeals(); updateMyStats(); } } };
function createSnow() { const container = document.getElementById('snow-container'); if(!container) return; for(let i=0; i<25; i++){ const div = document.createElement('div'); div.classList.add('snowflake'); div.innerHTML = '❄'; div.style.left = Math.random() * 100 + 'vw'; div.style.animationDuration = (Math.random() * 5 + 5) + 's'; div.style.opacity = Math.random(); div.style.fontSize = (Math.random() * 10 + 8) + 'px'; container.appendChild(div); } }