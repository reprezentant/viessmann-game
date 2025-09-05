import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
  // Bind explicitly to localhost so http://localhost works reliably on Windows
  host: 'localhost',
    port: 5174,
    strictPort: true,
    hmr: {
      host: 'localhost',
      port: 5174,
      protocol: 'ws',
    },
  },
})
