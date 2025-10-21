import { defineConfig } from 'vite'
// Minimal ambient for `process.env` to keep this file TS-friendly without adding @types/node
declare const process: { env: Record<string, string | undefined> };
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
const DEV_PORT = process.env.VITE_DEV_PORT ? Number(process.env.VITE_DEV_PORT) : 5173;
const DEV_HOST = process.env.VITE_HOST || '127.0.0.1';
const HMR_HOST = process.env.VITE_HMR_HOST || DEV_HOST;
const HMR_PORT = process.env.VITE_HMR_PORT ? Number(process.env.VITE_HMR_PORT) : DEV_PORT;

export default defineConfig({
  plugins: [react()],
  server: {
    // Use env-driven host/port with safe defaults (127.0.0.1 / 5173)
    host: DEV_HOST,
    port: DEV_PORT,
    strictPort: true,
    hmr: {
      host: HMR_HOST,
      port: HMR_PORT,
      protocol: 'ws',
    },
  },
})
