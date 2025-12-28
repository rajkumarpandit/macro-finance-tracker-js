#!/bin/bash
echo "Deploying Firestore Rules..."

echo "Current directory: $(pwd)"

firebase deploy --only firestore:rules --project default

echo "Deployment complete!"
read -p "Press any key to continue..."