import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function apiPlugin(): Plugin {
  return {
    name: 'local-api',
    async configureServer(server) {
      // Load all .env vars (including non-VITE_ ones) into process.env for the Express server
      const env = loadEnv('development', process.cwd(), '')
      Object.assign(process.env, env)
      const { createApi } = await import('./server/api')
      server.middlewares.use(createApi())
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiPlugin()],
  server: { port: 5173 },
})
