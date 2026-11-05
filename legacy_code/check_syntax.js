const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('[ShiftStack Syntax Checker] Validating all JS files...');

function getJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        results = results.concat(getJsFiles(fullPath));
      }
    } else if (file.endsWith('.js')) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = getJsFiles(__dirname);
let errors = 0;

files.forEach(f => {
  try {
    execSync(`node -c "${f}"`);
    console.log(`  ✓ ${path.relative(__dirname, f)}`);
  } catch (err) {
    console.error(`  ✗ Error in ${path.relative(__dirname, f)}:`, err.message);
    errors++;
  }
});

if (errors === 0) {
  console.log(`\n🎉 Success: All ${files.length} JavaScript files passed syntax verification!`);
} else {
  console.error(`\n❌ Failed: ${errors} syntax errors found.`);
  process.exit(1);
}

