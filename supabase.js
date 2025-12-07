import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Утилиты для работы с контекстом
export const setPlayerCode = (code) => {
    localStorage.setItem('player_code', code)
}

export const getPlayerCode = () => {
    return localStorage.getItem('player_code')
}

export const clearPlayerCode = () => {
    localStorage.removeItem('player_code')
}