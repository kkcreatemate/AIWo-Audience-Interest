'use strict';
/* Builds a single self-contained HTML page that plays every caption style and effect live,
 * using the very same style/effect code the renderer uses. */
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./util');
const catalog = require('./catalog');

function build(out, log = () => {}, fragment = false) {
  const files = catalog.webFiles();
  const read = (f) => fs.readFileSync(f, 'utf8');
  const shim = (file, global) => `(function(){var module={exports:{}};\n${read(file)}\nwindow.${global}=module.exports;})();`;
  const libs = [
    ...[...files.lib, files.runtime, ...files.modules].map(read),
    shim(path.join(ROOT, 'src', 'sfx.js'), 'KKVSfx'),
    shim(path.join(ROOT, 'src', 'lines.js'), 'KKVLines'),
  ].join('\n;\n').replace(/<\/script/gi, '<\\/script');
  const body = read(path.join(catalog.WEB, 'gallery.template.html')).replace('/*__KKV_LIBS__*/', () => libs);
  const html = fragment ? body : `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body style="margin:0">\n${body}\n</body>\n</html>\n`;
  const file = path.resolve(out || path.join(ROOT, 'gallery.html'));
  fs.writeFileSync(file, html);
  log(`✓ ${file}  (${(html.length / 1024).toFixed(0)} KB) · open it in a browser`);
  return file;
}

module.exports = { build };
