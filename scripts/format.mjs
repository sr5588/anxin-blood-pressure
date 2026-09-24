import fs from 'node:fs';
import path from 'node:path';
import prettier from 'prettier';
async function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) await walk(p);
    else if (/\.(wxml|wxss)$/.test(p)) {
      const source = fs.readFileSync(p, 'utf8');
      fs.writeFileSync(
        p,
        await prettier.format(source, {
          parser: p.endsWith('.wxml') ? 'html' : 'css',
          printWidth: 100,
          htmlWhitespaceSensitivity: 'ignore',
        }),
      );
    }
  }
}
await walk('miniprogram');
