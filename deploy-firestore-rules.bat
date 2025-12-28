@echo off
echo Deploying Firestore Rules...

echo Current directory: %CD%

firebase deploy --only firestore:rules --project default

echo Deployment complete!
pause