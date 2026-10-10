import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Two plain HTML pages, no framework (see docs/ARCHITECTURE.md once written).
export default defineConfig({
  // Relative asset URLs so the build also works when opened from a folder or a static host sub-path.
  base: './',
  build: {
    rollupOptions: {
      input: {
        planner: resolve(import.meta.dirname, 'index.html'),
        import: resolve(import.meta.dirname, 'import.html'),
      },
    },
  },
});
