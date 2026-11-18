#!/usr/bin/env node
/* 把 src/ 里的源码合并成两个可以直接双击打开的单文件：
 *   pc/index.html      PC 版
 *   mobile/index.html  手机版
 * 用法：node build.js
 */
const fs = require('fs');
const path = require('path');
const S = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');

const shared = ['engine.js', 'models.js', 'world.js', 'audio.js', 'ui.js', 'game.js', 'main.js'];
const targets = [
  { plat: 'pc', label: 'PC 版', title: '热力追逐 · PC 版', head: '<link rel="icon" href="../icon-192.png">' },
  {
    plat: 'mobile', label: '手机版', title: '热力追逐 · 手机版',
    head: [
      '<link rel="manifest" href="manifest.webmanifest">',
      '<link rel="icon" href="icon-192.png">',
      '<link rel="apple-touch-icon" href="icon-192.png">',
      '<meta name="apple-mobile-web-app-capable" content="yes">',
      '<meta name="mobile-web-app-capable" content="yes">',
      '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
      '<meta name="apple-mobile-web-app-title" content="热力追逐">',
    ].join('\n'),
  },
];
const tpl = S('template.html'), css = S('style.css');
for (const t of targets) {
  const js = [`platform-${t.plat}.js`, ...shared].map((f) => `/* ---- ${f} ---- */\n` + S(f)).join('\n');
  const html = tpl
    .replace('{{TITLE}}', () => t.title).replace('{{HEAD}}', () => t.head)
    .replace('{{CSS}}', () => css).replace('{{PLAT}}', () => t.plat)
    .replace('{{PLAT_LABEL}}', () => t.label).replace('{{JS}}', () => js);
  const out = path.join(__dirname, t.plat, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log('已生成', path.relative(__dirname, out), (html.length / 1024).toFixed(0) + ' KB');
}
