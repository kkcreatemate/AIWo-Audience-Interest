'use strict';
/* Loads the same style/effect files the render page uses, so the CLI and the page can never disagree. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT } = require('./util');

const WEB = path.join(ROOT, 'web');
let cached = null;

function webFiles() {
  const dir = (d) => fs.readdirSync(path.join(WEB, d)).filter((f) => f.endsWith('.js')).sort().map((f) => path.join(WEB, d, f));
  return {
    lib: [path.join(WEB, 'lib', 'core.js'), path.join(WEB, 'lib', 'camera.js')],
    runtime: path.join(WEB, 'lib', 'runtime.js'),
    modules: [...dir('captions'), ...dir('effects')],
  };
}

function load() {
  if (cached) return cached;
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const files = webFiles();
  for (const f of [...files.lib, ...files.modules]) vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f });
  cached = sandbox.KKV;
  return cached;
}

module.exports = { load, webFiles, WEB };
