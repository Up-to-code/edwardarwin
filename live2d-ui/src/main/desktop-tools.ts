import { projectDirectory } from './local-project';
import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, shell } from 'electron';
import { createServer, Server } from 'http';
import { randomBytes } from 'crypto';
import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import { readFileSync } from 'fs';
import { execFile } from 'child_process';
export const DESKTOP_APPS=['Codex','Google Chrome','Safari','Notes','Calendar','Finder','Calculator','System Settings'];
export class DesktopTools {
 private server:Server|null=null;
 private lastWebsite:{url:string;title:string}|null=null;
 private pending=new Map<string,{resolve:(value:unknown)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 private project=projectDirectory();
 constructor(private getWindow:()=>BrowserWindow|null){}
 private window(){const w=this.getWindow();if(!w||w.isDestroyed())throw Error('Open Emma first.');return w;}
 private async api(path:string,method='GET',body?:unknown){const r=await fetch('http://127.0.0.1:12393/api/'+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)throw Error('Could not save to the local database.');return r.json();}
 private url(value:string){const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Use an HTTP or HTTPS URL without credentials.');return u.href;}
 async chooseScreen(){const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:1920,height:1200}});if(!sources.length)throw Error('Allow Emma Screen Recording in macOS Settings.');const r=await dialog.showMessageBox(this.window(),{title:'Choose screen',message:'Choose a screen to capture.',buttons:[...sources.map(s=>s.name),'Cancel'],cancelId:sources.length});if(r.response>=sources.length)return null;return sources[r.response];}
 private async renderer(action:string){const id=randomBytes(12).toString('hex');return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Recording action timed out.'));},60000);this.pending.set(id,{resolve,reject,timer});this.window().webContents.send('desktop-command',{id,action});});}
 async execute(action:string,args:Record<string,any>={}){
  if(action==='open_app'){if(!DESKTOP_APPS.includes(args.name))throw Error('Choose an available app.');await new Promise<void>((resolve,reject)=>execFile('/usr/bin/open',['-a',args.name],e=>e?reject(e):resolve()));return {opened:args.name};}
  if(action==='open_website'){const url=this.url(args.url);await new Promise<void>((resolve,reject)=>execFile('/usr/bin/open',['-a','Google Chrome',url],e=>e?reject(e):resolve()));this.lastWebsite={url,title:args.title||new URL(url).hostname};return this.lastWebsite;}
  if(action==='last_website')return this.lastWebsite||{message:'No website has been opened by Emma in this session. Ask the user for its URL.'};
  if(action==='save_source')return this.api('sources','PUT',{url:this.url(args.url),title:args.title||'',notes:args.notes||'',tags:args.tags||[]});
  if(action==='search_sources')return this.api('sources?q='+encodeURIComponent(args.query||''));
  if(action==='open_file'){const r=await dialog.showOpenDialog(this.window(),{title:'Choose a file or folder to open',defaultPath:typeof args.path==='string'?args.path:undefined,properties:['openFile','openDirectory']});if(r.canceled)return {canceled:true};const error=await shell.openPath(r.filePaths[0]);if(error)throw Error(error);return {opened:r.filePaths[0]};}
  if(action==='screenshot'){const source=await this.chooseScreen();if(!source)return {canceled:true};if(source.thumbnail.isEmpty())throw Error('Screen capture permission is needed.');const folder=join(this.project,'data/captures');await mkdir(folder,{recursive:true,mode:0o700});const path=join(folder,'screen-'+Date.now()+'.png');await writeFile(path,source.thumbnail.toPNG(),{mode:0o600});return this.api('captures','POST',{path,kind:'screenshot'});}
  if(action==='reveal_capture'){const data=await this.api('sources');if(!data.captures.some((f:{path:string})=>f.path===args.path))throw Error('Choose a saved capture.');shell.showItemInFolder(args.path);return {revealed:args.path};}
  if(action==='start_recording'||action==='stop_recording')return this.renderer(action);
  throw Error('Unknown desktop action.');
 }
 async start(){
  ipcMain.handle('save-avatar-media',async(event,data:ArrayBuffer,kind:string)=>{if(event.sender!==this.window().webContents||!(data instanceof ArrayBuffer)||data.byteLength>128*1024*1024||!['intro','emotions'].includes(kind))throw Error('Invalid avatar recording.');const folder=join(this.project,'docs/media');await mkdir(folder,{recursive:true});const path=join(folder,'emma-'+kind+'.webm');await writeFile(path,Buffer.from(data));return path;});
  ipcMain.handle('desktop-action',(event,action,args)=>{if(event.sender!==this.window().webContents)throw Error('Unavailable');return this.execute(action,args);});
  ipcMain.handle('recording-source',async event=>{if(event.sender!==this.window().webContents)throw Error('Unavailable');return (await this.chooseScreen())?.id||null;});
  ipcMain.handle('save-screen-video',async(event,data:ArrayBuffer)=>{if(event.sender!==this.window().webContents||!(data instanceof ArrayBuffer)||data.byteLength>64*1024*1024)throw Error('Recording is too large.');const folder=join(this.project,'data/captures');await mkdir(folder,{recursive:true,mode:0o700});const path=join(folder,'recording-'+Date.now()+'.webm');await writeFile(path,Buffer.from(data),{mode:0o600});return this.api('captures','POST',{path,kind:'screen-video'});});
  ipcMain.on('desktop-command-result',(event,result)=>{if(event.sender!==this.getWindow()?.webContents)return;const item=this.pending.get(result.id);if(!item)return;clearTimeout(item.timer);this.pending.delete(result.id);result.error?item.reject(Error(result.error)):item.resolve(result.value);});
  const token=randomBytes(32).toString('hex');
  this.server=createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');if(req.method!=='POST'||req.headers.authorization!=='Bearer '+token||req.headers.origin){res.writeHead(403);res.end('{"error":"Forbidden"}');return;}let body='';try{for await(const chunk of req){body+=chunk;if(body.length>64000)throw Error('Request too large');}const input=JSON.parse(body);const result=await this.execute(input.action,input.args);res.end(JSON.stringify(result));}catch(e){res.writeHead(400);res.end(JSON.stringify({error:e instanceof Error?e.message:'Action failed'}));}});
  await new Promise<void>(resolve=>this.server!.listen(0,'127.0.0.1',resolve));const address=this.server.address();if(!address||typeof address==='string')throw Error('Bridge unavailable');
  await mkdir(join(this.project,'data'),{recursive:true});await writeFile(join(this.project,'data/desktop-bridge.json'),JSON.stringify({port:address.port,token}),{mode:0o600});
 }
 async close(){this.server?.close();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('Emma closed.'));}this.pending.clear();await rm(join(this.project,'data/desktop-bridge.json'),{force:true});}
}
