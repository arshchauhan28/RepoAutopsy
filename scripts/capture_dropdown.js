const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Visit repository codevitals page
  await page.goto('http://localhost:3000/repositories/demo-diagnostics-issue9/codevitals', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));

  // Find Create Team Session button and click it
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, a'));
    const btn = buttons.find(b => b.textContent && b.textContent.includes('Create Team Session'));
    if (btn) btn.click();
  });

  await new Promise(r => setTimeout(r, 1200));

  // Find the Select dropdown trigger for Assigned Scope and click it
  await page.evaluate(() => {
    const triggers = Array.from(document.querySelectorAll('button[aria-haspopup="listbox"]'));
    if (triggers.length > 0) triggers[0].click();
  });

  await new Promise(r => setTimeout(r, 600));

  const artifactPath = path.resolve('C:/Users/arsh0/.gemini/antigravity/brain/86f19699-35ea-43f7-9b4f-89068b92996a/select_dropdown_open.png');
  await page.screenshot({ path: artifactPath, fullPage: false });

  // Also test mobile viewport 390x844
  await page.setViewport({ width: 390, height: 844 });
  await new Promise(r => setTimeout(r, 500));
  const mobileArtifactPath = path.resolve('C:/Users/arsh0/.gemini/antigravity/brain/86f19699-35ea-43f7-9b4f-89068b92996a/mobile_select_dropdown_open.png');
  await page.screenshot({ path: mobileArtifactPath, fullPage: false });

  // 2. Visit repository diagnostics page
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/repositories/demo-diagnostics-issue9', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));

  // Click Diagnostics tab
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button, a'));
    const diagTab = tabs.find(t => t.textContent && t.textContent.includes('Diagnostics'));
    if (diagTab) diagTab.click();
  });
  await new Promise(r => setTimeout(r, 800));

  // Expand the first diagnostic card if not expanded
  await page.evaluate(() => {
    const expandBtns = Array.from(document.querySelectorAll('button[title="Expand"], button[title="Collapse"]'));
    if (expandBtns.length > 0) expandBtns[0].click();
  });
  await new Promise(r => setTimeout(r, 600));

  const diagPath = path.resolve('C:/Users/arsh0/.gemini/antigravity/brain/86f19699-35ea-43f7-9b4f-89068b92996a/desktop_diagnostics_report.png');
  await page.screenshot({ path: diagPath, fullPage: false });

  // Mobile diagnostics
  await page.setViewport({ width: 390, height: 844 });
  await new Promise(r => setTimeout(r, 500));
  const mobileDiagPath = path.resolve('C:/Users/arsh0/.gemini/antigravity/brain/86f19699-35ea-43f7-9b4f-89068b92996a/mobile_diagnostics_report.png');
  await page.screenshot({ path: mobileDiagPath, fullPage: false });

  console.log('Successfully captured all screenshots.');
  await browser.close();
})();
