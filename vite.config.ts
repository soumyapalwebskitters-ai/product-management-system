import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import { handleDevRequest, type NodeRequest, type NodeResponse } from './server/local'

function shopMiddleware(req: NodeRequest & { url?: string }, res: NodeResponse, next: () => void) {
  const path = req.url?.split('?')[0]
  if (path !== '/api/state') {
    next()
    return
  }
  void handleDevRequest(req, res).catch((error: unknown) => {
    res.statusCode = 500
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Could not use the shop database.' }))
  })
}

function localShopApi(): Plugin {
  return {
    name: 'local-shop-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        shopMiddleware(req as NodeRequest & { url?: string }, res, next)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        shopMiddleware(req as NodeRequest & { url?: string }, res, next)
      })
    },
  }
}

export default defineConfig({
  plugins: [localShopApi(), react()],
  server: { port: 5173 },
})
