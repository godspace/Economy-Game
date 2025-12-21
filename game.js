// game.js

// --- 1. КОНФИГУРАЦИЯ ---
const SUPABASE_URL = 'https://ferhcoqknnobeesscvdv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlcmhjb3Frbm5vYmVlc3NjdmR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MjQ0NDUsImV4cCI6MjA4MTMwMDQ0NX0.pJB2oBN9Asp8mO0Od1lHD6sRjr-swoaJu5Z-ZJvw9jA';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 2. СОСТОЯНИЕ ---
let myId = localStorage.getItem('santa_id');
let myClass = localStorage.getItem('santa_class');
let myName = localStorage.getItem('santa_name'); 
let isAdmin = false;
let myDealsHistory = []; 
let currentTargetId = null;
let respondingToDealId = null;

let playersCache = {}; 
let currentTariffId = null; 
let allTransferTargets = []; // Кэш для перевода

let visiblePlayersCount = 25; 
const PLAYERS_PER_PAGE = 25;

// --- 3. ИНИЦИАЛИЗАЦИЯ ---
document.addEventListener('DOMContentLoaded', () => {
    createSnow();
    if (myId) {
        showGameScreen();
        startGameLoop();
    } else {
        // Загружаем лидерборд, даже если не вошли
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
        myName = `${data.first_name} ${data.last_name}`; 
        
        localStorage.setItem('santa_id', myId);
        localStorage.setItem('santa_class', data.class);
        localStorage.setItem('santa_name', myName); 
        
        location.reload(); 
    }
}

window.logout = async function() {
    if (confirm("Покинуть волшебный лес?")) {
        if (myId) await supabaseClient.rpc('logout_player', { player_uuid: myId });
        localStorage.removeItem('santa_id');
        localStorage.removeItem('santa_class');
        localStorage.removeItem('santa_name');
        location.reload();
    }
};

async function showGameScreen() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    
    document.getElementById('my-class').innerText = myClass || 'Elf';
    if(myName) document.getElementById('my-name').innerText = myName;

    updateMyStats(); 
}

// --- 5. ВКЛАДКИ ---
window.switchTab = function(tabName) {
    ['game', 'rating', 'shop', 'bank', 'admin'].forEach(t => {
        document.getElementById(`tab-content-${t}`).classList.add('hidden');
        document.getElementById(`tab-btn-${t}`).classList.remove('active');
    });

    document.getElementById(`tab-content-${tabName}`).classList.remove('hidden');
    document.getElementById(`tab-btn-${tabName}`).classList.add('active');

    if (tabName === 'rating') loadLeaderboard(50, 'main-leaderboard');
    if (tabName === 'shop') checkShopStatus();
    if (tabName === 'admin') loadAdminOrders();
    if (tabName === 'bank') { loadMyInvestments(); checkPendingTransfers(); }
};

// --- 6. ИГРОВОЙ ЦИКЛ ---
function startGameLoop() {
    refreshAllData();
    setInterval(refreshAllData, 3000);
}

