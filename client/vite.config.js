import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, the React app runs on :5173 and forwards /api and /mock-paypal to the server on :3000.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3000', '/mock-paypal': 'http://localhost:3000' } },
});
