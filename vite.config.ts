import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Play screen (slice ⑥). Engine stays headless; the UI is the only browser layer.
export default defineConfig({
  plugins: [react()],
});