function refreshAllData() {
    fetchAllMyDeals();
    updateMyStats();
    
    if (document.getElementById('tab-btn-bank').classList.contains('active')) {
        loadMyInvestments();
        checkPendingTransfers(); 
    }
    if (isAdmin && document.getElementById('tab-btn-admin').classList.contains('active')) loadAdminOrders();
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

async function updateMyStats() {
    const { data, error } = await supabaseClient.rpc('get_my_stats', { player_uuid: myId });
    if (data && !error) {
        document.getElementById('my-coins').innerText = data.coins;
        if (data.is_admin) {
            isAdmin = true;
            document.getElementById('tab-btn-admin').classList.remove('hidden');
        }
    }
}

// --- 7. СПИСОК ИГРОКОВ ---
async function refreshPlayersForDeals() {
    if (document.getElementById('tab-content-game').classList.contains('hidden')) return;

    const { data: players, error } = await supabaseClient.rpc('get_active_players', { my_id: myId });

    if (error) { console.error("Error players:", error); return; }

    const list = document.getElementById('players-list');
    list.innerHTML = '';

    if (!players || players.length === 0) {
        list.innerHTML = '<p class="text-center text-sage py-10 italic">В лесу пока тихо...</p>';
        return;
    }

    const processedPlayers = players.map(p => {
        const isLimit = p.outgoing >= 5 || p.incoming >= 5;
        
        const safeName = isLimit ? p.revealed_name : null;
        const safeClass = isLimit ? p.ret_class_name : null;

        playersCache[p.ret_id] = { 
            name: safeName, 
            className: safeClass, 
            limitReached: isLimit 
        };

        return {
            id: p.ret_id,
            outgoing: p.outgoing,
            incoming: p.incoming,
            hasPendingDeal: p.has_pending,
            isClassmate: p.is_classmate,
            revealedName: safeName, 
            isLimitReached: isLimit, 
            sortWeight: calculateSortWeight({ ...p, has_pending: p.has_pending, is_classmate: p.is_classmate, outgoing: p.outgoing })
        };
    });

    processedPlayers.sort((a, b) => a.sortWeight - b.sortWeight);
    const visiblePlayers = processedPlayers.slice(0, visiblePlayersCount);

    visiblePlayers.forEach(p => {
        let btnHtml = '';
        
        if (p.isClassmate) {
            btnHtml = `<button disabled class="w-full py-3 rounded-xl bg-[#1f3a24] text-[#6c757d] font-bold border border-[#495057] text-sm">🚫 СВОЙ КЛАСС</button>`;
        } else if (p.isLimitReached) {
            btnHtml = `<button onclick="openDealModal('${p.id}')" class="w-full py-3 rounded-xl bg-[#60a846] hover:bg-[#4a8236] text-[#1f3a24] font-bold border-b-4 border-[#3e6b2e] text-sm shadow-lg active:scale-95">📜 ИСТОРИЯ</button>`;
        } else if (p.hasPendingDeal) {
            btnHtml = `<button disabled class="w-full py-3 rounded-xl bg-[#e9c46a]/20 text-[#e9c46a] font-bold border border-[#e9c46a] animate-pulse text-sm">⏳ ЖДЕМ...</button>`;
        } else {
            btnHtml = `<button onclick="openDealModal('${p.id}')" class="w-full py-4 rounded-xl bg-gradient-to-r from-[#d64045] to-[#b02e33] hover:brightness-110 text-white text-lg font-bold shadow-lg active:scale-95 border-b-4 border-[#8f3234]">ПРЕДЛОЖИТЬ</button>`;
        }

        const isInactive = p.isClassmate;
        const cardOpacity = isInactive ? 'opacity-60 bg-[#1a2f1d]' : 'bg-[#2a4d31]';
        const displayName = p.revealedName ? p.revealedName : "Тайный Санта";
        const displayStatus = p.revealedName ? "✨ Личность раскрыта!" : "Анонимный игрок";
        const nameColor = p.revealedName ? "text-yellow-green" : "text-champagne";

        const el = document.createElement('div');
        el.className = `${cardOpacity} p-5 rounded-2xl border-2 border-[#60a846] shadow-lg flex flex-col justify-between gap-4 relative overflow-hidden transition-all duration-300`;
        
        el.innerHTML = `
            <div class="flex items-center gap-4 relative z-10">
                 <div class="bg-[#fffdf5] rounded-full p-3 shadow-md border-2 border-[#e9c46a] text-[#1a2f1d]"><span class="text-4xl block leading-none">🎅</span></div>
                 <div class="leading-tight">
                    <div class="text-xl font-bold ${nameColor} tracking-wide drop-shadow-md">${displayName}</div>
                    <div class="text-xs text-sage font-bold uppercase tracking-wider">${displayStatus}</div>
                 </div>
            </div>
            <div class="flex justify-between items-center bg-[#1f3a24] rounded-lg p-2 border border-[#60a846]/30 relative z-10">
                <div class="text-center w-1/2 border-r border-[#60a846]/30"><div class="text-[9px] text-sage uppercase tracking-widest mb-1">Вы предл.</div><div class="text-lg font-bold ${p.outgoing >= 5 ? 'text-brick' : 'text-champagne'}">${p.outgoing}/5</div></div>
                <div class="text-center w-1/2"><div class="text-[9px] text-sage uppercase tracking-widest mb-1">Вам предл.</div><div class="text-lg font-bold ${p.incoming >= 5 ? 'text-brick' : 'text-champagne'}">${p.incoming}/5</div></div>
            </div>
            <div class="relative z-10">${btnHtml}</div>`;
        list.appendChild(el);
    });

    if (processedPlayers.length > visiblePlayersCount) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.innerText = `ПОКАЗАТЬ ЕЩЕ (${processedPlayers.length - visiblePlayersCount})`;
        loadMoreBtn.className = "w-full py-3 mt-4 text-sage font-bold uppercase hover:text-yellow-green transition";
        loadMoreBtn.onclick = () => { visiblePlayersCount += PLAYERS_PER_PAGE; refreshPlayersForDeals(); };
        list.appendChild(loadMoreBtn);
    }
}

