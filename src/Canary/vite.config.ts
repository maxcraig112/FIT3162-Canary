import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    cors: true,
    proxy: {
      // Proxy Google Cloud Storage in dev to avoid browser CORS
      '/gcs': {
        target: 'https://storage.googleapis.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/gcs/, ''),
      },
    },
  },
});
