import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        open: true,
		watch: {
            ignored: ['**/server/uploaded/**']
        }
    },
    build: {
        outDir: 'dist',
        sourcemap: true
    }
})
