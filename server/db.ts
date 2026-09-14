import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://vgwxbwbscyxkwwpmifag.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnd3hid2JzY3l4a3d3cG1pZmFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTUwMjgsImV4cCI6MjEwNDM3MTAyOH0.HO34ZW0q_Ij-mRzs2cA3x0C4Ym_CLlFNL1SBvqnROY0'

export const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})

export function normalize(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}
