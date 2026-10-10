/* eslint-disable no-shadow */
import { app, ipcMain, globalShortcut, desktopCapturer, screen, Menu, nativeImage, dialog } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import { join, basename, extname } from 'path';
import { readFileSync, statSync } from 'fs';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import { chooseProject, projectDirectory } from "./local-project";
import { setupNativeGlass } from "./native-glass";
import { DesktopTools, DESKTOP_APPS } from "./desktop-tools";
import { WindowManager } from "./window-manager";
import { MenuManager } from "./menu-manager";

let windowManager: WindowManager;
let menuManager: MenuManager;
let isQuitting = false;
let desktopTools:DesktopTools;
const ownsInstance=app.requestSingleInstanceLock();
if(!ownsInstance)app.quit();
app.on('second-instance',()=>{const window=windowManager?.getWindow();if(window){window.show();window.focus();}});

function setupIPC(): void {
  let dragOrigin: {x:number;y:number}|null=null;
  ipcMain.on('avatar-drag', (event, data) => {
    const window=windowManager.getWindow();
    if(!window||event.sender!==window.webContents||windowManager.getCurrentMode()!=='pet')return;
    if(data.phase==='start'){windowManager.setWander(false);const bounds=window.getBounds();dragOrigin={x:bounds.x,y:bounds.y};}
    else if(data.phase==='end')dragOrigin=null;
    else if(dragOrigin&&Number.isFinite(data.x)&&Number.isFinite(data.y)){
      const area=screen.getDisplayMatching(window.getBounds()).workArea;const b=window.getBounds();
      window.setPosition(Math.round(Math.max(area.x,Math.min(dragOrigin.x+data.x,area.x+area.width-b.width))),Math.round(Math.max(area.y,Math.min(dragOrigin.y+data.y,area.y+area.height-b.height))));
    }
  });
  ipcMain.handle('open-desktop-app', async (event, name) => {
    const window=windowManager.getWindow();
    if(!window||event.sender!==window.webContents||!DESKTOP_APPS.includes(name))throw Error('Choose an available app.');
    await new Promise<void>((resolve,reject)=>execFile('/usr/bin/open',['-a',name],error=>error?reject(error):resolve()));
  });
  ipcMain.handle('read-screen-text', async event => {
    const window=windowManager.getWindow();if(!window||event.sender!==window.webContents)throw Error('Unavailable.');
    const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:1920,height:1200}});
    if(!sources.length)throw Error('Allow Emma Screen Recording in macOS Settings, then reopen Emma.');
    const choice=await dialog.showMessageBox(window,{type:'question',title:'Read screen text',message:'Choose the screen to read once.',detail:'Text is extracted on this Mac. You can review it before sending it to Emma.',buttons:[...sources.map(s=>s.name),'Cancel'],cancelId:sources.length});
    if(choice.response>=sources.length)return null;
    if(sources[choice.response].thumbnail.isEmpty())throw Error('Allow Emma Screen Recording in macOS Settings, then reopen Emma.');
    const directory=await mkdtemp(join(tmpdir(),'nori-screen-'));
    try{
      const path=join(directory,'screen.png');await writeFile(path,sources[choice.response].thumbnail.toPNG(),{mode:0o600});
      const helper=app.isPackaged?join(process.resourcesPath,'screen-ocr'):join(__dirname,'../../resources/screen-ocr');
      const output=await new Promise<string>((resolve,reject)=>execFile(helper,[path],{timeout:20000,maxBuffer:1000000},(error,stdout)=>error?reject(error):resolve(stdout)));
      return JSON.parse(output).text.slice(0,12000);
    }finally{await rm(directory,{recursive:true,force:true});}
  });
  ipcMain.handle('choose-profile-files', async event => {
    const window = windowManager.getWindow();
    if (!window || event.sender !== window.webContents) return [];
    const result = await dialog.showOpenDialog(window,{title:'Choose personal reference files',properties:['openFile','multiSelections'],filters:[{name:'Text files',extensions:['txt','md','json','csv']}]});
    if (result.canceled) return [];
    return result.filePaths.slice(0,4).map(path=>{
      if (!['.txt','.md','.json','.csv'].includes(extname(path).toLowerCase()) || statSync(path).size>64000) throw Error('Choose text files smaller than 64 KB.');
      return {name:basename(path),text:readFileSync(path,'utf8').slice(0,8000)};
    });
  });
  ipcMain.on('avatar-size-toggle', event => {
    if (event.sender === windowManager.getWindow()?.webContents) windowManager.toggleCompactSize();
  });
  ipcMain.on('avatar-controls-menu', (event, options) => {
    const window = windowManager.getWindow();
    if (!window || window.isDestroyed() || event.sender !== window.webContents) return;
    Menu.buildFromTemplate([
      {label:'Wander',type:'checkbox',checked:windowManager.isWandering(),click:()=>windowManager.setWander(!windowManager.isWandering())},
      {label:'Stop speaking',enabled:options?.busy===true,click:()=>window.webContents.send('interrupt')},
      {type:'separator'},
      {label:'Settings…',click:()=>windowManager.setWindowMode('window')},
      {label:'Small / normal size',click:()=>windowManager.toggleCompactSize()},
      {label:'Hide avatar',click:()=>{windowManager.setWander(false);window.hide();}},
      {type:'separator'},
      {label:'Quit Emma',click:()=>app.quit()},
    ]).popup({window,x:Number.isFinite(options?.x)?Math.round(options.x):0,y:Number.isFinite(options?.y)?Math.round(options.y):0});
  });
  ipcMain.handle("get-platform", () => process.platform);

  ipcMain.on("set-ignore-mouse-events", (_event, ignore: boolean) => {
    const window = windowManager.getWindow();
    if (window) {
      windowManager.setIgnoreMouseEvents(ignore);
    }
  });

  ipcMain.on("get-current-mode", (event) => {
    event.returnValue = windowManager.getCurrentMode();
  });

  ipcMain.on("pre-mode-changed", (_event, newMode) => {
    if (newMode === 'window' || newMode === 'pet') {
      menuManager.setMode(newMode);
    }
  });

  ipcMain.on("window-minimize", () => {
    windowManager.getWindow()?.minimize();
  });

  ipcMain.on("window-maximize", () => {
    const window = windowManager.getWindow();
    if (window) {
      windowManager.maximizeWindow();
    }
  });

  ipcMain.on("window-close", () => {
    const window = windowManager.getWindow();
    if (window) {
      if (process.platform === "darwin") {
        window.hide();
      } else {
        window.close();
      }
    }
  });

  ipcMain.on(
    "update-component-hover",
    (_event, componentId: string, isHovering: boolean) => {
      windowManager.updateComponentHover(componentId, isHovering);
    },
  );

  ipcMain.handle("get-config-files", () => {
    const configFiles = JSON.parse(localStorage.getItem("configFiles") || "[]");
    menuManager.updateConfigFiles(configFiles);
    return configFiles;
  });

  ipcMain.on("update-config-files", (_event, files) => {
    menuManager.updateConfigFiles(files);
  });

  ipcMain.handle('get-screen-capture', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    return sources[0].id;
  });
}

