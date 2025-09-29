const path = require('path');
const mockFs = require('mock-fs');

const { createIframe } = require('../web_mirror_viewer');
const CONFIG_PATH = path.join(__dirname, '..', 'embed_config.json');

const toMockPath = (pathname) => pathname.split(path.sep).join('/');

beforeEach(() => {
  mockFs({
    [toMockPath(CONFIG_PATH)]: JSON.stringify({ width: 700, height: 300 }),
  }, { createCwd: true, createTmp: true });
});

afterEach(() => {
  mockFs.restore();
});

test('createIframe reads width and height from config', () => {
  const html = createIframe('https://example.com/3d');
  expect(html).toContain('width="700"');
  expect(html).toContain('height="300"');
});

test('falls back to defaults when config missing', () => {
  mockFs.restore();
  mockFs({}, { createCwd: true, createTmp: true });
  const html = createIframe('https://example.com/fallback');
  expect(html).toContain('width="600"');
  expect(html).toContain('height="400"');
});
