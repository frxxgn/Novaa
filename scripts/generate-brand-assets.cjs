// Genera los iconos PNG y la imagen Open Graph a partir del isotipo SVG.
//   node scripts/generate-brand-assets.cjs   (requiere playwright)
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mark = fs.readFileSync(path.join(root, "public/brand/novalius-isotipo-dark.svg"), "utf8");
const sora = fs.readFileSync(path.join(root, "node_modules/@fontsource-variable/sora/files/sora-latin-wght-normal.woff2")).toString("base64");
const inter = fs.readFileSync(path.join(root, "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2")).toString("base64");
const fonts = `@font-face{font-family:Sora;src:url(data:font/woff2;base64,${sora}) format("woff2");font-weight:100 800}@font-face{font-family:Inter;src:url(data:font/woff2;base64,${inter}) format("woff2");font-weight:100 900}`;

const icon = (size, pad) => `<html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:radial-gradient(circle at 30% 20%,#1b1460,#05061a 70%)">${mark.replace("<svg", `<svg width="${size - pad * 2}" height="${size - pad * 2}"`)}</body></html>`;

const og = `<html><head><style>${fonts}</style></head><body style="margin:0;width:1200px;height:630px;overflow:hidden;font-family:Inter;color:#f3f1ff;background:radial-gradient(70% 90% at 85% 10%,rgba(165,64,251,.55),transparent 60%),radial-gradient(60% 80% at 0% 100%,rgba(7,25,94,.9),transparent 70%),#05061a;position:relative">
<div style="position:absolute;inset:0;background-image:linear-gradient(to right,rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.05) 1px,transparent 1px);background-size:60px 60px"></div>
<div style="position:absolute;left:80px;top:72px;display:flex;align-items:center;gap:18px">${mark.replace("<svg", '<svg width="76" height="76"')}<span style="font-family:Sora;font-weight:700;font-size:46px;letter-spacing:-2px">nova<span style="background:linear-gradient(100deg,#c9b8f5,#a540fb);-webkit-background-clip:text;color:transparent">lius</span></span></div>
<div style="position:absolute;left:80px;top:220px;font-family:Sora;font-weight:600;font-size:74px;line-height:.98;letter-spacing:-3.4px;max-width:900px">CREAMOS EXPERIENCIAS DIGITALES QUE <span style="background:linear-gradient(100deg,#c9b8f5,#a540fb,#6c26e8);-webkit-background-clip:text;color:transparent">IMPULSAN</span> NEGOCIOS</div>
<div style="position:absolute;left:80px;bottom:64px;font-size:24px;color:rgba(243,241,255,.7)">Desarrollo web · IA · Automatizaciones · SEO</div>
<div style="position:absolute;right:-80px;top:120px;width:460px;height:460px;border-radius:50%;background:radial-gradient(circle at 32% 28%,#fff 0%,#c9b8f5 10%,#a540fb 34%,#6c26e8 56%,#301e9f 76%,#07195e 100%);box-shadow:0 0 140px 20px rgba(108,38,232,.45);opacity:.85"></div>
</body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [file, size, pad] of [["apple-touch-icon.png", 180, 18], ["icon-192.png", 192, 18], ["icon-512.png", 512, 48], ["favicon-32.png", 32, 1]]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(icon(size, pad));
    await page.screenshot({ path: path.join(root, "public", file) });
  }
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(og);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(root, "public/og-image.jpg"), type: "jpeg", quality: 88 });
  await browser.close();
  console.log("Iconos y og-image.jpg generados en public/");
})();
