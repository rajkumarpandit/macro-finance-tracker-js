/**
 * Simple script to compress JavaScript and CSS files using Node.js zlib
 */

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const util = require('util');

// Convert callbacks to Promises
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);
const gzip = util.promisify(zlib.gzip);
const writeFile = util.promisify(fs.writeFile);

// Settings
const buildDir = path.join(__dirname, '../build');
const jsDir = path.join(buildDir, 'static/js');
const cssDir = path.join(buildDir, 'static/css');

async function compressFiles(directory, extension) {
  try {
    const files = await readdir(directory);
    
    for (const file of files) {
      if (file.endsWith(extension)) {
        const filePath = path.join(directory, file);
        const fileStats = await stat(filePath);
        
        if (fileStats.isFile()) {
          console.log(`Compressing ${file}...`);
          
          const content = fs.readFileSync(filePath);
          const compressed = await gzip(content, { level: 9 });
          
          await writeFile(`${filePath}.gz`, compressed);
          
          const originalSize = fileStats.size;
          const compressedSize = compressed.length;
          const savings = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
          
          console.log(`✅ ${file}: ${originalSize} bytes → ${compressedSize} bytes (${savings}% savings)`);
        }
      }
    }
  } catch (error) {
    console.error(`Error compressing files: ${error.message}`);
  }
}

async function main() {
  console.log('Starting compression...');
  
  // Compress JavaScript files
  await compressFiles(jsDir, '.js');
  
  // Compress CSS files
  await compressFiles(cssDir, '.css');
  
  console.log('Compression completed!');
}

main().catch(console.error);