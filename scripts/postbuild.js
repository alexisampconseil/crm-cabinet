#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry)
    const destPath = path.join(dest, entry)
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

copyDir('public', path.join('.next', 'standalone', 'public'))
copyDir(path.join('.next', 'static'), path.join('.next', 'standalone', '.next', 'static'))

console.log('✓ Assets copiés dans .next/standalone/')
