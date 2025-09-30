import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const ETHICS_SOURCE_PATH = path.resolve(__dirname, '../ethics/core_v2.mdx');
const DEV_META_DIR = path.resolve(__dirname, '.dev-meta');
const PROTOCOL_MANIFEST_PATH = path.resolve(__dirname, '../manifest.json');

function ensureEthicsManifest(targetDir, commandLabel = 'build') {
  if (!fs.existsSync(ETHICS_SOURCE_PATH)) {
    console.warn('[vaultfire-ethics-anchor] ethics source not found, skipping manifest generation');
    return;
  }

  const content = fs.readFileSync(ETHICS_SOURCE_PATH);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  let semanticVersion = '0.0.0';
  let scopeTags = ['pilot'];
  try {
    const manifestRaw = fs.readFileSync(PROTOCOL_MANIFEST_PATH, 'utf8');
    const manifest = JSON.parse(manifestRaw);
    semanticVersion = manifest.semanticVersion || manifest.version || semanticVersion;
    scopeTags = Array.isArray(manifest.scopeTags) ? manifest.scopeTags : scopeTags;
  } catch (error) {
    semanticVersion = '0.0.0';
  }
  const payload = {
    source: 'ethics/core_v2.mdx',
    hash,
    generatedAt: new Date().toISOString(),
    command: commandLabel,
    semanticVersion,
    scopeTags,
  };

  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'ethics-manifest.json'), JSON.stringify(payload, null, 2));
}

function ethicsAnchorPlugin() {
  let targetDir = path.resolve(__dirname, 'dist/meta');
  let commandLabel = 'build';

  return {
    name: 'vaultfire-ethics-anchor',
    enforce: 'post',
    configResolved(resolvedConfig) {
      commandLabel = resolvedConfig.command;
      const buildOutDir = resolvedConfig.build?.outDir || 'dist';
      targetDir =
        resolvedConfig.command === 'build'
          ? path.resolve(resolvedConfig.root, buildOutDir, 'meta')
          : DEV_META_DIR;

      if (process.env.VITE_DISABLE_ETHICS_PLUGIN) {
        console.warn('[vaultfire-ethics-anchor] Ethics metadata plugin cannot be disabled; ignoring VITE_DISABLE_ETHICS_PLUGIN flag.');
      }
    },
    buildStart() {
      ensureEthicsManifest(targetDir, commandLabel);
    },
    closeBundle() {
      ensureEthicsManifest(targetDir, 'build');
    },
    configureServer(server) {
      ensureEthicsManifest(targetDir, 'serve');
      server.middlewares.use('/meta/ethics-manifest.json', (req, res, next) => {
        const manifestPath = path.join(targetDir, 'ethics-manifest.json');
        if (fs.existsSync(manifestPath)) {
          res.setHeader('Content-Type', 'application/json');
          res.end(fs.readFileSync(manifestPath));
          return;
        }
        next();
      });
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
