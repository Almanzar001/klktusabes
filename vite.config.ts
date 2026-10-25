import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const { VITE_INSFORGE_URL } = loadEnv(mode, process.cwd(), 'VITE_')

  // Las llamadas de inicio de sesión se reenvían al backend desde el mismo
  // dominio de la app (en producción lo hace nginx, ver nginx.conf). En local la
  // página va por http, así que la cookie de la sesión pierde el atributo Secure
  // para que el navegador la guarde.
  const authProxy: Record<string, ProxyOptions> = {
    '/api/auth/': {
      target: VITE_INSFORGE_URL,
      changeOrigin: true,
      secure: true,
      configure: proxy => {
        proxy.on('proxyRes', response => {
          const cookies = response.headers['set-cookie']
          if (cookies) {
            response.headers['set-cookie'] = cookies.map(cookie =>
              cookie.replace(/;\s*Secure/gi, '').replace(/SameSite=None/gi, 'SameSite=Lax')
            )
          }
        })
      }
    }
  }

  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: '127.0.0.1',
      proxy: authProxy
    },
    preview: {
      proxy: authProxy
    },
    build: {
      rollupOptions: {
        output: {
          // El lector de PDF trae un módulo .mjs, y el nginx de producción no
          // sirve esa extensión como JavaScript: se publica como .js
          assetFileNames: asset =>
            asset.name?.endsWith('.mjs') ? 'assets/[name]-[hash].js' : 'assets/[name]-[hash][extname]'
        }
      }
    }
  }
})
