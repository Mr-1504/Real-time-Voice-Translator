import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // Load các biến môi trường dựa trên mode hiện tại (development/production)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    base: './',
    server: {
      proxy: {
        '/api-whisper': {
          target: env.VITE_WHISPER_API_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-whisper/, ''),
        },
        '/api-translate': {
          target: env.VITE_TRANSLATE_API_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-translate/, ''),
        },
      },
    },
  };
});