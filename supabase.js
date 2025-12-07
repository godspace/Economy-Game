import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://wlubnllzycgtmvitgvmd.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsdWJubGx6eWNndG12aXRndm1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMDIwOTYsImV4cCI6MjA4MDY3ODA5Nn0.ZwUIdUDHpaC2D2MDEcYDRf4vTXtMrLSCHK_foVSCZiY'

export const supabase = createClient(supabaseUrl, supabaseKey)

export const setPlayerCode = (code) => {
    localStorage.setItem('player_code', code)
}

export const getPlayerCode = () => {
    return localStorage.getItem('player_code')
}

export const clearPlayerCode = () => {
    localStorage.removeItem('player_code')
}