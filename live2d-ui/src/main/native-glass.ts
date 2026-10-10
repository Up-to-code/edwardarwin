import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { createRequire } from 'module';
type Region={x:number;y:number;width:number;height:number;radius:number};
export function setupNativeGlass(getWindow:()=>BrowserWindow|null){
 let reported=false;
 let addon:{update:(handle:Buffer,regions:Region[],dark:boolean)=>boolean}|null=null;
 if(process.platform==='darwin'){
  try{const requireNative=createRequire(__filename);addon=requireNative(app.isPackaged?join(process.resourcesPath,'nori-glass.node'):join(__dirname,'../../resources/nori-glass.node'));}catch(error){console.warn('Native glass unavailable; using translucent controls.',error);}
 }
 ipcMain.handle('native-glass-regions',(event,regions:Region[],dark:boolean)=>{
  const window=getWindow();if(!window||window.isDestroyed()||event.sender!==window.webContents||!addon||!Array.isArray(regions)||regions.length>10)return false;
  const [width,height]=window.getContentSize();
  if(regions.some(r=>!r||![r.x,r.y,r.width,r.height,r.radius].every(Number.isFinite)||r.x<0||r.y<0||r.width<=0||r.height<=0||r.x+r.width>width+1||r.y+r.height>height+1))return false;
  const applied=addon.update(window.getNativeWindowHandle(),regions,!!dark);
  if(applied&&!reported&&regions.length){reported=true;console.info('[Native glass] Public NSGlassEffectView active.');}
  return applied;
 });
}
