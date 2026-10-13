import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '127.0.0.1'
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
})
