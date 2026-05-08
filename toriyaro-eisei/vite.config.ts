import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});