app.setName("Emma Darwin");
app.whenReady().then(async () => {
  if(!ownsInstance)return;
  if (app.isPackaged) {
    try {
      await chooseProject();
      const project = {directory:projectDirectory()};
      await new Promise<void>((resolve,reject)=>execFile('/bin/zsh',[join(project.directory,'start-local-services.command')],{timeout:90000},error=>error?reject(error):resolve()));
    } catch (error) {
      dialog.showErrorBox('Emma could not start','The local voice services could not start. Check the project logs or launch run-desktop-avatar.command.');
      app.quit();return;
    }
  }
  if (!app.isPackaged) await chooseProject();
  if (process.platform === 'darwin') app.dock?.setIcon(nativeImage.createFromPath(join(__dirname,'../../resources/icon.png')));
  electronApp.setAppUserModelId("com.electron");

  windowManager = new WindowManager();
  menuManager = new MenuManager((mode) => windowManager.setWindowMode(mode));

  const window = windowManager.createWindow({});
  menuManager.createTray();
  if (process.platform === 'darwin') Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:'Emma',submenu:[{role:'about'},{label:'Settings…',accelerator:'CmdOrCtrl+,',click:()=>windowManager.setWindowMode('window')},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]},
    {role:'editMenu'},{role:'windowMenu'},
  ]));
  if (process.argv.includes('--pet')) {
    window.webContents.once('did-finish-load', () => {
      setTimeout(() => windowManager.setWindowMode('pet'), 1200);
    });
  }

  window.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      window.hide();
    }
    return false;
  });

  // if (process.env.NODE_ENV === "development") {
  //   globalShortcut.register("F12", () => {
  //     const window = windowManager.getWindow();
  //     if (!window) return;

  //     if (window.webContents.isDevToolsOpened()) {
  //       window.webContents.closeDevTools();
  //     } else {
  //       window.webContents.openDevTools();
  //     }
  //   });
  // }

  setupIPC();
  setupNativeGlass(()=>windowManager.getWindow());
  desktopTools=new DesktopTools(()=>windowManager.getWindow());
  await desktopTools.start();
  app.on('before-quit',()=>{void desktopTools.close();});

  app.on("activate", () => {
    const window = windowManager.getWindow();
    if (window) {
      window.show();
    }
  });

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  app.on('web-contents-created', (_, contents) => {
    contents.session.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media') {
        callback(true);
      } else {
        callback(false);
      }
    });
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  menuManager?.destroy();
  globalShortcut.unregisterAll();
});
