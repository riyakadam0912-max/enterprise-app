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
      import {AttendanceDateTimeInput} from './src/components/common/AttendanceDateTimeInput';
      import {RoleGuard} from './src/components/guards/RoleGuard';
      function Fixture() {
        const [open,setOpen]=useState(false), [busy,setBusy]=useState(false);
        const [dateTime,setDateTime]=useState('2026-10-26T23:18:13.573');
        return <><button id="open" onClick={()=>setOpen(true)}>Open editor</button>
          {open && <AttendanceDialog label="Attendance correction" busy={busy} onClose={()=>setOpen(false)}>
            <h1>Attendance correction</h1><label>Name<input id="name" /></label>
            <AttendanceDateTimeInput id="checkout" label="Check out" value={dateTime} onChange={setDateTime} disabled={busy}/>
            <output id="time-value">{dateTime}</output>
            <RoleGuard role="SUPER_ADMIN" roles={['HR']}><span>Super admin approval allowed</span></RoleGuard>
            <RoleGuard role="EMPLOYEE" roles={['HR']} fallback={<span>Employee approval denied</span>}><span>Employee approval allowed</span></RoleGuard>
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
    assert.equal(await page.getByLabel("Check out hour").inputValue(), "11");
    assert.equal(await page.getByLabel("Check out AM or PM").inputValue(), "PM");
    assert.equal(await page.locator("#time-value").textContent(), "2026-10-26T23:18:13.573");
    assert.equal(await page.getByText("Super admin approval allowed").count(), 1);
    assert.equal(await page.getByText("Employee approval denied").count(), 1);
    assert.equal(await page.getByText("Employee approval allowed", {exact:true}).count(), 0);
    await page.getByLabel("Check out hour").selectOption("12");
    await page.getByLabel("Check out AM or PM").selectOption("AM");
    assert.equal(await page.locator("#time-value").textContent(), "2026-10-26T00:18:00.000");
    await page.getByLabel("Check out AM or PM").selectOption("PM");
    await page.getByLabel("Check out date").fill("2026-10-27");
    assert.equal(await page.locator("#time-value").textContent(), "2026-10-27T12:18:00.000");
    await page.getByRole("button", {name:"Clear check out"}).click();
    assert.equal(await page.locator("#time-value").textContent(), "");
    assert.equal(await page.locator('input[type="datetime-local"]').count(), 0);
    assert.equal(await page.locator("dialog").evaluate(el => el.scrollWidth <= el.clientWidth), true);
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
      "Attendance dialog smoke passed: 12-hour AM/PM editor, midnight/noon, clearing, role authorization, narrow viewport, focus, Escape, saving guard.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
