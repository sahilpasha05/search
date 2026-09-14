import type { IncomingMessage, ServerResponse } from 'http'

type Handler = (req: IncomingMessage, res: ServerResponse) => void

let handler: Handler | null = null
let initError: Error | null = null

async function init() {
  try {
    const { createApi } = await import('../server/api.js')
    handler = createApi() as unknown as Handler
  } catch (e: unknown) {
    initError = e instanceof Error ? e : new Error(String(e))
    console.error('[api/server] init failed:', initError.stack)
  }
}

const ready = init()

export default async function (req: IncomingMessage, res: ServerResponse) {
  await ready
  if (initError) {
    ;(res as any).statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ initError: initError.message, stack: initError.stack?.slice(0, 600) }))
    return
  }
  handler!(req, res)
}
