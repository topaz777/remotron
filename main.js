const { app, BrowserWindow, ipcMain, clipboard, powerMonitor, powerSaveBlocker, Tray, Menu, screen, Notification, autoUpdater } = require('electron')
const { keyboard, Key, mouse, Point, Button } = require("@nut-tree/nut-js");
const path = require('path')
const logger = require('./logger');
const { mkdir } = require('fs');
if(require('electron-squirrel-startup')) return;

// ----------------------------------------------------------------------------------------------------

let mainWindow
let tray
let current_screen
let isCtrlDown = false;
let isAltDown = false;
let isShiftDown = false;
let prevClickIsRight = false;
let currentClipData = clipboard.readText();

// ----------------------------------------------------------------------------------------------------

function createWindow () {
  let primaryDisplay = screen.getPrimaryDisplay();

  current_screen = {
    width : primaryDisplay.size.width * primaryDisplay.scaleFactor,
    height : primaryDisplay.size.height * primaryDisplay.scaleFactor
  }

  mainWindow = new BrowserWindow({
    x: primaryDisplay.workAreaSize.width - 200,
    y: primaryDisplay.workAreaSize.height - 300,
    width: 200,
    height: 300,
    // opacity: 0,
    // show: false,
    // backgroundColor: '#2e2c29',
    // frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  mainWindow.loadFile('index.html')

  mainWindow.once('ready-to-show', () => {
    mainWindow.webContents.send("primaryDisplayId", primaryDisplay.id);

  })

  // Open the DevTools.
  mainWindow.webContents.openDevTools()

  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
    item.setSavePath(app.getPath("desktop") + "/" + item.getFilename());

    item.on('updated', (event, state) => {
      if(state === 'interrupted') {
        // console.log('interrupted')
      } else if(state === 'processing') {
        if(item.isPaused()) {

        } else {
          // console.log(item.getReceivedBytes())
        }
      }
    })

    item.once('done', (event, state) => {
      if(state === 'completed') {
        if(Notification.isSupported()) {
          new Notification({
            title : "다운로드 완료",
            body : item.getFilename(),
            icon : "./img/ico/cat_64.ico",
          }).show();
        } else {
          console.log("Notification.isSupported", false);
        }
      } else {
        console.log("[DownloadState]", state);
      }
    })
  })
}

app.disableHardwareAcceleration();

