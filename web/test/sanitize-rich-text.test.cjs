const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { chromium } = require('playwright');

test('rich text preserves formatting and removes executable HTML in a browser', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<main></main>');
    const purify = path.join(path.dirname(require.resolve('dompurify')), 'purify.js');
    await page.addScriptTag({ path: purify });
    const source = fs.readFileSync(path.join(__dirname, '../src/lib/sanitize-rich-text.ts'), 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText;
    const result = await page.evaluate((code) => {
      const exports = {};
      new Function('require', 'exports', code)(() => window.DOMPurify, exports);
      const dirty = '<p><strong>Keep bold</strong><em> and italics</em></p><ul><li>Item</li></ul>' +
        '<img src=x onerror="window.compromised=true"><svg onload="window.compromised=true"></svg>' +
        '<script>window.compromised=true</script><a href="javascript:window.compromised=true">Link</a>' +
        '<div onclick="window.compromised=true" style="background:url(javascript:alert(1))">Text</div>' +
        '<iframe srcdoc="<script>parent.compromised=true</script>"></iframe>';
      const clean = exports.sanitizeRichText(dirty);
      document.querySelector('main').innerHTML = clean;
      return {
        clean,
        attributes: [...document.querySelectorAll('main *')].flatMap((node) => [...node.attributes]),
        unsafeElements: document.querySelectorAll('main script,main img,main svg,main iframe,main a').length,
        compromised: Boolean(window.compromised),
      };
    }, compiled);
    assert.match(result.clean, /<strong>Keep bold<\/strong>/);
    assert.match(result.clean, /<ul><li>Item<\/li><\/ul>/);
    assert.equal(result.unsafeElements, 0);
    assert.deepEqual(result.attributes, []);
    assert.equal(result.compromised, false);
  } finally {
    await browser.close();
  }
});
