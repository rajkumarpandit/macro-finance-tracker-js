const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Copy the rules file to the test directory
const rulesPath = path.join(__dirname, '..', 'firestore.rules');
const testRulesPath = path.join(__dirname, 'firestore.rules');

console.log('Copying Firestore rules for testing...');
fs.copyFileSync(rulesPath, testRulesPath);

// Run the tests
console.log('Running security rules tests...');
try {
  // Use npx to directly call Jest without relying on npm scripts
  execSync('npx jest', { 
    stdio: 'inherit',
    cwd: __dirname  // Ensure we're in the rules-test directory
  });
  console.log('All tests passed! 🎉');
} catch (error) {
  console.error('Tests failed! Check the output above for details.');
  process.exit(1);
}