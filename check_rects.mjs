import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  await page.evaluate(() => {
    const btn = document.querySelector('.view-toggle');
    if (btn && btn.textContent.includes('DISTRICT')) { } else if (btn) { btn.click(); }
  });

  await new Promise(r => setTimeout(r, 1000));

  const data = await page.evaluate(() => {
    const svg = document.querySelector('svg');
    const path = document.querySelector('path');
    const mapContainer = document.querySelector('.map-container');
    
    return {
      svgSize: svg ? `${svg.getBoundingClientRect().width}x${svg.getBoundingClientRect().height}` : null,
      mapSize: mapContainer ? `${mapContainer.getBoundingClientRect().width}x${mapContainer.getBoundingClientRect().height}` : null,
      path: path ? path.getAttribute('d') : null
    };
  });

  console.log("SVG DEBUG DATA:", JSON.stringify(data, null, 2));
  await browser.close();
})();
