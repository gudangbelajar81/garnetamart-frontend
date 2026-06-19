import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('PAGE ERROR:', msg.text());
    } else {
      console.log('PAGE LOG:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE EXCEPTION:', error.message);
  });

  try {
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle2' });
    console.log("Page loaded successfully.");
    
    // click cart
    await page.click('.floating-cart');
    await new Promise(r => setTimeout(r, 1000));
    
  } catch (err) {
    console.log("Failed to load page:", err.message);
  }

  await browser.close();
})();
