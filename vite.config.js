const { defineConfig } = require('vite')
const react = require('@vitejs/plugin-react')

// https://vite.dev/config/
module.exports = defineConfig({
  plugins: [react()],
  base: '/', // Use absolute paths for dev
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: true
  }
})
