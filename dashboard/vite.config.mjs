import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

function ethicsAnchorPlugin() {
  return {
    name: 'vaultfire-ethics-anchor',
    apply: 'build',
    closeBundle() {
      const sourcePath = path.resolve(__dirname, '../ethics/core_v2.mdx');
      if (!fs.existsSync(sourcePath)) {
        return;
      }
      const distDir = path.resolve(__dirname, 'dist/meta');
      const content = fs.readFileSync(sourcePath);
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const payload = {
        source: 'ethics/core_v2.mdx',
        hash,
        generatedAt: new Date().toISOString(),
      };
      fs.mkdirSync(distDir, { recursive: true });
      fs.writeFileSync(path.join(distDir, 'ethics-manifest.json'), JSON.stringify(payload, null, 2));
    },
  };
}

export default defineConfig({
  root: __dirname,
  plugins: [react(), ethicsAnchorPlugin()],
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
