import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: ['.jsx', '.js', '.ts', '.tsx'],
  },
  server: {
    proxy: {
      '/api':  'http://localhost:4000',
      '/auth': 'http://localhost:4000',
    },
  },
});
