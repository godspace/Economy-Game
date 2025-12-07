import { supabase, getPlayerCode } from './supabase.js'

export async function loadPendingDeals() {
    const playerCode = getPlayerCode()
    if (!playerCode) return

    try {
        // Получаем текущего игрока
        const { data: currentPlayer } = await supabase
            .from('players')
            .select('id')
            .eq('code', playerCode)
            .single()

        if (!currentPlayer) return

        // Получаем ожидающие сделки
        const { data: deals, error } = await supabase
            .from('deals')
            .select(`
                *,
                from_player:players!deals_from_player_id_fkey (
                    id,
                    color
                )
            `)
            .eq('to_player_id', currentPlayer.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })

        if (error) throw error

        const pendingList = document.getElementById('pending-deals')
        pendingList.innerHTML = ''

        if (deals && deals.length > 0) {
            deals.forEach(deal => {
                const dealItem = document.createElement('div')
                dealItem.className = 'deal-item'
                dealItem.innerHTML = `
                    <div class="deal-partner">
                        <div class="player-color" style="background-color: ${deal.from_player.color};"></div>
                        <span>Игрок предлагает сделку</span>
                    </div>
                    <button class="accept-btn" data-deal-id="${deal.id}">
                        Принять
                    </button>
                `
                pendingList.appendChild(dealItem)
            })

            // Добавляем обработчики кнопок
            document.querySelectorAll('.accept-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const dealId = e.target.dataset.dealId
                    await openDealAcceptModal(dealId)
                })
            })
        } else {
            pendingList.innerHTML = '<div class="deal-item">Нет ожидающих сделок</div>'
        }
    } catch (error) {
        console.error('Ошибка загрузки ожидающих сделок:', error)
    }
}

export async function loadCompletedDeals() {
    const playerCode = getPlayerCode()
    if (!playerCode) return

    try {
        const { data: currentPlayer } = await supabase
            .from('players')
            .select('id')
            .eq('code', playerCode)
            .single()

        if (!currentPlayer) return

        // Получаем завершенные сделки
        const { data: deals, error } = await supabase
            .from('deals')
            .select(`
                *,
                from_player:players!deals_from_player_id_fkey (
                    id,
                    color
                ),
                to_player:players!deals_to_player_id_fkey (
                    id,
                    color
                )
            `)
            .eq('status', 'completed')
            .or(`from_player_id.eq.${currentPlayer.id},to_player_id.eq.${currentPlayer.id}`)
            .order('completed_at', { ascending: false })
            .limit(20)

        if (error) throw error

        const completedList = document.getElementById('completed-deals')
        completedList.innerHTML = ''

        if (deals && deals.length > 0) {
            deals.forEach(deal => {
                const isIncoming = deal.to_player_id === currentPlayer.id
                const partnerColor = isIncoming ? deal.from_player.color : deal.to_player.color
                
                let resultText = ''
                if (deal.from_choice === 'cooperate' && deal.to_choice === 'cooperate') {
                    resultText = 'Оба сотрудничали'
                } else if (deal.from_choice === 'cooperate' && deal.to_choice === 'cheat') {
                    resultText = isIncoming ? 'Вас обманули' : 'Вы обманули'
                } else if (deal.from_choice === 'cheat' && deal.to_choice === 'cooperate') {
                    resultText = isIncoming ? 'Вы обманули' : 'Вас обманули'
                } else {
                    resultText = 'Оба обманули'
                }

                const coinsChange = isIncoming ? deal.coins_to : deal.coins_from
                const coinsText = coinsChange > 0 ? `+${coinsChange}` : coinsChange

                const dealItem = document.createElement('div')
                dealItem.className = 'deal-item'
                dealItem.innerHTML = `
                    <div class="deal-partner">
                        <div class="player-color" style="background-color: ${partnerColor};"></div>
                        <div>
                            <div>${isIncoming ? 'Входящая' : 'Исходящая'} сделка</div>
                            <small>${resultText}</small>
                        </div>
                    </div>
                    <div style="font-weight: 600; color: ${coinsChange > 0 ? '#4cd964' : '#ff4757'}">
                        ${coinsText} монет
                    </div>
                `
                completedList.appendChild(dealItem)
            })
        } else {
            completedList.innerHTML = '<div class="deal-item">Нет завершённых сделок</div>'
        }
    } catch (error) {
        console.error('Ошибка загрузки истории сделок:', error)
    }
}

