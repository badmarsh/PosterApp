const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const dir = path.join(process.cwd(), 'public', 'logos');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const atlasSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 300" width="800" height="300">
  <g transform="translate(40, 30)">
    <ellipse cx="120" cy="120" rx="100" ry="100" fill="none" stroke="#C8102E" stroke-width="8" stroke-dasharray="180 30 60 40" opacity="0.85" />
    <ellipse cx="120" cy="120" rx="75" ry="75" fill="none" stroke="#003366" stroke-width="6" stroke-dasharray="120 40 40 20" opacity="0.85" />
    <ellipse cx="120" cy="120" rx="48" ry="48" fill="none" stroke="#C8102E" stroke-width="5" />
    <circle cx="120" cy="120" r="16" fill="#C8102E" />
    <path d="M 120,20 L 120,220 M 20,120 L 220,120 M 45,45 L 195,195 M 45,195 L 195,45" stroke="#003366" stroke-width="3" stroke-linecap="round" opacity="0.6" />

    <text x="260" y="150" font-family="Helvetica, Arial, sans-serif" font-size="125" font-weight="900" fill="#003366" letter-spacing="4">ATLAS</text>
    <text x="265" y="200" font-family="Helvetica, Arial, sans-serif" font-size="28" font-weight="600" fill="#C8102E" letter-spacing="6">EXPERIMENT</text>
  </g>
</svg>
`;

const ukSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400">
  <g transform="translate(50, 40)">
    <path d="M 100,20 L 220,20 Q 250,20 250,50 L 250,180 Q 250,280 160,320 Q 70,280 70,180 L 70,50 Q 70,20 100,20 Z" fill="#003366" />
    <path d="M 105,30 L 215,30 Q 240,30 240,55 L 240,175 Q 240,265 160,305 Q 80,265 80,175 L 80,55 Q 80,30 105,30 Z" fill="#FFFFFF" />
    <path d="M 115,45 L 205,45 Q 225,45 225,65 L 225,170 Q 225,245 160,285 Q 95,245 95,170 L 95,65 Q 95,45 115,45 Z" fill="#C8102E" />

    <path d="M 125,130 Q 160,115 160,140 Q 160,115 195,130 L 195,190 Q 160,175 160,200 Q 160,175 125,190 Z" fill="#FFFFFF" stroke="#003366" stroke-width="2" />
    
    <text x="290" y="130" font-family="Georgia, serif" font-size="70" font-weight="bold" fill="#003366">UNIVERSITY</text>
    <text x="295" y="195" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="700" fill="#C8102E" letter-spacing="4">OF EXCELLENCE</text>
    <text x="295" y="240" font-family="Helvetica, Arial, sans-serif" font-size="20" font-weight="500" fill="#555555" letter-spacing="2">RESEARCH &amp; INNOVATION</text>
  </g>
</svg>
`;

async function main() {
  await sharp(Buffer.from(atlasSvg))
    .png()
    .toFile(path.join(dir, 'atlas_transparent.png'));
  console.log('Created atlas_transparent.png');

  await sharp(Buffer.from(ukSvg))
    .png()
    .toFile(path.join(dir, 'uk_logo.png'));
  console.log('Created uk_logo.png');
}

main().catch(console.error);
