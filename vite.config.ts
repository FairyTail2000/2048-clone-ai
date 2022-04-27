import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "tfjs-vis": ["@tensorflow/tfjs-vis"],
          "tfjs": ["@tensorflow/tfjs"]
        },
      },
    },
    sourcemap: true
  },
})
