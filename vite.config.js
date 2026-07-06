import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api/bcra-deudas': {
        target: 'https://api.bcra.gob.ar',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => {
          const cuit = new URLSearchParams(path.split('?')[1]).get('cuit')
          return `/CentralDeDeudores/v1.0/Deudas/${cuit}`
        }
      },
      '/api/bcra-cheques': {
        target: 'https://api.bcra.gob.ar',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => {
          const cuit = new URLSearchParams(path.split('?')[1]).get('cuit')
          return `/CentralDeDeudores/v1.0/ChequesRechazados/${cuit}`
        }
      },
      '/api/precio-por-ean': 'http://localhost:3001',
      '/api/buscar-catalogo': 'http://localhost:3001'
    }
  }
})
