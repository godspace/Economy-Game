import { supabase, getPlayerCode } from './supabase.js'

export async function loadPlayersList() {
    const playerCode = getPlayerCode()
    if (!playerCode) return

    try {
        // Получаем текущего игрока
        const { data: currentPlayer, error: playerError } = await supabase
            .from('players')
            .select('id')
            .eq('code', playerCode)
            .single()
        
        if (playerError) throw playerError

        // Получаем всех активных игроков кроме текущего
        const { data: players, error: playersError } = await supabase
            .from('players')
            .select('id, color, coins')
            .eq('is_active', true)
            .neq('code', playerCode)
        
        if (playersError) throw playersError

        const playersList = document.getElementById('players-list')
        playersList.innerHTML = ''

        // Для каждого игрока создаем карточку
        for (const player of players) {
            // Считаем количество сделок с этим игроком
            const { count: incomingCount } = await supabase
                .from('deals')
                .select('*', { count: 'exact', head: true })
                .eq('from_player_id', player.id)
                .eq('to_player_id', currentPlayer.id)
                .in('status', ['pending', 'completed'])

            const { count: outgoingCount } = await supabase
                .from('deals')
                .select('*', { count: 'exact', head: true })
                .eq('from_player_id', currentPlayer.id)
                .eq('to_player_id', player.id)
                .in('status', ['pending', 'completed'])

            const playerCard = document.createElement('div')
            playerCard.className = 'player-card'
            playerCard.innerHTML = `
                <div class="player-header">
                    <div class="player-color" style="background-color: ${player.color};"></div>
                    <div class="player-name">Игрок</div>
                </div>
                <div class="deal-indicators">
                    <div class="indicator">
                        <div class="label">Входящие сделки</div>
                        <div class="count">${incomingCount || 0}/5</div>
                    </div>
                    <div class="indicator">
                        <div class="label">Исходящие сделки</div>
                        <div class="count">${outgoingCount || 0}/5</div>
                    </div>
                </div>
                <button class="deal-btn" data-player-id="${player.id}">
                    Предложить сделку
                </button>
            `
            playersList.appendChild(playerCard)
        }

        // Добавляем обработчики кнопок сделок
        document.querySelectorAll('.deal-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const playerId = e.target.dataset.playerId
                openDealModal(playerId)
            })
        })

    } catch (error) {
        console.error('Ошибка загрузки списка игроков:', error)
    }
}

export async function openDealModal(partnerId) {
    const playerCode = getPlayerCode()
    if (!playerCode) return

    try {
        // Получаем данные текущего игрока и партнера
        const { data: currentPlayer } = await supabase
            .from('players')
            .select('id')
            .eq('code', playerCode)
            .single()

        const { data: partner } = await supabase
            .from('players')
            .select('id, color')
            .eq('id', partnerId)
            .single()

        if (!currentPlayer || !partner) return

        // Загружаем историю сделок
        const { data: history } = await supabase
            .from('deals')
            .select('*')
            .or(`and(from_player_id.eq.${currentPlayer.id},to_player_id.eq.${partner.id}),and(from_player_id.eq.${partner.id},to_player_id.eq.${currentPlayer.id})`)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })

        // Обновляем модальное окно
        document.getElementById('deal-partner').textContent = 'Игрок'
        document.getElementById('deal-partner').style.color = partner.color

        const historyList = document.getElementById('deal-history-list')
        historyList.innerHTML = ''

        if (history && history.length > 0) {
            history.forEach(deal => {
                const isIncoming = deal.from_player_id === partner.id
                const historyItem = document.createElement('div')
                historyItem.className = 'history-item'
                
                let resultText = ''
                if (deal.from_choice === 'cooperate' && deal.to_choice === 'cooperate') {
                    resultText = 'Оба сотрудничали: +2/+2'
                } else if (deal.from_choice === 'cooperate' && deal.to_choice === 'cheat') {
                    resultText = isIncoming ? 'Вы доверяли: -1, партнёр жульничал: +3' : 'Вы жульничали: +3, партнёр доверял: -1'
                } else if (deal.from_choice === 'cheat' && deal.to_choice === 'cooperate') {
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
                await createDeal(partner.id, choice)
                modal.classList.remove('active')
            }
        })

    } catch (error) {
        console.error('Ошибка открытия модального окна:', error)
    }
}

async function createDeal(partnerId, choice) {
    const playerCode = getPlayerCode()
    if (!playerCode) return

    try {
        // Получаем код партнера
        const { data: partner } = await supabase
            .from('players')
            .select('code')
            .eq('id', partnerId)
            .single()

        if (!partner) {
            alert('Игрок не найден')
            return
        }

        // Создаем сделку через RPC функцию
        const { data, error } = await supabase.rpc('create_deal', {
            to_player_code: partner.code,
            choice: choice
        })

        if (error) {
            alert('Ошибка при создании сделки: ' + error.message)
        } else if (data && data.error) {
            alert(data.error)
        } else {
            alert('Сделка предложена! Ждите ответа от игрока.')
            loadPlayersList() // Обновляем список
        }
    } catch (error) {
        console.error('Ошибка создания сделки:', error)
        alert('Ошибка при создании сделки')
    }
}