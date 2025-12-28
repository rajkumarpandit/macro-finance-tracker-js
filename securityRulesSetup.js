// This script helps deploy and test Firebase security rules
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function runCommand(command) {
  console.log(`\nRunning: ${command}`);
  try {
    const output = execSync(command, { encoding: 'utf8' });
    console.log(output);
    return true;
  } catch (error) {
    console.error(`Error executing command: ${error.message}`);
    return false;
  }
}

function deployRules() {
  console.log("\n=== Deploying Firestore Security Rules ===");
  return runCommand('firebase deploy --only firestore:rules');
}

function testRulesWithEmulator() {
  console.log("\n=== Testing Rules with Firebase Emulator ===");
  console.log("This will start the Firebase emulator for local testing");
  return runCommand('firebase emulators:start --only firestore');
}

function showMenu() {
  console.log("\n=== Firebase Security Rules Management ===");
  console.log("1. Deploy Firestore security rules");
  console.log("2. Test rules with Firebase emulator");
  console.log("3. Exit");
  
  rl.question("Select an option (1-3): ", (answer) => {
    switch(answer) {
      case '1':
        deployRules();
        setTimeout(showMenu, 1000);
        break;
      case '2':
        testRulesWithEmulator();
        // The emulator will keep running, so we don't return to menu
        break;
      case '3':
        rl.close();
        break;
      default:
        console.log("Invalid option. Please try again.");
        showMenu();
    }
  });
}

// Instructions
console.log("=== Firebase Security Rules Setup ===");
console.log("This script helps you deploy and test Firebase security rules");
console.log("Make sure you're logged into Firebase CLI before using this script");
console.log("Run 'firebase login' if you haven't already");

showMenu();