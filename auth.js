import { supabase, setPlayerCode, clearPlayerCode } from './supabase.js'

export async function loginPlayer(code) {
    try {
        // Вызываем функцию входа на сервере
        const { data, error } = await supabase.rpc('player_login', {
            login_code: code
        })
        
        if (error) {
            console.error('Ошибка входа:', error)
            return { success: false, error: error.message }
        }
        
        if (data && data.error) {
            return { success: false, error: data.error }
        }
        
        if (!data || !data.success) {
            return { success: false, error: 'Неверный код игрока' }
        }
        
        // Сохраняем код игрока
        setPlayerCode(code)
        
        return { 
            success: true, 
            player: data.player,
            message: 'Успешный вход!'
        }
    } catch (error) {
        console.error('Ошибка входа:', error)
        return { success: false, error: 'Ошибка при входе в систему' }
    }
}

export function logoutPlayer() {
    clearPlayerCode()
}

export async function getCurrentPlayer(code) {
    const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('code', code)
        .single()
    
    if (error) {
        console.error('Ошибка получения данных игрока:', error)
        return { data: null, error }
    }
    
    return { data, error: null }
}