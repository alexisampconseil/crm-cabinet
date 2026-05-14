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

// Sur Infomaniak, Next.js génère server.js dans sites/crm.ampconseil.com/
// On le remonte à la racine de standalone pour que le start command fonctionne
const infoServerSrc = path.join(standaloneDir, 'sites', 'crm.ampconseil.com', 'server.js')
const infoServerDest = path.join(standaloneDir, 'server.js')

if (fs.existsSync(infoServerSrc)) {
  fs.copyFileSync(infoServerSrc, infoServerDest)
  console.log('✓ server.js copié depuis sites/crm.ampconseil.com/')
} else {
  console.log('ℹ  sites/crm.ampconseil.com/server.js absent (build local — normal)')
}

console.log('✓ Assets copiés dans .next/standalone/')
