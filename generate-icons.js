const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function createIcon(size, outputPath) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  const radius = size * 0.15;
  
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#6ba8e5');
  gradient.addColorStop(1, '#4a90d9');
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, radius);
  ctx.fill();
  
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.55}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('K', size / 2, size * 0.55);
  
  const badgeSize = size * 0.25;
  const badgeX = size * 0.75;
  const badgeY = size * 0.25;
  
  ctx.fillStyle = '#ffc107';
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, badgeSize / 2, 0, Math.PI * 2);
  ctx.fill();
  
  const imageBuffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, imageBuffer);
  console.log(`Created: ${outputPath} (${size}x${size})`);
}

const pwaDir = path.join(__dirname, 'pwa');
createIcon(192, path.join(pwaDir, 'icon-192.png'));
createIcon(512, path.join(pwaDir, 'icon-512.png'));
console.log('Done!');