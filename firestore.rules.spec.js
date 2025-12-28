const firebase = require('@firebase/testing');
const fs = require('fs');

/*
 * ============
 * Test Suite for Firestore Security Rules
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

describe("Daily Food Log Security Rules", () => {
  it("should let users read only their own logs", async () => {
    // Set up some initial data using the admin app
    const admin = getAdminApp();
    const user1Id = "user1";
    const user2Id = "user2";
    
    // Create test data
    const dailyLogRef = admin.firestore().collection("daily_food_log");
    await dailyLogRef.doc("log1").set({
      userId: user1Id,
      date: new Date(),
      foods: [{ name: "Test Food", calories: 100 }]
    });
    await dailyLogRef.doc("log2").set({
      userId: user2Id,
      date: new Date(),
      foods: [{ name: "Another Test Food", calories: 200 }]
    });
    
    // Test as user1
    const user1App = getAuthedApp({ uid: user1Id });
    const user1Snapshot = await user1App.firestore()
      .collection("daily_food_log")
      .where("userId", "==", user1Id)
      .get();
    
    // User1 should see their own data
    expect(user1Snapshot.empty).toBe(false);
    expect(user1Snapshot.docs.length).toBe(1);
    
    // Try to read user2's data
    const user1ReadingUser2 = user1App.firestore()
      .collection("daily_food_log")
      .doc("log2")
      .get();
    
    // Should be denied
    await firebase.assertFails(user1ReadingUser2);
  });
  
  it("should let users create logs with their own userId", async () => {
    const user1Id = "user1";
    const user1App = getAuthedApp({ uid: user1Id });
    
    // Create a valid log
    const validLog = user1App.firestore()
      .collection("daily_food_log")
      .add({
        userId: user1Id,
        date: new Date(),
        foods: [{ name: "New Food", calories: 300 }]
      });
    
    await firebase.assertSucceeds(validLog);
    
    // Try to create a log with another user's ID
    const invalidLog = user1App.firestore()
      .collection("daily_food_log")
      .add({
        userId: "someOtherUserId",
        date: new Date(),
        foods: [{ name: "Sneaky Food", calories: 400 }]
      });
    
    await firebase.assertFails(invalidLog);
  });
});

describe("Food Master Security Rules", () => {
  it("should allow all authenticated users to read any food item", async () => {
    // Set up initial data
    const admin = getAdminApp();
    await admin.firestore().collection("food_calorie_master").doc("food1").set({
      userId: "user1",
      name: "User 1's Food",
      calories: 100,
      isEditable: false
    });
    
    // Test read access with different user
    const user2App = getAuthedApp({ uid: "user2" });
    const readFood = user2App.firestore()
      .collection("food_calorie_master")
      .doc("food1")
      .get();
    
    await firebase.assertSucceeds(readFood);
  });
  
  it("should only allow users to update their own food items", async () => {
    // Set up initial data
    const admin = getAdminApp();
    await admin.firestore().collection("food_calorie_master").doc("food1").set({
      userId: "user1",
      name: "Original Food Name",
      calories: 100,
      isEditable: true
    });
    
    // Owner should be able to update
    const user1App = getAuthedApp({ uid: "user1" });
    const validUpdate = user1App.firestore()
      .collection("food_calorie_master")
      .doc("food1")
      .update({ name: "Updated Food Name" });
    
    await firebase.assertSucceeds(validUpdate);
    
    // Non-owner should not be able to update
    const user2App = getAuthedApp({ uid: "user2" });
    const invalidUpdate = user2App.firestore()
      .collection("food_calorie_master")
      .doc("food1")
      .update({ name: "Hacked Food Name" });
    
    await firebase.assertFails(invalidUpdate);
  });
});

describe("User Profile Security Rules", () => {
  it("should only allow users to access their own profiles", async () => {
    // Set up initial data
    const admin = getAdminApp();
    await admin.firestore().collection("users").doc("user1").set({
      name: "User One",
      email: "user1@example.com",
      pin: "encryptedPin1234"
    });
    
    // User should be able to read own profile
    const user1App = getAuthedApp({ uid: "user1" });
    const validRead = user1App.firestore()
      .collection("users")
      .doc("user1")
      .get();
    
    await firebase.assertSucceeds(validRead);
    
    // User should not be able to read another user's profile
    const invalidRead = user1App.firestore()
      .collection("users")
      .doc("user2")
      .get();
    
    await firebase.assertFails(invalidRead);
  });
});