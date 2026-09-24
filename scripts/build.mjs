import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const tsc = path.resolve('node_modules/typescript/bin/tsc');
// Keep dev fixture generated from the same server-owned catalog.
const catalog = fs
  .readFileSync('server/catalog.ts', 'utf8')
  .replace(
    "import { Product } from '../shared/types';",
    "import { Product } from '../../shared/types';",
  )
  .replace('seedProducts', 'mockProducts');
fs.writeFileSync('miniprogram/services/mock-catalog.ts', catalog);
for (const config of ['tsconfig.json', 'tsconfig.server.json'])
  execFileSync(process.execPath, [tsc, '-p', config], { stdio: 'inherit' });
function copy(dir, target, rewrite = false) {
  fs.mkdirSync(target, { recursive: true });
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const s = path.join(dir, item.name),
      t = path.join(target, item.name);
    if (item.isDirectory()) copy(s, t, rewrite);
    else if (item.name.endsWith('.js')) {
      let body = fs.readFileSync(s, 'utf8');
      if (rewrite)
        body = body.replace(
          /require\("(?:\.\.\/)+(shared\/[^\"]+)"\)/g,
          (_, file) =>
            'require("' +
            path.relative(path.dirname(t), path.join('miniprogram', file)).replaceAll('\\', '/') +
            '")',
        );
      fs.writeFileSync(t, body);
    }
  }
}
copy('.build/client/miniprogram', 'miniprogram', true);
copy('.build/client/shared', 'miniprogram/shared');
copy('.build/server/server', 'cloudfunctions/api/server');
copy('.build/server/shared', 'cloudfunctions/api/shared');
fs.writeFileSync('cloudfunctions/api/index.js', "exports.main = require('./server/entry').main;\n");
fs.writeFileSync(
  'cloudfunctions/api/package.json',
  JSON.stringify(
    {
      name: 'anxin-api',
      version: '0.1.0',
      main: 'index.js',
      dependencies: { 'wx-server-sdk': '3.0.4' },
    },
    null,
    2,
  ),
);
console.log('已构建原生小程序 JS 与独立云函数');
