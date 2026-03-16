#!/bin/bash

# S.P.E.C.T.R.E Deployment Script
# Automates the build and deployment process to Firebase Cloud Infrastructure.

echo "------------------------------------------------"
echo "🚀 Starting S.P.E.C.T.R.E Deployment Sequence..."
echo "------------------------------------------------"

# 1. Install Dependencies
echo "📦 Step 1: Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Error: npm install failed."
    exit 1
fi

# 2. Run Linting
echo "🔍 Step 2: Running lint check..."
npm run lint
if [ $? -ne 0 ]; then
    echo "⚠️ Warning: Linting found issues, but proceeding with build..."
fi

# 3. Build Frontend
echo "🏗️ Step 3: Building production assets..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Error: Build failed."
    exit 1
fi

# 4. Deploy to Firebase
# Note: Requires firebase-tools to be installed and authenticated
echo "☁️ Step 4: Deploying to Firebase Hosting and Firestore..."
if command -v firebase &> /dev/null
then
    firebase deploy --only hosting,firestore
else
    echo "⚠️ firebase-tools not found in PATH. Attempting via npx..."
    npx firebase-tools deploy --only hosting,firestore
fi

if [ $? -eq 0 ]; then
    echo "------------------------------------------------"
    echo "✅ S.P.E.C.T.R.E Deployment Successful!"
    echo "🌐 Live at: https://fir-p-e-c-t-r-e-bdd37.web.app/"
    echo "------------------------------------------------"
else
    echo "❌ Error: Firebase deployment failed."
    exit 1
fi