function calculateSortWeight(p) {
    if (p.has_pending) return -1;
    if (p.outgoing >= 5 || p.incoming >= 5) return 10;
    if (p.is_classmate) return 20;
    return 0;
}

function checkIncomingDeals() {
    const deals = myDealsHistory.filter(d => d.receiver_id === myId && d.status === 'pending');
    const container = document.getElementById('incoming-deals');
    container.innerHTML = '';
    deals.forEach(deal => {
        const el = document.createElement('div');
        el.className = 'bg-gradient-to-r from-[#e9c46a] to-[#d4a373] p-4 rounded-xl shadow-xl animate-bounce-slow mb-4 text-[#1a2f1d] border-2 border-white';
        el.innerHTML = `<div class="flex justify-between items-center mb-1"><span class="text-lg font-bold uppercase tracking-wider">🔔 Внимание!</span></div><div class="text-sm mb-3 font-bold">Вас вызывают на сделку!</div><button onclick="openResponseModal('${deal.id}')" class="w-full py-3 rounded-lg bg-[#1a2f1d] text-[#e9c46a] font-bold shadow-md hover:scale-105 transition text-lg border border-[#1a2f1d]">ОТКРЫТЬ</button>`;
        container.appendChild(el);
    });
}

function renderModalHistory(partnerId) {
    const container = document.getElementById('modal-history-list');
    container.innerHTML = '';
    const history = myDealsHistory.filter(d => (d.initiator_id === myId && d.receiver_id === partnerId) || (d.receiver_id === myId && d.initiator_id === partnerId));
    history.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (history.length === 0) { container.innerHTML = '<div class="text-center text-sage/50 py-6 italic text-sm">История пуста...</div>'; return; }

    history.forEach(d => {
        if (d.status === 'pending') return;
        const el = document.createElement('div');
        el.className = 'bg-[#2a4d31] p-3 rounded-lg border border-[#60a846]/30 flex justify-between items-center shadow-sm mb-2';
        const iamInitiator = d.initiator_id === myId;
        const myMove = iamInitiator ? d.initiator_move : d.receiver_move;
        const theirMove = iamInitiator ? d.receiver_move : d.initiator_move;
        const myPoints = iamInitiator ? d.points_initiator : d.points_receiver;
        const moveIcon = (m) => m === 'cooperate' ? '🤝' : '😈';
        const color = myPoints > 0 ? 'text-yellow-green' : 'text-brick';
        el.innerHTML = `<div class="flex items-center gap-2"><span class="text-[10px] text-sage uppercase font-bold">Вы</span><span class="text-xl">${moveIcon(myMove)}</span></div><div class="font-bold ${color} text-lg px-3 py-1 bg-black/20 rounded min-w-[40px] text-center">${myPoints > 0 ? '+' : ''}${myPoints}</div><div class="flex items-center gap-2"><span class="text-xl">${moveIcon(theirMove)}</span><span class="text-[10px] text-sage uppercase font-bold">Они</span></div>`;
        container.appendChild(el);
    });
}

// --- 8. БАНК ---

