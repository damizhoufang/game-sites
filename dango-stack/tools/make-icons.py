"""生成主屏幕图标：用游戏里画团子的同一段代码，画成 2×2 的一块。

用法：python3 tools/make-icons.py   （需要 playwright 和本机的 Chrome）
"""
import asyncio, base64, pathlib, re, sys
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
html = (ROOT / 'index.html').read_text(encoding='utf-8')
pal = re.search(r'const PAL = \{.*?\n\};', html, re.S).group(0)
paint = re.search(r'function paintCritter\(g, t, mood\) \{.*?\n\}\n', html, re.S).group(0)

PAGE = """<!DOCTYPE html><meta charset="utf-8"><script>
const INK = '#3a2346';
%s
%s
function icon(size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#3a2346'; g.fillRect(0, 0, size, size);
  g.fillStyle = 'rgba(255,255,255,.1)';
  const step = size / 8;
  for (let y = 0; y <= 8; y++) for (let x = 0; x <= 8; x++) { g.beginPath(); g.arc(x * step, y * step, size * .008, 0, 7); g.fill(); }
  const s = size * 0.29, o = (size - s * 2) / 2;
  [[1, 0, 0], [2, 1, 0], [5, 0, 1], [4, 1, 1]].forEach(([t, cx, cy]) => {
    g.save(); g.translate(o + cx * s, o + cy * s); g.scale(s, s); paintCritter(g, t, 'awake'); g.restore();
  });
  return c.toDataURL('image/png');
}
</script>""" % (pal, paint)

async def main():
    out = ROOT / 'icons'; out.mkdir(exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page()
        await pg.set_content(PAGE)
        for name, size in [('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180)]:
            url = await pg.evaluate('icon(%d)' % size)
            (out / name).write_bytes(base64.b64decode(url.split(',', 1)[1]))
            print(name, size)
        await b.close()

asyncio.run(main())
