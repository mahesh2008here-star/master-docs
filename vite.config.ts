import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

const PDFJS_ASSET_DIRS = ['cmaps', 'standard_fonts', 'wasm', 'iccs'] as const;

const MIME_BY_EXT: Record<string, string> = {
  '.bcmap': 'application/octet-stream',
  '.pfb': 'application/octet-stream',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.icc': 'application/vnd.iccprofile',
  '.properties': 'text/plain',
  '.txt': 'text/plain',
};

function copyDirRecursive(srcDir: string, destDir: string) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (!entry.name.startsWith('LICENSE')) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function pdfjsOfflineAssetsPlugin(): Plugin {
  const pdfjsRoot = path.resolve(import.meta.dirname, 'node_modules/pdfjs-dist');
  let outDir = path.resolve(import.meta.dirname, 'dist');

  return {
    name: 'pdfjs-offline-assets',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use('/pdfjs', (req, res, next) => {
        const cleanUrl = (req.url || '').split('?')[0].replace(/^\/+/, '');
        const [assetGroup, ...rest] = cleanUrl.split('/');
        if (!PDFJS_ASSET_DIRS.includes(assetGroup as (typeof PDFJS_ASSET_DIRS)[number]) || rest.length === 0) {
          return next();
        }
        const safeRel = path.normalize(rest.join('/')).replace(/^(\.\.(\/|\\|$))+/, '');
        const filePath = path.join(pdfjsRoot, assetGroup, safeRel);
        if (!filePath.startsWith(path.join(pdfjsRoot, assetGroup)) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          return next();
        }
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader('Content-Type', MIME_BY_EXT[ext] || 'application/octet-stream');
        fs.createReadStream(filePath).pipe(res);
      });
    },
    writeBundle() {
      for (const dirName of PDFJS_ASSET_DIRS) {
        copyDirRecursive(path.join(pdfjsRoot, dirName), path.join(outDir, 'pdfjs', dirName));
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), pdfjsOfflineAssetsPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    optimizeDeps: {
      exclude: ['pdfjs-dist'],
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
