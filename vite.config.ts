import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function resolveModuleDir(pkgName: string): string {
  try {
    const pkgJsonPath = require.resolve(`${pkgName}/package.json`, { paths: [__dirname] });
    return path.dirname(pkgJsonPath);
  } catch {
    const fallback = path.resolve(__dirname, 'node_modules', pkgName);
    return fs.existsSync(fallback) ? fallback : pkgName;
  }
}

const reactPath = resolveModuleDir('react');
const reactDomPath = resolveModuleDir('react-dom');
const reactIsPath = resolveModuleDir('react-is');
const rechartsPath = resolveModuleDir('recharts');

export default defineConfig(() => {
  const basePath = process.env.VITE_BASE_PATH || '/';
  return {
    base: basePath,
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-is',
        'recharts',
      ],
      alias: {
        '@': path.resolve(__dirname, '.'),
        react: reactPath,
        'react-dom': reactDomPath,
        'react-is': reactIsPath,
        recharts: rechartsPath,
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-is',
        'recharts',
        'lucide-react',
        'sonner',
        'framer-motion',
        'react-window',
        'pdf-lib',
        'xlsx',
        'heic2any',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        'firebase/messaging',
        'firebase/storage',
      ],
    },
    build: {
      chunkSizeWarningLimit: 3000,
      commonjsOptions: {
        include: [/react-is/, /recharts/, /node_modules/],
        transformMixedEsModules: true,
      },
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (id.includes('recharts') || id.includes('react-is') || id.includes('d3-')) {
                return 'vendor-charts';
              }
              if (id.includes('firebase')) {
                return 'vendor-firebase';
              }
              if (id.includes('xlsx')) {
                return 'vendor-xlsx';
              }
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react';
              }
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

