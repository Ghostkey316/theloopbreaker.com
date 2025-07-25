const path = require('path');
const fs = require('fs');

jest.mock('fs', () => {
  let files = {};
  const mock = {
    readFileSync: jest.fn((p, enc) => {
      if (!files[p]) throw new Error(`File not found: ${p}`);
      return files[p];
    }),
    existsSync: jest.fn(p => Object.prototype.hasOwnProperty.call(files, p)),
    writeFileSync: jest.fn((p, data) => { files[p] = data; }),
    __setFile: (p, data) => { files[p] = data; },
    __reset: () => { files = {}; },
  };
  return mock;
});

const { createIframe } = require('../web_mirror_viewer');
const CONFIG_PATH = path.join(__dirname, '..', 'embed_config.json');

beforeEach(() => {
  fs.__reset();
  fs.__setFile(CONFIG_PATH, JSON.stringify({ width: 700, height: 300 }));
});

test('createIframe reads width and height from config', () => {
  const html = createIframe('https://example.com/3d');
  expect(html).toContain('width="700"');
  expect(html).toContain('height="300"');
});
