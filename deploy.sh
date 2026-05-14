#!/bin/bash
set -e

echo "==> git pull"
git pull origin main

echo "==> npm install"
npm ci --omit=dev=false

echo "==> build"
npm run build

echo "==> Deploy terminé — redémarrez le processus Node.js si nécessaire"
