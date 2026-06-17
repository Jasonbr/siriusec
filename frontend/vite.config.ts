import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Cookie 持久化文件路径
const COOKIE_FILE = path.join(__dirname, '.vite-cookies.json')

// 读取已保存的 cookies
function loadCookies(): { session: string | null; csrf: string | null } {
  try {
    if (fs.existsSync(COOKIE_FILE)) {
      return JSON.parse(fs.readFileSync(COOKIE_FILE, 'utf-8'))
    }
  } catch (e) {
    console.error('[Proxy] Failed to load cookies:', e)
  }
  return { session: null, csrf: null }
}

// 保存 cookies 到文件
function saveCookies(session: string | null, csrf: string | null) {
  try {
    fs.writeFileSync(COOKIE_FILE, JSON.stringify({ session, csrf }))
  } catch (e) {
    console.error('[Proxy] Failed to save cookies:', e)
  }
}

let cookies = loadCookies()

// Vite 插件：提供 CSRF token API（用于开发模式）
function csrfTokenPlugin() {
  return {
    name: 'csrf-token-plugin',
    configureServer(server: any) {
      // 添加 /__csrf-token 端点，返回 Vite 代理保存的 CSRF token
      server.middlewares.use('/__csrf-token', (_req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.end(JSON.stringify({ csrf: cookies.csrf || null, session: cookies.session || null }))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/web/',
  plugins: [react(), csrfTokenPlugin()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      // 代理 API 请求到后端（v7 老平台）
      '/v1': {
        target: 'https://192.168.110.166:3080',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, _req, res) => {
            const setCookies = proxyRes.headers['set-cookie']
            if (setCookies && Array.isArray(setCookies)) {
              for (const cookie of setCookies) {
                if (cookie.includes('siriusec_session=')) {
                  const match = cookie.match(/siriusec_session=([^;]+)/)
                  if (match) {
                    cookies.session = match[1]
                    saveCookies(cookies.session, cookies.csrf)
                  }
                }
                if (cookie.includes('__Host-grv_csrf=')) {
                  const match = cookie.match(/__Host-grv_csrf=([^;]+)/)
                  if (match) {
                    cookies.csrf = match[1]
                    saveCookies(cookies.session, cookies.csrf)
                  }
                }
              }

              const newCookies = setCookies.map(cookie =>
                cookie
                  .replace(/;\s*Secure/gi, '')
                  .replace(/;\s*SameSite=\w+/gi, '')
              )
              proxyRes.headers['set-cookie'] = newCookies
              res.setHeader('set-cookie', newCookies)
            }
          })

          proxy.on('proxyReq', (proxyReq) => {
            const existingCookie = proxyReq.getHeader('Cookie') as string || ''
            if (!existingCookie.includes('siriusec_session=') && cookies.session) {
              const combined = existingCookie
                ? `${existingCookie}; siriusec_session=${cookies.session}`
                : `siriusec_session=${cookies.session}`
              proxyReq.setHeader('Cookie', combined)
            }
          })
        },
      },
      '/web': {
        target: 'https://192.168.110.166:3080',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, _req, _res) => {
            const setCookies = proxyRes.headers['set-cookie']
            if (setCookies && Array.isArray(setCookies)) {
              for (const cookie of setCookies) {
                if (cookie.includes('siriusec_session=')) {
                  const match = cookie.match(/siriusec_session=([^;]+)/)
                  if (match) {
                    cookies.session = match[1]
                    saveCookies(cookies.session, cookies.csrf)
                  }
                }
                if (cookie.includes('__Host-grv_csrf=')) {
                  const match = cookie.match(/__Host-grv_csrf=([^;]+)/)
                  if (match) {
                    cookies.csrf = match[1]
                    saveCookies(cookies.session, cookies.csrf)
                  }
                }
              }

              proxyRes.headers['set-cookie'] = setCookies.map(cookie =>
                cookie
                  .replace(/;\s*Secure/gi, '')
                  .replace(/;\s*SameSite=\w+/gi, '')
              )
            }
          })

          proxy.on('proxyReq', (proxyReq) => {
            const existingCookie = proxyReq.getHeader('Cookie') as string || ''
            if (!existingCookie.includes('siriusec_session=') && cookies.session) {
              const combined = existingCookie
                ? `${existingCookie}; siriusec_session=${cookies.session}`
                : `siriusec_session=${cookies.session}`
              proxyReq.setHeader('Cookie', combined)
            }
          })
        },
      },
      '/.well-known': {
        target: 'https://192.168.110.166:3080',
        changeOrigin: true,
        secure: false,
      },
      '/webapi/oidc': {
        target: 'https://192.168.110.166:3080',
        changeOrigin: true,
        secure: false,
      },
      '/webapi/saml': {
        target: 'https://192.168.110.166:3080',
        changeOrigin: true,
        secure: false,
      },
      '/webapi/github': {
        target: 'https://192.168.110.166:3080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
