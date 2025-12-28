# Macro Finance Tracker

A React-based personal finance tracking application with Firebase backend for managing daily expenses, budgets, and financial insights.

## Features

- Track daily expenses with categories
- Set and monitor budgets
- Multi-user support with authentication
- Admin dashboard for user management
- Responsive design for mobile and desktop

## Getting Started

### 1. **Firebase Configuration**
   - Create a new Firebase project at https://console.firebase.google.com
   - Update \client/src/firebase/firebase.js\ with new project credentials
   - Update project ID in Firebase configuration

### 2. **Initialize Git Repository** (Optional)
   \\\powershell
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   \\\

### 3. **Install Dependencies**
   \\\powershell
   # Root dependencies
   npm install

   # Client dependencies
   cd client
   npm install
   \\\

### 4. **Initialize Firebase**
   \\\powershell
   firebase login
   firebase init
   # Select your new Firebase project
   # Choose Firestore, Hosting (if needed)
   \\\

### 5. **Deploy Firestore Rules and Indexes**
   \\\powershell
   firebase deploy --only firestore:rules
   firebase deploy --only firestore:indexes
   \\\

### 6. **Start Development**
   \\\powershell
   npm start
   # This will start the client application
   \\\

## Technology Stack

- **Frontend**: React.js, Material-UI
- **Backend**: Firebase (Firestore, Authentication)
- **Routing**: React Router v6
- **Charts**: Recharts

## Admin Configuration

Update admin emails in:
- \client/src/config/adminConfig.json\
- \firestore.rules\

---
**Author**: Raj Kumar Pandit  
**Year**: 2025
