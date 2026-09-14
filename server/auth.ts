import { Router, type Request, type Response, type NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import { db } from './db.js'

export const authRouter = Router()

// ── Supabase-backed session store (works across serverless instances) ─────────
const SESSION_COOKIE = 'fc_session'
const SESSION_TTL_SEC = 8 * 60 * 60 // 8 hours in seconds

function makeId() {
  return [...Array(32)].map(() => Math.floor(Math.random() * 36).toString(36)).join('')
}

function getCookieId(req: Request): string | null {
  const raw = req.headers.cookie?.split(';').map((c) => c.trim())
    .find((c) => c.startsWith(SESSION_COOKIE + '='))
  return raw ? raw.slice(SESSION_COOKIE.length + 1) : null
}

async function getSession(req: Request) {
  const id = getCookieId(req)
  if (!id) return null
  const { data } = await db.from('sessions')
    .select('user_id,role,username')
    .eq('id', id)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (!data) return null
  return { id, userId: data.user_id, role: data.role, username: data.username }
}

async function setSession(res: Response, data: { userId: number; role: string; username: string }) {
  const id = makeId()
  const expiresAt = new Date(Date.now() + SESSION_TTL_SEC * 1000).toISOString()
  await db.from('sessions').insert({ id, user_id: data.userId, role: data.role, username: data.username, expires_at: expiresAt })
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${id}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SEC}`)
  return id
}

async function clearSession(req: Request, res: Response) {
  const id = getCookieId(req)
  if (id) await db.from('sessions').delete().eq('id', id)
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0`)
}

// ── Auth middleware ──────────────────────────────────────────────────────────

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (await getSession(req)) return next()
  res.status(401).json({ error: 'Not authenticated' })
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const sess = await getSession(req)
  if (sess?.role === 'admin') return next()
  res.status(403).json({ error: 'Admin access required' })
}

// ── Routes ───────────────────────────────────────────────────────────────────

authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body as { username: string; password: string }
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' })

  const { data: user } = await db.from('users')
    .select('*').eq('username', username.trim()).eq('active', true).maybeSingle()
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

  await db.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id)
  await setSession(res, { userId: user.id, role: user.role, username: user.username })
  res.json({ id: user.id, username: user.username, full_name: user.full_name, role: user.role })
})

authRouter.post('/logout', async (req, res) => {
  await clearSession(req, res)
  res.json({ ok: true })
})

authRouter.get('/me', async (req, res) => {
  const sess = await getSession(req)
  if (!sess) return res.status(401).json({ error: 'Not authenticated' })
  const { data: user } = await db.from('users')
    .select('id,username,full_name,role').eq('id', sess.userId).maybeSingle()
  if (!user) return res.status(401).json({ error: 'Session expired' })
  res.json(user)
})

// ── User management (admin only) ─────────────────────────────────────────────

authRouter.get('/users', (req, res, next) => requireAdmin(req, res, next), async (_req, res) => {
  const { data } = await db.from('users')
    .select('id,username,full_name,role,active,created_at,last_login').order('created_at', { ascending: false })
  res.json(data ?? [])
})

authRouter.post('/users', (req, res, next) => requireAdmin(req, res, next), async (req, res) => {
  const { username, password, full_name, role } = req.body as any
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' })
  const userRole = ['admin', 'staff'].includes(role) ? role : 'staff'
  try {
    const hash = await bcrypt.hash(password, 10)
    const { data, error } = await db.from('users')
      .insert({ username: username.trim(), password_hash: hash, full_name: full_name?.trim() ?? '', role: userRole })
      .select('id').single()
    if (error) throw error
    res.json({ id: data.id, username, full_name, role: userRole })
  } catch {
    res.status(409).json({ error: 'Username already taken' })
  }
})

authRouter.patch('/users/:id', (req, res, next) => requireAdmin(req, res, next), async (req, res) => {
  const { id } = req.params
  const { password, full_name, role, active } = req.body as any
  const sess = await getSession(req)
  if (active !== undefined && !active && sess?.userId === Number(id)) {
    return res.status(400).json({ error: 'Cannot deactivate your own account' })
  }
  if (password) {
    const hash = await bcrypt.hash(password, 10)
    await db.from('users').update({ password_hash: hash }).eq('id', id)
  }
  if (full_name !== undefined) await db.from('users').update({ full_name }).eq('id', id)
  if (role && ['admin', 'staff'].includes(role)) await db.from('users').update({ role }).eq('id', id)
  if (active !== undefined) await db.from('users').update({ active: !!active }).eq('id', id)
  res.json({ ok: true })
})

authRouter.delete('/users/:id', (req, res, next) => requireAdmin(req, res, next), async (req, res) => {
  const { id } = req.params
  const sess = await getSession(req)
  if (sess?.userId === Number(id)) return res.status(400).json({ error: 'Cannot delete your own account' })
  await db.from('users').delete().eq('id', id)
  res.json({ ok: true })
})
