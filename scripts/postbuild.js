#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return
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

const standaloneDir = path.join('.next', 'standalone')

// Assets statiques — toujours nécessaires
copyDir('public', path.join(standaloneDir, 'public'))
copyDir(path.join('.next', 'static'), path.join(standaloneDir, '.next', 'static'))

fs.copyFileSync(path.join(standaloneDir, 'sites', 'crm.ampconseil.com', 'server.js'), path.join(standaloneDir, 'server.js'))

console.log('✓ Assets copiés dans .next/standalone/')