window.openInvestModal = function(id, title, time, percent) {
    currentTariffId = id;
    document.getElementById('invest-title').innerText = title;
    document.getElementById('invest-percent').innerText = percent;
    document.getElementById('invest-amount').value = '';
    
    let min = 10;
    if(id === 'call') min = 34; 
    if(id === 'five') min = 20; 
    if(id === 'night') min = 10; 
    if(id === 'champion') min = 5; 
    
    document.getElementById('invest-amount').placeholder = `Минимум ${min}`;
    document.getElementById('modal-invest').classList.remove('hidden'); 
    document.getElementById('modal-invest').classList.add('flex');
};

window.confirmInvest = async function() {
    const amount = parseInt(document.getElementById('invest-amount').value);
    
    let min = 10;
    if(currentTariffId === 'call') min = 34;
    if(currentTariffId === 'five') min = 20;
    if(currentTariffId === 'night') min = 10;
    if(currentTariffId === 'champion') min = 5;

    if (!amount || amount < min) { alert(`Минимальная сумма для этого тарифа: ${min} монет`); return; }
    
    document.getElementById('modal-invest').classList.add('hidden'); 
    document.getElementById('modal-invest').classList.remove('flex');
    
    const { data, error } = await supabaseClient.rpc('create_investment', { my_id: myId, tariff: currentTariffId, amount: amount });
    if (error || (data && data.error)) alert("❌ Ошибка: " + (error ? error.message : data.error)); 
    else { alert("✅ Вклад открыт!"); updateMyStats(); loadMyInvestments(); }
};

