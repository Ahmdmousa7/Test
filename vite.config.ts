
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Uploader/', // Matches repository name 'Ahmdmousa1/Uploader'
  build: {
    outDir: 'dist',
  }
})
