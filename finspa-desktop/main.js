const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "FinSPA",
    // Das Fenster sieht moderner aus, wenn man die Standard-Menüleiste ausblendet
    autoHideMenuBar: true, 
    webPreferences: {
      // Wichtig: Da dein Loader reine Web-Technologie nutzt, 
      // brauchen wir hier keine speziellen Node-Rechte.
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Hier laden wir deinen angehängten Loader
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});