const { app, BrowserWindow, Menu, dialog, ipcMain, nativeTheme, shell } = require('electron');
const fs = require('fs'), path = require('path');
let win;
let fileToOpenOnStartup = null;
if (process.argv.length >= 2) {
  const arg = process.argv[process.argv.length - 1];
  if (arg && (arg.endsWith('.guion') || arg.endsWith('.json')) && fs.existsSync(arg)) {
    fileToOpenOnStartup = arg;
  }
}
const FILT = [{ name: 'Proyecto de Punto G', extensions: ['guion', 'json'] }];
const send = c => win && win.webContents.send('menu', c);
const safe = s => String(s || 'Proyecto').replace(/[\\/:*?"<>|]/g, '').trim() || 'Proyecto';

function createWindow() {
  win = new BrowserWindow({
    width: 1100, height: 820, minWidth: 520, minHeight: 500,
    title: 'Punto G',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0e1116' : '#e9ecf2',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
}

const menu = [
  ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
  { label: 'Archivo', submenu: [
    { label: 'Mis proyectos', accelerator: 'CmdOrCtrl+Shift+H', click: () => send('home') },
    { type: 'separator' },
    { label: 'Proyecto nuevo', accelerator: 'CmdOrCtrl+N', click: () => send('new') },
    { label: 'Abrir…', accelerator: 'CmdOrCtrl+O', click: () => send('open') },
    { type: 'separator' },
    { label: 'Guardar', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
    { label: 'Guardar como…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('saveas') },
    { type: 'separator' },
    { label: 'Exportar guion en PDF…', accelerator: 'CmdOrCtrl+Shift+P', click: () => send('pdf-script') },
    { label: 'Exportar dossier en PDF…', accelerator: 'CmdOrCtrl+P', click: () => send('pdf') },
    { type: 'separator' },
    { label: 'Configuración…', accelerator: 'CmdOrCtrl+,', click: () => send('config') },
    { type: 'separator' },
    { role: 'quit', label: 'Salir' }] },
  { label: 'Edición', submenu: [
    { role: 'undo', label: 'Deshacer' }, { role: 'redo', label: 'Rehacer' }, { type: 'separator' },
    { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Pegar' },
    { role: 'selectAll', label: 'Seleccionar todo' }] },
  { label: 'Ver', submenu: [
    { role: 'resetZoom', label: 'Tamaño normal' }, { role: 'zoomIn', label: 'Acercar' }, { role: 'zoomOut', label: 'Alejar' },
    { type: 'separator' }, { role: 'togglefullscreen', label: 'Pantalla completa' }] }
];

ipcMain.handle('app:fileToOpen', () => {
  const p = fileToOpenOnStartup;
  fileToOpenOnStartup = null;
  if (p && fs.existsSync(p)) {
    try { return { path: p, data: JSON.parse(fs.readFileSync(p, 'utf8')) }; }
    catch (e) { return null; }
  }
  return null;
});

ipcMain.handle('file:readPath', async (e, p) => {
  if (!p || !fs.existsSync(p)) return { error: 'not_found' };
  try { return { path: p, data: JSON.parse(fs.readFileSync(p, 'utf8')) }; }
  catch (err) { return { error: 'invalid', message: err.message }; }
});

ipcMain.handle('file:showInFolder', (e, p) => {
  if (p && fs.existsSync(p)) {
    shell.showItemInFolder(p);
    return true;
  }
  return false;
});

ipcMain.handle('file:open', async () => {
  const r = await dialog.showOpenDialog(win, { filters: FILT, properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  try { const p = r.filePaths[0]; return { path: p, data: JSON.parse(fs.readFileSync(p, 'utf8')) }; }
  catch (e) { dialog.showErrorBox('No se pudo abrir', 'El archivo no es un proyecto válido.'); return null; }
});
ipcMain.handle('file:write', (e, data, p) => { try { fs.writeFileSync(p, data); return true; } catch (x) { return false; } });
ipcMain.on('file:writeSync', (e, data, p) => { try { fs.writeFileSync(p, data); e.returnValue = true; } catch (x) { e.returnValue = false; } });
ipcMain.handle('file:saveAs', async (e, data, name) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: safe(name) + '.guion', filters: FILT });
  if (r.canceled || !r.filePath) return null;
  try { fs.writeFileSync(r.filePath, data); return r.filePath; }
  catch (x) { dialog.showErrorBox('No se pudo guardar', String(x.message)); return null; }
});
ipcMain.handle('pdf:export', async (e, name, suffix = 'dossier') => {
  const sfx = suffix || 'dossier';
  const r = await dialog.showSaveDialog(win, { defaultPath: safe(name) + ' - ' + sfx + '.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (r.canceled || !r.filePath) return null;
  try {
    const buf = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true });
    fs.writeFileSync(r.filePath, buf); return r.filePath;
  } catch (x) { dialog.showErrorBox('No se pudo exportar el PDF', String(x.message)); return null; }
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