async function loadMyInvestments() {
    const { data: investments } = await supabaseClient.rpc('get_my_investments', { my_id: myId });
    const list = document.getElementById('my-investments-list');
    const countEl = document.getElementById('active-invest-count');
    
    list.innerHTML = '';
    
    if (!investments || investments.length === 0) { 
        list.innerHTML = '<div class="text-center text-[#fffdf5]/30 py-4 text-sm italic">Портфель пуст</div>'; 
        countEl.innerText = '0'; return; 
    }
    
    let activeCount = 0;
    investments.forEach(inv => {
        if (inv.status === 'collected') return;
        activeCount++;
        
        const unlockDate = new Date(inv.unlock_at);
        const isReady = new Date() >= unlockDate;
        const timeLeftMs = unlockDate - new Date();
        
        let icon = '💰', title = 'Вклад';
        if(inv.tariff_id === 'call') { title = 'По звонку'; icon = '🔔'; }
        if(inv.tariff_id === 'five') { title = 'Пятёрка'; icon = '🖐️'; }
        if(inv.tariff_id === 'night') { title = 'Ночь'; icon = '🌙'; }
        if(inv.tariff_id === 'champion') { title = 'Чемпион'; icon = '🏆'; }
        if(inv.tariff_id === 'crypto') { title = 'Crypto'; icon = '💀'; }
        
        // Стили для карточки
        let cardClass = "bg-[#1f3a24] p-4 rounded-xl border border-[#60a846]/30 relative transition-all duration-300";
        if (isReady) cardClass += " invest-ready"; // Добавляем пульсацию
        if (inv.tariff_id === 'crypto') cardClass += " border-[#d64045]/50";

        // Кнопка или Таймер
        let actionHtml = '';
        if (isReady) {
            actionHtml = `
                <div class="mt-3 flex items-center justify-between bg-black/20 p-2 rounded-lg">
                    <span class="text-[#e9c46a] font-bold text-sm ml-2">🎉 Готово к выдаче!</span>
                    <button onclick="collectMoney('${inv.id}')" class="bg-[#e9c46a] hover:bg-[#d4a373] text-[#1a2f1d] font-bold py-2 px-6 rounded-lg shadow-lg active:scale-95 transition border-b-4 border-[#b58b38] uppercase text-sm">
                        ЗАБРАТЬ
                    </button>
                </div>
            `;
        } else {
            const hours = Math.floor(timeLeftMs / 3600000);
            const minutes = Math.floor((timeLeftMs % 3600000) / 60000);
            const minStr = minutes < 10 ? '0' + minutes : minutes;
            actionHtml = `<div class="mt-2 text-right text-xs text-[#e9c46a] font-mono opacity-80">⏳ ${hours}:${minStr}</div>`;
        }
        
        const el = document.createElement('div');
        el.className = cardClass;
        el.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex gap-3">
                    <span class="text-3xl bg-black/20 rounded-full p-2 h-12 w-12 flex items-center justify-center">${icon}</span>
                    <div>
                        <div class="font-bold text-[#fffdf5] text-base">${title}</div>
                        <div class="text-xs text-[#fffdf5]/60 mt-1">Вклад: <span class="text-[#e9c46a] font-bold">${inv.invested_amount}</span></div>
                    </div>
                </div>
                ${inv.tariff_id === 'crypto' ? '<span class="text-[10px] bg-[#d64045] text-white px-2 py-1 rounded font-bold">RISK</span>' : ''}
            </div>
            ${actionHtml}
        `;
        list.appendChild(el);
    });
    countEl.innerText = activeCount;
}

window.collectMoney = async function(invId) {
    const { data, error } = await supabaseClient.rpc('collect_investment', { invest_id: invId, my_id: myId });
    if (error || (data && data.error)) alert("Ошибка: " + (error ? error.message : data.error)); 
    else { alert(`Результат: ${data.profit > 0 ? '+' : ''}${data.profit} монет`); updateMyStats(); loadMyInvestments(); }
};

// --- 9. ПЕРЕВОДЫ ---

async function checkPendingTransfers() {
    const container = document.getElementById('incoming-transfers');
    const { data: transfers } = await supabaseClient.rpc('get_my_transfers', { my_id: myId });
    
    container.innerHTML = '';
    
    if (transfers && transfers.length > 0) {
        transfers.forEach(tr => {
            const el = document.createElement('div');
            // Используем новый класс transfer-card из CSS
            el.className = 'transfer-card p-5 rounded-2xl mb-4 animate-fade-in';
            
            el.innerHTML = `
                <div class="flex justify-between items-center mb-4 relative z-10">
                    <div class="flex items-center gap-2">
                        <span class="text-2xl">💸</span>
                        <div>
                            <span class="text-[10px] text-[#e9c46a] font-bold uppercase tracking-widest block">Вам перевод</span>
                            <span class="text-[#fffdf5] font-bold text-sm">от ${tr.sender_name || 'Анонима'}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-3xl font-bold text-[#e9c46a] text-shadow">+${tr.amount}</span>
                    </div>
                </div>
                
                <button onclick="claimTransfer('${tr.id}')" class="relative z-10 w-full py-3 rounded-xl bg-[#60a846] hover:bg-[#4a8236] text-[#fffdf5] font-bold text-lg shadow-lg transition active:scale-95 border-b-4 border-[#3e6b2e] flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
                    ПРИНЯТЬ МОНЕТЫ
                </button>
            `;
            container.appendChild(el);
        });
    }
}

window.claimTransfer = async function(trId) {
    const { data, error } = await supabaseClient.rpc('claim_transfer', { tr_id: trId, my_id: myId });
    if (error || (data && data.error)) {
        alert("Ошибка: " + (error ? error.message : data.error));
    } else {
        alert(`✅ Получено ${data.amount} монет!`);
        updateMyStats();
        checkPendingTransfers();
    }
};

window.openTransferModal = async function() {
    const modal = document.getElementById('modal-transfer');
    const classSelect = document.getElementById('transfer-class');
    const studentSelect = document.getElementById('transfer-student');
    
    modal.classList.remove('hidden'); modal.classList.add('flex');
    classSelect.innerHTML = '<option value="">Загрузка...</option>';
    studentSelect.innerHTML = '<option value="">Сначала выберите класс</option>';
    studentSelect.disabled = true;

    const { data, error } = await supabaseClient.rpc('get_transfer_targets', { my_id: myId });
    if (error) { alert("Ошибка загрузки списка"); return; }
    
    allTransferTargets = data || [];
    const classes = [...new Set(allTransferTargets.map(p => p.class_name))].sort();

    classSelect.innerHTML = '<option value="">Выберите класс</option>';
    classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.innerText = c;
        classSelect.appendChild(opt);
    });
};

window.filterTransferStudents = function() {
    const selectedClass = document.getElementById('transfer-class').value;
    const studentSelect = document.getElementById('transfer-student');
    
    studentSelect.innerHTML = '<option value="">Выберите ученика</option>';
    
    if (!selectedClass) { studentSelect.disabled = true; return; }

    studentSelect.disabled = false;
    const studentsInClass = allTransferTargets.filter(p => p.class_name === selectedClass);
    
    studentsInClass.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id; opt.innerText = `${p.last_name} ${p.first_name}`;
        studentSelect.appendChild(opt);
    });
};

window.confirmTransfer = async function() {
    const targetId = document.getElementById('transfer-student').value;
    const amount = parseInt(document.getElementById('transfer-amount').value);
    
    if (!targetId) { alert("Выберите получателя"); return; }
    if (!amount || amount <= 0) { alert("Введите сумму больше 0"); return; }
    if (!confirm(`Перевести ${amount} монет?`)) return;

    document.getElementById('modal-transfer').classList.add('hidden'); document.getElementById('modal-transfer').classList.remove('flex');
    
    const { data, error } = await supabaseClient.rpc('transfer_coins', { sender_id: myId, recipient_id: targetId, amount: amount });

    if (error || (data && data.error)) alert("❌ " + (error ? error.message : data.error)); 
    else { alert("✅ Перевод отправлен! Получатель должен принять его в Банке."); updateMyStats(); }
};

// --- ОСТАЛЬНОЕ (Магазин, Админка, Модалки) ---
async function buyItem(itemName, cost) {
    if (!confirm(`Купить ${itemName} за ${cost} монет?`)) return;
    const { data, error } = await supabaseClient.rpc('buy_item', { my_id: myId, item_label: itemName, cost: cost });
    if (error || (data && data.error)) alert("❌ " + (error ? error.message : data.error)); 
    else { alert("✅ Успешно!"); checkShopStatus(); updateMyStats(); }
}

async function checkShopStatus() {
    const { data } = await supabaseClient.from('shop_orders').select('*').eq('player_id', myId).eq('status', 'pending');
    const btn = document.getElementById('btn-buy-bounty');
    const msg = document.getElementById('shop-status');
    if (data && data.length > 0) { btn.disabled = true; btn.innerText = "ЖДЕМ..."; msg.classList.remove('hidden'); } 
    else { btn.disabled = false; btn.innerText = "КУПИТЬ"; msg.classList.add('hidden'); }
}

async function loadAdminOrders() {
    const { data: orders } = await supabaseClient.rpc('get_admin_orders');
    const container = document.getElementById('admin-orders-list');
    container.innerHTML = '';
    if (!orders || orders.length === 0) { container.innerHTML = '<p class="text-center text-sage">Пусто</p>'; return; }
    orders.forEach(order => {
        const el = document.createElement('div');
        el.className = 'bg-[#1f3a24] p-3 rounded-lg flex justify-between items-center';
        el.innerHTML = `<div><div class="font-bold text-champagne">${order.player_name}</div><div class="text-xs text-sage">${order.item_name}</div></div><button onclick="deliverOrder('${order.id}')" class="bg-yellow-green text-[#1a2f1d] px-3 py-1 rounded font-bold text-xs">ВЫДАТЬ</button>`;
        container.appendChild(el);
    });
}
window.deliverOrder = async function(orderId) { if(confirm("Выдать?")) { await supabaseClient.rpc('deliver_order', { order_uuid: orderId }); loadAdminOrders(); } };

// [ИСПРАВЛЕНО] Безопасная функция загрузки таблицы
async function loadLeaderboard(limit, tableId) {
    const { data: players, error } = await supabaseClient.rpc('get_leaderboard', { limit_count: limit });
    if (error) { console.error("Ошибка рейтинга:", error); return; }

    const table = document.getElementById(tableId);
    if (!table) return;

    let container;
    if (table.tagName === 'TABLE') {
        container = table.tBodies[0];
        if (!container) container = table.createTBody();
    } else {
        container = table;
    }

    container.innerHTML = '';
    
    if (!players || players.length === 0) {
        container.innerHTML = '<tr><td colspan="4" class="text-center p-4 opacity-50">Список пуст...</td></tr>';
        return;
    }

    players.forEach((p, index) => {
        const row = document.createElement('tr');
        
        // Определяем стили для Топ-3
        let rowClass = "leaderboard-row text-sm";
        let rankDisplay = index + 1;
        let icon = "";

        if (index === 0) {
            rowClass += " rank-1";
            icon = "👑";
        } else if (index === 1) {
            rowClass += " rank-2";
            icon = "🥈";
        } else if (index === 2) {
            rowClass += " rank-3";
            icon = "🥉";
        }

        row.className = rowClass;
        
        row.innerHTML = `
            <td class="p-3 font-bold rank-num text-center w-12">${rankDisplay}</td>
            <td class="p-3">
                <div class="font-bold text-[#fffdf5] flex items-center gap-2">
                    ${p.last_name} ${p.first_name} ${icon}
                </div>
            </td>
            <td class="p-3 text-xs text-[#60a846] font-bold uppercase">${p.class_name}</td>
            <td class="p-3 text-right">
                <span class="font-mono text-[#e9c46a] font-bold text-lg">${p.coins}</span>
            </td>
        `;
        container.appendChild(row);
    });
}

window.openDealModal = (targetId) => { 
    currentTargetId = targetId; respondingToDealId = null; renderModalHistory(targetId); 
    const pData = playersCache[targetId];
    const modalTitle = document.getElementById('modal-title');
    const actionsDiv = document.getElementById('modal-actions');
    const tipsText = document.getElementById('modal-tips');

    if (pData && pData.limitReached) {
        // ИСТОРИЯ
        const classSuffix = pData.className ? ` (${pData.className})` : '';
        modalTitle.innerText = pData.name ? `Архив: ${pData.name}${classSuffix}` : "Архив сделок";
        if(actionsDiv) actionsDiv.classList.add('hidden');
        if(tipsText) tipsText.classList.add('hidden');
    } else {
        // ИГРА (Скрыто)
        modalTitle.innerText = "Предложить сделку";
        if(actionsDiv) actionsDiv.classList.remove('hidden');
        if(tipsText) tipsText.classList.remove('hidden');
    }
    document.getElementById('modal-move').classList.remove('hidden'); document.getElementById('modal-move').classList.add('flex'); 
};

window.openResponseModal = (dealId) => { 
    respondingToDealId = dealId; currentTargetId = null; 
    const partnerId = getPartnerIdFromDeal(dealId); 
    if(partnerId) { renderModalHistory(partnerId); document.getElementById('modal-title').innerText = "Ваш ответ?"; }
    const actionsDiv = document.getElementById('modal-actions');
    const tipsText = document.getElementById('modal-tips');
    if(actionsDiv) actionsDiv.classList.remove('hidden');
    if(tipsText) tipsText.classList.remove('hidden');
    document.getElementById('modal-move').classList.remove('hidden'); document.getElementById('modal-move').classList.add('flex'); 
};

window.closeModal = () => { document.getElementById('modal-move').classList.add('hidden'); document.getElementById('modal-move').classList.remove('flex'); };

window.makeMove = async (moveType) => { 
    closeModal(); 
    if (currentTargetId) { const { data } = await supabaseClient.rpc('create_deal', { my_id: myId, target_id: currentTargetId, my_move: moveType }); if (data && data.error) alert("❌ " + data.error); else alert("✅ Предложение отправлено!"); } 
    else if (respondingToDealId) { const { data } = await supabaseClient.rpc('accept_deal', { deal_id_input: respondingToDealId, responder_id: myId, responder_move_input: moveType }); if (data && data.error) alert("❌ " + data.error); else { alert(`✅ Результат: ${data.p2_change > 0 ? '+' : ''}${data.p2_change}`); fetchAllMyDeals(); updateMyStats(); } } 
};

function createSnow() { const container = document.getElementById('snow-container'); if(!container) return; for(let i=0; i<25; i++){ const div = document.createElement('div'); div.classList.add('snowflake'); div.innerHTML = '❄'; div.style.left = Math.random() * 100 + 'vw'; div.style.animationDuration = (Math.random() * 5 + 5) + 's'; div.style.opacity = Math.random(); div.style.fontSize = (Math.random() * 10 + 8) + 'px'; container.appendChild(div); } }