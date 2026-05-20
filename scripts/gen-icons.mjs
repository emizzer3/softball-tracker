import sharp from 'sharp'

const svg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#2563eb"/>
  <circle cx="256" cy="256" r="170" fill="white"/>
  <circle cx="256" cy="256" r="170" fill="none" stroke="#dc2626" stroke-width="12"/>
  <!-- Softball seam curves -->
  <path d="M 130 200 Q 180 256 130 310" fill="none" stroke="#dc2626" stroke-width="10" stroke-linecap="round"/>
  <path d="M 382 200 Q 332 256 382 310" fill="none" stroke="#dc2626" stroke-width="10" stroke-linecap="round"/>
</svg>
`)

for (const size of [192, 512]) {
  await sharp(svg).resize(size, size).png().toFile(`public/icon-${size}.png`)
  console.log(`Generated icon-${size}.png`)
}
