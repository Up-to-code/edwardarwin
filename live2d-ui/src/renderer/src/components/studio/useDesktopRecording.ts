import { useCallback, useEffect, useRef, useState } from 'react';
export function useDesktopRecording(){
 const [recording,setRecording]=useState(false);
 const [error,setError]=useState('');
 const session=useRef<{recorder:MediaRecorder;done:Promise<unknown>}|null>(null);
 const starting=useRef(false);
 const stop=useCallback(async()=>{const s=session.current;if(!s)return {recording:false};if(s.recorder.state!=='inactive')s.recorder.stop();return s.done;},[]);
 const start=useCallback(async()=>{
 if(session.current||starting.current)throw Error('A recording is already active.');starting.current=true;setError('');let stream:MediaStream|undefined;
 try{const api=window.api as any;const source=await api.recordingSource();if(!source)return {canceled:true};
 stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{mandatory:{chromeMediaSource:'desktop',chromeMediaSourceId:source,maxWidth:1920,maxHeight:1080,maxFrameRate:20}}} as any);
 const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(MediaRecorder.isTypeSupported);
 const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1200000});const chunks:Blob[]=[];let bytes=0;
 let resolve!:(v:unknown)=>void;let reject!:(e:Error)=>void;const done=new Promise((r,j)=>{resolve=r;reject=j;});done.catch(()=>{});
 const timer=setTimeout(()=>{if(recorder.state!=='inactive')recorder.stop();},300000);session.current={recorder,done};
 recorder.ondataavailable=e=>{if(e.data.size){chunks.push(e.data);bytes+=e.data.size;if(bytes>=60*1024*1024&&recorder.state!=='inactive')recorder.stop();}};
 recorder.onstop=async()=>{clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());setRecording(false);try{resolve(await api.saveScreenVideo(await new Blob(chunks,{type:mime||'video/webm'}).arrayBuffer()));}catch(e){const error=e instanceof Error?e:Error('Could not save recording.');setError(error.message);reject(error);}finally{session.current=null;}};
 recorder.onerror=()=>{if(recorder.state!=='inactive')recorder.stop();};stream.getVideoTracks()[0].onended=()=>{if(recorder.state!=='inactive')recorder.stop();};recorder.start(1000);setRecording(true);return {recording:true,audio:false};
 }catch(e){stream?.getTracks().forEach(t=>t.stop());throw e;}finally{starting.current=false;}
 },[]);
 useEffect(()=>{const api=window.api as any;return api?.onDesktopCommand?.(async(c:{id:string;action:string})=>{try{api.desktopCommandResult({id:c.id,value:await(c.action==='start_recording'?start():stop())});}catch(e){api.desktopCommandResult({id:c.id,error:e instanceof Error?e.message:'Recording failed.'});}});},[start,stop]);
 useEffect(()=>()=>{void stop();},[stop]);return {recording,start,stop,error};
}