async function openDealAcceptModal(dealId) {
    const playerCode = getPlayerCode()
    if (!playerCode) return

    try {
        // Получаем данные сделки
        const { data: deal, error } = await supabase
            .from('deals')
            .select(`
                *,
                from_player:players!deals_from_player_id_fkey (
                    id,
                    color
                )
            `)
            .eq('id', dealId)
            .single()

        if (error) throw error

        // Получаем текущего игрока
        const { data: currentPlayer } = await supabase
            .from('players')
            .select('id')
            .eq('code', playerCode)
            .single()

        if (!currentPlayer) return

        // Загружаем историю сделок с этим игроком
        const { data: history } = await supabase
            .from('deals')
            .select('*')
            .or(`and(from_player_id.eq.${deal.from_player_id},to_player_id.eq.${currentPlayer.id}),and(from_player_id.eq.${currentPlayer.id},to_player_id.eq.${deal.from_player_id})`)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })

        // Обновляем модальное окно
        document.getElementById('deal-partner').textContent = 'Игрок'
        document.getElementById('deal-partner').style.color = deal.from_player.color

        const historyList = document.getElementById('deal-history-list')
        historyList.innerHTML = ''

        if (history && history.length > 0) {
            history.forEach(h => {
                const isIncoming = h.from_player_id === deal.from_player_id
                const historyItem = document.createElement('div')
                historyItem.className = 'history-item'
                
                let resultText = ''
                if (h.from_choice === 'cooperate' && h.to_choice === 'cooperate') {
                    resultText = 'Оба сотрудничали: +2/+2'
                } else if (h.from_choice === 'cooperate' && h.to_choice === 'cheat') {
                    resultText = isIncoming ? 'Вы доверяли: -1, партнёр жульничал: +3' : 'Вы жульничали: +3, партнёр доверял: -1'
                } else if (h.from_choice === 'cheat' && h.to_choice === 'cooperate') {
                    resultText = isIncoming ? 'Вы жульничали: +3, партнёр доверял: -1' : 'Вы доверяли: -1, партнёр жульничал: +3'
                } else {
                    resultText = 'Оба жульничали: -1/-1'
                }

                historyItem.innerHTML = `
                    <div>${isIncoming ? 'Входящая' : 'Исходящая'}</div>
                    <div>${resultText}</div>
                `
                historyList.appendChild(historyItem)
            })
        } else {
            historyList.innerHTML = '<div class="history-item">Нет завершённых сделок с этим игроком</div>'
        }

        // Показываем модальное окно
        const modal = document.getElementById('deal-modal')
        modal.classList.add('active')

        // Обработчики выбора
        const choiceButtons = modal.querySelectorAll('.choice-btn')
        choiceButtons.forEach(btn => {
            btn.onclick = async () => {
                const choice = btn.dataset.choice
                await completeDeal(dealId, choice)
                modal.classList.remove('active')
            }
        })

    } catch (error) {
        console.error('Ошибка открытия модального окна:', error)
        alert('Ошибка при загрузке данных сделки')
    }
}

async function completeDeal(dealId, choice) {
    try {
        const { data, error } = await supabase.rpc('complete_deal', {
            deal_uuid: dealId,
            choice: choice
        })

        if (error) {
            alert('Ошибка при завершении сделки: ' + error.message)
        } else if (data && data.error) {
            alert(data.error)
        } else {
            alert('Сделка завершена!')
            // Обновляем все списки
            loadPendingDeals()
            loadCompletedDeals()
            
            // Обновляем счет монет
            const playerCode = getPlayerCode()
            if (playerCode) {
                const { data: player } = await supabase
                    .from('players')
                    .select('coins')
                    .eq('code', playerCode)
                    .single()
                
                if (player) {
                    document.getElementById('coins-count').textContent = player.coins
                }
            }
        }
    } catch (error) {
        console.error('Ошибка завершения сделки:', error)
        alert('Ошибка при завершении сделки')
    }
}