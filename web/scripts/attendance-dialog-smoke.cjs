const path = require("node:path");
const assert = require("node:assert/strict");
const { build } = require("../../api/node_modules/esbuild");
const { chromium } = require("../../node_modules/playwright");

(async () => {
  const bundle = await build({
    stdin: {
      contents: `
      import React, {useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import AttendanceDialog from './src/components/common/AttendanceDialog';
      function Fixture() {
        const [open,setOpen]=useState(false), [busy,setBusy]=useState(false);
        return <><button id="open" onClick={()=>setOpen(true)}>Open editor</button>
          {open && <AttendanceDialog label="Attendance correction" busy={busy} onClose={()=>setOpen(false)}>
            <h1>Attendance correction</h1><label>Name<input id="name" /></label>
            <label>Check-out<input type="datetime-local" /></label>
            <button id="busy" onClick={()=>setBusy(!busy)}>Toggle saving</button>
            <button id="close" onClick={()=>setOpen(false)}>Cancel</button>
          </AttendanceDialog>}</>;
      }
      createRoot(document.getElementById('root')).render(<Fixture/>);
    `,
      resolveDir: path.resolve(__dirname, ".."),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    platform: "browser",
    jsx: "automatic",
  });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 320, height: 480 },
    });
    await page.setContent('<main id="root"></main>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.locator("#open").click();
    await page.getByRole("dialog", { name: "Attendance correction" }).waitFor();
    assert.equal(
      await page.evaluate(
        () => document.activeElement.closest("dialog") !== null,
      ),
      true,
    );
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      assert.equal(
        await page.evaluate(
          () => document.activeElement.closest("dialog") !== null,
        ),
        true,
      );
    }
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog"));
    assert.equal(await page.evaluate(() => document.activeElement.id), "open");
    await page.locator("#open").click();
    await page.locator("#busy").click();
    await page.keyboard.press("Escape");
    assert.equal(
      await page.locator("dialog").evaluate((dialog) => dialog.open),
      true,
    );
    await page.locator("#busy").click();
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog"));
    console.log(
      "Attendance dialog smoke passed: initial focus, tab containment, Escape, focus restoration, saving guard.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
