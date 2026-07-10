import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        player: resolve(__dirname, 'player.html'),
        viewer: resolve(__dirname, 'viewer.html')
      }
    }
  }
});
