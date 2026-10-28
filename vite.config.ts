import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base: './' lets the built site work on GitHub Pages or any sub-folder.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node' },
} as never)
