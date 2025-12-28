const firebase = require('@firebase/testing');
const fs = require('fs');

/*
 * ============
 * Test Suite for Updated Firestore Security Rules
 * ============
 */

const projectId = "macro-tracker-and-planner-test";
const rules = fs.readFileSync("firestore.rules", "utf8");

// Helper to set up Firebase Admin SDK
function getAdminApp() {
  return firebase.initializeAdminApp({ projectId });
}

// Helper to set up Firebase app with auth
function getAuthedApp(auth) {
  return firebase.initializeTestApp({
    projectId,
    auth
  });
}

// Clear any previous test data
function clearFirestoreData() {
  return firebase.clearFirestoreData({ projectId });
}

beforeAll(async () => {
  // Load the rules
  await firebase.loadFirestoreRules({
    projectId,
    rules
  });
});

beforeEach(async () => {
  // Clear the database between tests
  await clearFirestoreData();
});

afterAll(async () => {
  // Delete apps when done
  await Promise.all(firebase.apps().map(app => app.delete()));
});

describe("User Goals Security Rules", () => {
  it("should let users read only their own goals", async () => {
    // Set up some initial data using the admin app
    const admin = getAdminApp();
    const user1Id = "user1";
    const user2Id = "user2";
    
    // Create test data
    const goalsRef = admin.firestore().collection("user_goals");
    await goalsRef.doc("goal1").set({
      userId: user1Id,
      name: "Lose Weight",
      targetWeight: 70,
      deadline: new Date()
    });
    await goalsRef.doc("goal2").set({
      userId: user2Id,
      name: "Gain Muscle",
      targetWeight: 80,
      deadline: new Date()
    });
    
    // Test as user1
    const user1App = getAuthedApp({ uid: user1Id });
    const user1Snapshot = await user1App.firestore()
      .collection("user_goals")
      .where("userId", "==", user1Id)
      .get();
    
    // User1 should see their own data
    expect(user1Snapshot.empty).toBe(false);
    expect(user1Snapshot.docs.length).toBe(1);
    
    // Try to read user2's data
    const user1ReadingUser2 = user1App.firestore()
      .collection("user_goals")
      .doc("goal2")
      .get();
    
    // Should be denied
    await firebase.assertFails(user1ReadingUser2);
  });
  
  it("should prevent updating userId field", async () => {
    const admin = getAdminApp();
    const user1Id = "user1";
    
    // Create initial data
    await admin.firestore()
      .collection("user_goals")
      .doc("goal1")
      .set({
        userId: user1Id,
        name: "Initial Goal",
        targetWeight: 70
      });
      
    // Try to update the goal with a different userId
    const user1App = getAuthedApp({ uid: user1Id });
    const invalidUpdate = user1App.firestore()
      .collection("user_goals")
      .doc("goal1")
      .update({ 
        name: "Updated Goal",
        userId: "different-user" 
      });
      
    await firebase.assertFails(invalidUpdate);
    
    // Update with the same userId should succeed
    const validUpdate = user1App.firestore()
      .collection("user_goals")
      .doc("goal1")
      .update({ 
        name: "Updated Goal",
        userId: user1Id 
      });
      
    await firebase.assertSucceeds(validUpdate);
  });
});

describe("Macro Targets Security Rules", () => {
  it("should let users read only their own macro targets", async () => {
    // Set up some initial data using the admin app
    const admin = getAdminApp();
    const user1Id = "user1";
    const user2Id = "user2";
    
    // Create test data
    const targetsRef = admin.firestore().collection("macro_targets");
    await targetsRef.doc("target1").set({
      userId: user1Id,
      protein: 150,
      carbs: 200,
      fat: 60
    });
    await targetsRef.doc("target2").set({
      userId: user2Id,
      protein: 120,
      carbs: 250,
      fat: 50
    });
    
    // Test as user1
    const user1App = getAuthedApp({ uid: user1Id });
    const user1Snapshot = await user1App.firestore()
      .collection("macro_targets")
      .where("userId", "==", user1Id)
      .get();
    
    // User1 should see their own data
    expect(user1Snapshot.empty).toBe(false);
    expect(user1Snapshot.docs.length).toBe(1);
    
    // Try to read user2's data
    const user1ReadingUser2 = user1App.firestore()
      .collection("macro_targets")
      .doc("target2")
      .get();
    
    // Should be denied
    await firebase.assertFails(user1ReadingUser2);
  });
});

describe("Admin Collection Security Rules", () => {
  it("should deny access to non-admin users", async () => {
    // Setup admin data
    const admin = getAdminApp();
    await admin.firestore()
      .collection("admin")
      .doc("settings")
      .set({ 
        systemSetting: true,
        maintenance: false 
      });
      
    // Normal user without admin claim
    const normalUser = getAuthedApp({ uid: "user1" });
    const readAdminDoc = normalUser.firestore()
      .collection("admin")
      .doc("settings")
      .get();
      
    await firebase.assertFails(readAdminDoc);
  });
  
  it("should allow access to users with admin claim", async () => {
    // Setup admin data
    const admin = getAdminApp();
    
    // Create admin user in users collection
    await admin.firestore()
      .collection("users")
      .doc("admin1")
      .set({ 
        isAdmin: true,
        name: "Admin User" 
      });
    
    await admin.firestore()
      .collection("admin")
      .doc("settings")
      .set({ 
        systemSetting: true,
        maintenance: false 
      });
      
    // Admin user with admin claim in custom token
    const adminUserWithClaim = getAuthedApp({ 
      uid: "adminUser", 
      admin: true 
    });
    
    const readAdminWithClaim = adminUserWithClaim.firestore()
      .collection("admin")
      .doc("settings")
      .get();
      
    await firebase.assertSucceeds(readAdminWithClaim);
    
    // Admin user with isAdmin flag in user document
    const adminUserWithFlag = getAuthedApp({ uid: "admin1" });
    const readAdminWithFlag = adminUserWithFlag.firestore()
      .collection("admin")
      .doc("settings")
      .get();
      
    await firebase.assertSucceeds(readAdminWithFlag);
  });
});