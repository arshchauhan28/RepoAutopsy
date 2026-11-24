const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(__dirname, '../frontend/node_modules/puppeteer-core'));

const VIEWPORT_MATRIX = [
  { name: 'Small mobile (320x568)', width: 320, height: 568 },
  { name: 'Compact Android (360x800)', width: 360, height: 800 },
  { name: 'Older iPhone (375x667)', width: 375, height: 667 },
  { name: 'Modern iPhone (390x844)', width: 390, height: 844 },
  { name: 'Modern Android (393x873)', width: 393, height: 873 },
  { name: 'Larger Android (412x915)', width: 412, height: 915 },
  { name: 'Large iPhone (430x932)', width: 430, height: 932 },
  { name: 'Small mobile landscape (568x320)', width: 568, height: 320 },
  { name: 'Mobile landscape (667x375)', width: 667, height: 375 },
  { name: 'Modern mobile landscape (844x390)', width: 844, height: 390 },
  { name: 'Tablet portrait (768x1024)', width: 768, height: 1024 },
  { name: 'Tablet landscape (1024x768)', width: 1024, height: 768 },
  { name: 'Laptop (1280x800)', width: 1280, height: 800 },
  { name: 'Desktop (1440x900)', width: 1440, height: 900 },
  { name: 'Large desktop (1920x1080)', width: 1920, height: 1080 },
];

const ROUTES = [
  { path: '/', name: 'Homepage' },
  { path: '/analyze', name: 'Analyze' },
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/workspaces', name: 'Workspaces' },
];

async function run() {
  const screenshotDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  console.log('=== REPOAUTOPSY RESPONSIVE SUITE: 15 VIEWPORTS × 4 ROUTES ===\n');
  const results = [];
  let totalTests = 0;
  let passedTests = 0;

  for (const vp of VIEWPORT_MATRIX) {
    console.log(`Testing Viewport: ${vp.name} (${vp.width}x${vp.height})`);

    for (const route of ROUTES) {
      totalTests++;
      const url = `http://localhost:3000${route.path}`;
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 768 });

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise(r => setTimeout(r, 600));

        // Evaluate overflow
        const overflowData = await page.evaluate(() => {
          const doc = document.documentElement;
          const body = document.body;
          const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
          const clientWidth = doc.clientWidth;
          const hasOverflow = scrollWidth > clientWidth + 1;
          
          let overflowingElements = [];
          if (hasOverflow) {
            const all = document.querySelectorAll('*');
            for (let el of all) {
              const r = el.getBoundingClientRect();
              if (r.right > clientWidth + 2) {
                overflowingElements.push({
                  tag: el.tagName,
                  className: el.className,
                  right: Math.round(r.right),
                  width: Math.round(r.width),
                });
                if (overflowingElements.length >= 3) break;
              }
            }
          }
          return { scrollWidth, clientWidth, hasOverflow, overflowingElements };
        });

        if (overflowData.hasOverflow) {
          console.error(`  [FAIL] ${route.name}: Overflow detected (scrollWidth=${overflowData.scrollWidth} > clientWidth=${overflowData.clientWidth})`, overflowData.overflowingElements);
          results.push({ vp: vp.name, route: route.name, status: 'FAIL', reason: 'Horizontal overflow', details: overflowData });
        } else {
          passedTests++;
          results.push({ vp: vp.name, route: route.name, status: 'PASS', scrollWidth: overflowData.scrollWidth, clientWidth: overflowData.clientWidth });
        }
      } catch (err) {
        console.error(`  [ERROR] ${route.name}: ${err.message}`);
        results.push({ vp: vp.name, route: route.name, status: 'ERROR', message: err.message });
      } finally {
        await page.close().catch(() => {});
      }
    }

    // Capture representative screenshots for mobile, tablet, and desktop
    if ([320, 390, 768, 1440].includes(vp.width)) {
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: vp.width < 768 });
      const shotPath = path.join(screenshotDir, `screenshot_${vp.width}x${vp.height}_home.png`);
      await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise(r => setTimeout(r, 600));
      await page.screenshot({ path: shotPath, fullPage: false });
      console.log(`  Saved screenshot: ${shotPath}`);

      if (vp.width < 768) {
        // Test mobile hamburger interaction
        const burger = await page.$('button[aria-label="Open menu"]');
        if (burger) {
          await burger.click();
          await new Promise(r => setTimeout(r, 400));
          const drawerShot = path.join(screenshotDir, `screenshot_${vp.width}x${vp.height}_drawer_open.png`);
          await page.screenshot({ path: drawerShot, fullPage: false });
          console.log(`  Saved drawer screenshot: ${drawerShot}`);
        }
      }
      await page.close().catch(() => {});
    }
  }

  await browser.close();

  console.log(`\n=== RESPONSIVE SUITE SUMMARY: ${passedTests}/${totalTests} Passed ===`);
  const allPassed = passedTests === totalTests;
  console.log(allPassed ? 'ALL VIEWPORTS PASSED (0 HORIZONTAL OVERFLOW)' : 'SOME OVERFLOW DETECTED');
  
  fs.writeFileSync(
    path.join(__dirname, 'responsive_results.json'),
    JSON.stringify({ totalTests, passedTests, allPassed, results }, null, 2)
  );

  process.exit(allPassed ? 0 : 1);
}

run().catch((err) => {
  console.error('Fatal error running responsive suite:', err);
  process.exit(1);
});
