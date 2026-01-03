/**
 * Script to generate Android icons from the PWA icon
 *
 * To use this script:
 * 1. Make sure you have a 512x512 PNG icon at public/pwa-512x512.png
 * 2. Install sharp: npm install sharp --save-dev
 * 3. Run: node scripts/generate-android-icons.js
 *
 * Or use Android Studio's Image Asset Studio for more control.
 */

const fs = require('fs');
const path = require('path');

// Icon sizes for Android
const androidIconSizes = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 }
];

const androidResPath = path.join(__dirname, '../android/app/src/main/res');
const sourceIcon = path.join(__dirname, '../public/pwa-512x512.png');

async function generateIcons() {
  try {
    // Try to use sharp if available
    const sharp = require('sharp');

    for (const { folder, size } of androidIconSizes) {
      const outputDir = path.join(androidResPath, folder);

      // Create directory if it doesn't exist
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Generate ic_launcher.png
      await sharp(sourceIcon)
        .resize(size, size)
        .png()
        .toFile(path.join(outputDir, 'ic_launcher.png'));

      // Generate ic_launcher_round.png (same for now)
      await sharp(sourceIcon)
        .resize(size, size)
        .png()
        .toFile(path.join(outputDir, 'ic_launcher_round.png'));

      // Generate ic_launcher_foreground.png (slightly larger for adaptive icons)
      await sharp(sourceIcon)
        .resize(Math.round(size * 1.5), Math.round(size * 1.5))
        .png()
        .toFile(path.join(outputDir, 'ic_launcher_foreground.png'));

      console.log(`Generated icons for ${folder} (${size}x${size})`);
    }

    // Generate splash screen
    const drawablePath = path.join(androidResPath, 'drawable');
    if (!fs.existsSync(drawablePath)) {
      fs.mkdirSync(drawablePath, { recursive: true });
    }

    await sharp(sourceIcon)
      .resize(512, 512)
      .png()
      .toFile(path.join(drawablePath, 'splash.png'));

    console.log('Generated splash.png');
    console.log('\\nAll Android icons generated successfully!');

  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.log('\\n==================================================');
      console.log('Sharp module not found. Please either:');
      console.log('');
      console.log('1. Install sharp and run this script:');
      console.log('   npm install sharp --save-dev');
      console.log('   node scripts/generate-android-icons.js');
      console.log('');
      console.log('2. Or use Android Studio Image Asset Studio:');
      console.log('   - Open Android Studio');
      console.log('   - Right-click on res folder');
      console.log('   - New > Image Asset');
      console.log('   - Select your icon from public/pwa-512x512.png');
      console.log('==================================================\\n');

      // Copy the existing 192x192 icon as a fallback
      console.log('Copying existing PWA icon as fallback...');
      const source192 = path.join(__dirname, '../public/pwa-192x192.png');

      // Copy to xxxhdpi (192x192 is perfect for this)
      const xxxhdpiDir = path.join(androidResPath, 'mipmap-xxxhdpi');
      if (fs.existsSync(xxxhdpiDir) && fs.existsSync(source192)) {
        fs.copyFileSync(source192, path.join(xxxhdpiDir, 'ic_launcher.png'));
        fs.copyFileSync(source192, path.join(xxxhdpiDir, 'ic_launcher_round.png'));
        console.log('Copied to mipmap-xxxhdpi');
      }

    } else {
      console.error('Error generating icons:', error);
    }
  }
}

generateIcons();
