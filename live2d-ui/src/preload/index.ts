/* eslint-disable @typescript-eslint/ban-ts-comment */
import electron from 'electron';
const { contextBridge, ipcRenderer, desktopCapturer } = electron;
import { electronAPI } from '@electron-toolkit/preload';
import { ConfigFile } from '../main/menu-manager';

declare global {
  interface Window {
    electron: typeof electronAPI;
    // @ts-ignore
    api: typeof api;
  }
}

const api = {
  saveAvatarMedia: (data:ArrayBuffer,kind:string) => ipcRenderer.invoke('save-avatar-media',data,kind),
  setGlassRegions: (regions:any[],dark:boolean) => ipcRenderer.invoke('native-glass-regions',regions,dark),
  desktopAction: (action:string,args?:object) => ipcRenderer.invoke('desktop-action',action,args),
  recordingSource: () => ipcRenderer.invoke('recording-source'),
  saveScreenVideo: (data:ArrayBuffer) => ipcRenderer.invoke('save-screen-video',data),
  desktopCommandResult: (result:object) => ipcRenderer.send('desktop-command-result',result),
  onDesktopCommand: (callback:(data:any)=>void) => {const handler=(_event:unknown,data:any)=>callback(data);ipcRenderer.on('desktop-command',handler);return()=>ipcRenderer.removeListener('desktop-command',handler);},
  dragAvatar: (data: {phase:string;x?:number;y?:number}) => ipcRenderer.send('avatar-drag',data),
  readScreenText: () => ipcRenderer.invoke('read-screen-text'),
  openDesktopApp: (name:string) => ipcRenderer.invoke('open-desktop-app',name),
  chooseProfileFiles: () => ipcRenderer.invoke('choose-profile-files'),
  toggleAvatarSize: () => ipcRenderer.send('avatar-size-toggle'),
  showAvatarControlsMenu: (options: {x:number;y:number;busy:boolean}) => ipcRenderer.send('avatar-controls-menu',options),
  onWanderChanged: (callback: (enabled: boolean) => void) => {
    const handler = (_event: unknown, enabled: boolean) => callback(enabled);
    ipcRenderer.on('avatar-wander-changed', handler);
    return () => ipcRenderer.removeListener('avatar-wander-changed', handler);
  },
  setWander: (enabled: boolean) => ipcRenderer.send('avatar-wander', enabled),
  setIgnoreMouseEvents: (ignore: boolean) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore);
  },
  toggleForceIgnoreMouse: () => {
    ipcRenderer.send('toggle-force-ignore-mouse');
  },
  onForceIgnoreMouseChanged: (callback: (isForced: boolean) => void) => {
    const handler = (_event: any, isForced: boolean) => callback(isForced);
    ipcRenderer.on('force-ignore-mouse-changed', handler);
    return () => ipcRenderer.removeListener('force-ignore-mouse-changed', handler);
  },
  showContextMenu: () => {
    console.log('Preload showContextMenu');
    ipcRenderer.send('show-context-menu');
  },
  onModeChanged: (callback: (mode: string) => void) => {
    ipcRenderer.on('mode-changed', (_, mode) => callback(mode));
  },
  onMicToggle: (callback: () => void) => {
    const handler = (_event: any) => callback();
    ipcRenderer.on('mic-toggle', handler);
    return () => ipcRenderer.removeListener('mic-toggle', handler);
  },
  onInterrupt: (callback: () => void) => {
    const handler = (_event: any) => callback();
    ipcRenderer.on('interrupt', handler);
    return () => ipcRenderer.removeListener('interrupt', handler);
  },
  updateComponentHover: (componentId: string, isHovering: boolean) => {
    ipcRenderer.send('update-component-hover', componentId, isHovering);
  },
  onToggleInputSubtitle: (callback: () => void) => {
    const handler = (_event: any) => callback();
    ipcRenderer.on('toggle-input-subtitle', handler);
    return () => ipcRenderer.removeListener('toggle-input-subtitle', handler);
  },
  onToggleScrollToResize: (callback: () => void) => {
    const handler = (_event: any) => callback();
    ipcRenderer.on('toggle-scroll-to-resize', handler);
    return () => ipcRenderer.removeListener('toggle-scroll-to-resize', handler);
  },
  onSwitchCharacter: (callback: (filename: string) => void) => {
    const handler = (_event: any, filename: string) => callback(filename);
    ipcRenderer.on('switch-character', handler);
    return () => ipcRenderer.removeListener('switch-character', handler);
  },
  setMode: (mode: 'window' | 'pet') => {
    ipcRenderer.send('pre-mode-changed', mode);
  },
  getConfigFiles: () => ipcRenderer.invoke('get-config-files'),
  updateConfigFiles: (files: ConfigFile[]) => {
    ipcRenderer.send('update-config-files', files);
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', {
      ...electronAPI,
      desktopCapturer: {
        getSources: (options) => desktopCapturer.getSources(options),
      },
      ipcRenderer: {
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
        on: (channel, func) => ipcRenderer.on(channel, func),
        once: (channel, func) => ipcRenderer.once(channel, func),
        removeListener: (channel, func) => ipcRenderer.removeListener(channel, func),
        removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
        send: (channel, ...args) => ipcRenderer.send(channel, ...args),
      },
      process: {
        platform: process.platform,
      },
    });
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = electronAPI;
  (window as any).api = api;
}
