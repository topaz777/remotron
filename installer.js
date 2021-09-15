#!/usr/bin/env node

const createWindowsInstaller = require('electron-winstaller').createWindowsInstaller
const path = require('path')
const rimraf = require('rimraf')

deleteOutputFolder()
  .then(getInstallerConfig)
  .then(createWindowsInstaller)
  .catch((error) => {
    console.error(error.message || error)
    process.exit(1)
  })

function getInstallerConfig () {
  const rootPath = path.join(__dirname, '.')
  const outPath = path.join(rootPath, 'out')

  return Promise.resolve({
    appDirectory: path.join(outPath, 'remotron2-win32-x64'),
    authors: "CatWalnut",
    exe: 'Remotron2.exe',
    iconUrl: path.join(rootPath, 'img', 'ico', 'cat_64.ico'),
    // loadingGif: path.join(rootPath, 'assets', 'img', 'loading.gif'),
    noMsi: true,
    outputDirectory: path.join(outPath, 'windows-installer'),
    setupExe: 'RemotronSetup.exe',
    setupIcon: path.join(rootPath, 'img', 'ico', 'cat_64.ico'),
    skipUpdateIcon: true
  })
}

function deleteOutputFolder () {
  return new Promise((resolve, reject) => {
    rimraf(path.join(__dirname, '.', 'out', 'windows-installer'), (error) => {
      error ? reject(error) : resolve()
    })
  })
}