app.whenReady().then(() => {
  logger.info("Remotron Start");
  createWindow()
  setTray()
  powerMonitorListener()

  mkdir('./log', { recursive: false }, (err) => {
    if(err.code != "EEXIST") console.log(err);
  });
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// ----------------------------------------------------------------------------------------------------

// ipcMain
ipcMain.on('rtcConnection', function (event, arg) {
  logger.info("rtcConnection : " + arg);
})

ipcMain.on('controls', function (event, arg) {
  console.log(arg);

  var actVal = arg.split("[:]");

  switch (actVal[0]) {
    case "mouseMove":
      var xy = actVal[1].split(",");
      mouseMove(parseInt(xy[0]*current_screen.width), parseInt(xy[1]*current_screen.height));
      break;

    case "touchMove":
      var mouse = mouse.getPosition();
      var xy = actVal[1].split(",");
      mouseMove(parseInt(mouse.x - xy[0]*2), parseInt(mouse.y - xy[1]*2))
      break;

    case "mouseDown":
      if(actVal[1] == "1") {
        mouseToggle("down", "left");

        if(prevClickIsRight) {
          setTimeout(function() {
            clipIsChange(clipboard.readText());
          }, 500);
        }
        prevClickIsRight = false;

        // showMainWindow(true);
      } else if(actVal[1] == "3") {
        mouseToggle("down", "right");
      }
      break;

    case "mouseUp":
      if(actVal[1] == "1") {
        mouseToggle("up", "left");
        // showMainWindow(false);
      } else if(actVal[1] == "3") {
        mouseToggle("up", "right");
        prevClickIsRight = true;
      }
      break;

    case "wheel":
      scroll(actVal[1]);
      break;

    case "keyDown":
      var keySet = actVal[1].split("[=]");

      // Char
      if(keySet[0] >= 65 && keySet[0] <= 90) {
        keyboardType(String.fromCharCode(keySet[0]).toLowerCase())

        if(isCtrlDown) if(keySet[0] == 67 || keySet[0] == 88) {
          clipIsChange(clipboard.readText());
        }
      }

      // Num
      else if(keySet[0] >= 48 && keySet[0] <= 57) {
        keyboardType(Key["Num"+keySet[1]]);
      }

      // NumPad
      else if(keySet[0] > 96 && keySet[0] <= 105) {
        keyboardType(Key["NumPad"+keySet[1]]);

      } else {
       if(keySet[1].search("Arrow") >= 0) {
          keyboardType(Key[keySet[1].substr(5)]);
        }
        else if(keySet[1] == "Pause" || keySet[1] == "Cancel" || keySet[1] == "ScrollLock") {
          console.log("Key - Pause, Cnacel, ScrollLock");
        }
        else if(keySet[1] == "HangulMode") {
          // robot.keyTap("hangul");
        }
        else if(keySet[1] == "HanjaMode") {
          // robot.keyTap("hanja");
        }
        else if(keySet[1] == "Meta") {
          // robot.keyTap("command");
        }
        else if(keySet[1] == "Control") {
          keyboardToggle("down", Key.LeftControl);
          isCtrlDown = true;
        }
        else if(keySet[1] == "Alt") {
          keyboardToggle("down", Key.LeftAlt);
          isAltDown = true;
        }
        else if(keySet[1] == "Shift") {
          keyboardToggle("down", Key.LeftShift);
          isShiftDown = true;
        }
        else {
          if(typeof Key[keySet[1]] != "undefined") {
            keyboardType(Key[keySet[1]]);
          } else {
            keyboardType(keySet[1]);
          }


        }
      }
      break;

    case "keyUp":
      var keySet = actVal[1].split("[=]");
      if(keySet[1] == "Control") {
        if(isCtrlDown) {
          // robot.keyToggle(keySet[1].toLowerCase(), "up");
          keyboardToggle("up", Key.LeftControl);
          isCtrlDown = false;
        }
      } else if(keySet[1] == "Alt") {
        if(isAltDown) {
          // robot.keyToggle(keySet[1].toLowerCase(), "up");
          keyboardToggle("up", Key.LeftAlt);
          isAltDown = false;
        }
      } else if(keySet[1] == "Shift") {
        if(isShiftDown) {
          // robot.keyToggle(keySet[1].toLowerCase(), "up");
          keyboardToggle("up", Key.LeftShift);
          isShiftDown = false;
        }
      }
      break;
  }
})

ipcMain.on('clipboard', function (event, arg) {
  var pastedData = clipboard.readText();
  // robot.keyToggle("control", "up");
  isCtrlDown = false;
  // robot.typeString(pastedData);
})

ipcMain.on('logging', function (event, arg) {
  logger.info(arg);
})

// ----------------------------------------------------------------------------------------------------

// const id = powerSaveBlocker.start('prevent-display-sleep')
// logger.info("powerSaveBlocker.isStarted", powerSaveBlocker.isStarted(id))
// powerSaveBlocker.stop(id)

// ----------------------------------------------------------------------------------------------------

async function mouseMove(x, y) {
  await mouse.setPosition(new Point(x, y));
}

async function mouseToggle(flag, x) {
  if(flag == "down") {
    if(x == "left") {
      await mouse.pressButton(Button.LEFT);
    } else if(x == "right") {
      await mouse.pressButton(Button.RIGHT);
    }
  } else {
    if(x == "left") {
      await mouse.releaseButton(Button.LEFT);
    } else if(x == "right") {
      await mouse.releaseButton(Button.RIGHT);
    }
  }
}

async function scroll(x) {
    await mouse.scrollDown(x);
}

async function keyboardType(x) {
  await keyboard.type(x);
}

async function keyboardToggle(flag, x) {
  if(flag == "down") {
    await keyboard.pressKey(x);
  } else {
    await keyboard.releaseKey(x);
  }
}

function clipIsChange(str) {
  console.log("clipIsChange", str);

  if(currentClipData != str) {
    mainWindow.webContents.send("clipboard", str);
    currentClipData = str;
  }
}

function powerMonitorListener() {
  powerMonitor.on('on-ac', () => {
    logger.info("powerStatus : on-ac");
  })

  powerMonitor.on('on-battery', () => {
    logger.info("powerStatus : on-battery");
  })

  powerMonitor.on('suspend', () => {
    logger.info("powerStatus : suspend");
  })

  powerMonitor.on('resume', () => {
    logger.info("powerStatus : resume");
  })

  powerMonitor.on('lock-screen', () => {
    logger.info("powerStatus : lock-screen");
  })

  powerMonitor.on('unlock-screen', () => {
    logger.info("powerStatus : unlock-screen");
  })
}

function setTray() {
  tray = new Tray("./img/ico/cat_32.ico")

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Item1', type: 'normal' },
    { type: 'separator' },
    { label: 'Item2', type: 'radio', checked: true }
  ])

  tray.setToolTip('Remotron')
  tray.setContextMenu(contextMenu)
}

function showMainWindow(flag) {
  if(flag) {
    let opacity = 0;
    let intv = setInterval(function() {
      opacity += 0.1;
      if(opacity >= 1) {
        opacity = 1;
        clearInterval(intv);
      }
      mainWindow.setOpacity(opacity);
    }, 50);

  } else {
    let opacity = 1;
    let intv = setInterval(function() {
      opacity -= 0.2;
      if(opacity <= 0) {
        opacity = 0;
        clearInterval(intv);
      }
      mainWindow.setOpacity(opacity);
    }, 50);
  }
}


// -- autoUpdate -------------------------------------------------------------------------------------

require('update-electron-app')({
  repo: 'topaz777/remotron',
  updateInterval: '1 hour',
  logger: require('electron-log')
})


// -- electron-squirrel-startup ----------------------------------------------------------------------
// this should be placed at top of main.js to handle setup events quickly
if (handleSquirrelEvent()) {
  // squirrel event handled and app will exit in 1000ms, so don't do anything else
  return;
}

function handleSquirrelEvent() {
  if (process.argv.length === 1) {
    return false;
  }

  const ChildProcess = require('child_process');

  const appFolder = path.resolve(process.execPath, '..');
  const rootAtomFolder = path.resolve(appFolder, '..');
  const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
  const exeName = path.basename(process.execPath);

  const spawn = function(command, args) {
    let spawnedProcess, error;

    try {
      spawnedProcess = ChildProcess.spawn(command, args, {detached: true});
    } catch (error) {}

    return spawnedProcess;
  };

  const spawnUpdate = function(args) {
    return spawn(updateDotExe, args);
  };

  const squirrelEvent = process.argv[1];
  switch (squirrelEvent) {
    case '--squirrel-install':
    case '--squirrel-updated':
      // Optionally do things such as:
      // - Add your .exe to the PATH
      // - Write to the registry for things like file associations and
      //   explorer context menus

      // Install desktop and start menu shortcuts
      spawnUpdate(['--createShortcut', exeName]);

      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-uninstall':
      // Undo anything you did in the --squirrel-install and
      // --squirrel-updated handlers

      // Remove desktop and start menu shortcuts
      spawnUpdate(['--removeShortcut', exeName]);

      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-obsolete':
      // This is called on the outgoing version of your app before
      // we update to the new version - it's the opposite of
      // --squirrel-updated

      app.quit();
      return true;
  }
};
