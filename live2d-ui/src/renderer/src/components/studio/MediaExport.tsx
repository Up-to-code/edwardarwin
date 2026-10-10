import { useEffect, useRef, useState } from 'react';
type Segment = { start:number; end:number; expression:string; text:string };
const emotions = ['exp_01','exp_02','exp_05','exp_06','exp_07','chat_anger','exp_08'];
export function MediaExport({ready}:{ready:boolean}) {
 const [recording,setRecording]=useState(false),[status,setStatus]=useState('');
 const recorder=useRef<MediaRecorder|null>(null);
 useEffect(()=>()=>{if(recorder.current?.state==='recording')recorder.current.stop();},[]);
 async function record(kind:'intro'|'emotions') {
  if(recording)return;
  let frame=0, context:AudioContext|undefined, stream:MediaStream|undefined;
  const model=(window as any).getLive2DManager?.()?.getModel(0);
  const originalRms=model?._wavFileHandler?.getRms;
  try {
   setRecording(true);setStatus('Preparing…');
   const source=document.getElementById('canvas') as HTMLCanvasElement|null;
   if(!source||!model)throw Error('Wait for the character to load.');
   const output=document.createElement('canvas');output.width=720;output.height=1000;
   const draw=output.getContext('2d')!;stream=output.captureStream(24);
   let segments:Segment[]=emotions.map((expression,index)=>({expression,start:index*3.5,end:(index+1)*3.5,text:({exp_01:'Neutral',exp_02:'Happy',exp_05:'Sad',exp_06:'Blushing',exp_07:'Surprised',chat_anger:'Angry',exp_08:'Sleepy'} as Record<string,string>)[expression]}));
   let duration=segments.length*3.5,audio:AudioBufferSourceNode|undefined,analyser:AnalyserNode|undefined;
   if(kind==='intro') {
    const [wav,json]=await Promise.all([fetch('/studio-assets/intro/emma-intro.wav'),fetch('/studio-assets/intro/emma-intro.json')]);
    if(!wav.ok||!json.ok)throw Error('The introduction audio is unavailable.');
    segments=await json.json();context=new AudioContext();await context.resume();
    const buffer=await context.decodeAudioData(await wav.arrayBuffer());duration=buffer.duration+.3;
    audio=context.createBufferSource();audio.buffer=buffer;
    const destination=context.createMediaStreamDestination();analyser=context.createAnalyser();analyser.fftSize=512;
    audio.connect(analyser);analyser.connect(destination);analyser.connect(context.destination);
    for(const track of destination.stream.getAudioTracks())stream.addTrack(track);
   }
   const chunks:BlobPart[]=[];
   const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')?'video/webm;codecs=vp9,opus':'video/webm';
   const media=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3000000});recorder.current=media;
   const finished=new Promise<Blob>((resolve,reject)=>{media.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};media.onerror=()=>reject(Error('Recording failed.'));media.onstop=()=>resolve(new Blob(chunks,{type:mime}));});
   const started=performance.now();let current=-1,rms=0;
   if(analyser&&model._wavFileHandler)model._wavFileHandler.getRms=()=>rms;
   const samples=new Float32Array(512);
   function render(){
    const elapsed=(performance.now()-started)/1000,index=segments.findIndex(s=>elapsed>=s.start&&elapsed<s.end);
    if(index!==current&&index>=0){current=index;model.setExpression(segments[index].expression);const motions=model._modelSetting;const count=motions?.getMotionCount('Idle');if(count)model.startMotion('Idle',index%count,3);}
    if(analyser){analyser.getFloatTimeDomainData(samples);rms=Math.min(.8,Math.sqrt(samples.reduce((n,v)=>n+v*v,0)/samples.length)*3);}
    draw.fillStyle='#111824';draw.fillRect(0,0,720,1000);
    draw.fillStyle='#e9f1ff';draw.font='600 28px -apple-system, sans-serif';draw.textAlign='center';draw.fillText('Emma Darwin',360,48);
    const scale=Math.min(640/source!.width,720/source!.height);const width=source!.width*scale,height=source!.height*scale;
    draw.drawImage(source!,(720-width)/2,70+(720-height)/2,width,height);
    draw.font='20px -apple-system, sans-serif';draw.fillStyle='#d1ddef';
    const words=(segments[Math.max(0,index)]?.text||'').split(' ');let line='',y=830;
    for(const word of words){const next=line?line+' '+word:word;if(draw.measureText(next).width>620){draw.fillText(line,360,y);y+=28;line=word;}else line=next;}draw.fillText(line,360,y);
    draw.font='14px -apple-system, sans-serif';draw.fillStyle='#9dacc2';draw.fillText('github.com/Up-to-code/edwardarwin',360,940);
    draw.font='11px -apple-system, sans-serif';draw.fillText('This content uses sample data owned and copyrighted by Live2D Inc.',360,972);
    if(elapsed>=duration){if(media.state==='recording')media.stop();return;}frame=requestAnimationFrame(render);
   }
   media.start(250);audio?.start();render();setStatus(kind==='intro'?'Recording the F4 introduction…':'Recording seven expressions…');
   const blob=await finished;cancelAnimationFrame(frame);audio?.stop();
   const path=await (window.api as any)?.saveAvatarMedia?.(await blob.arrayBuffer(),kind);
   if(!path)throw Error('Export requires the Mac app.');setStatus('Saved '+path);
  }catch(error){setStatus(error instanceof Error?error.message:'Could not record.');}
  finally{cancelAnimationFrame(frame);if(originalRms&&model?._wavFileHandler)model._wavFileHandler.getRms=originalRms;model?._expressionManager?.stopAllMotions();stream?.getTracks().forEach(t=>t.stop());await context?.close();recorder.current=null;setRecording(false);}
 }
 return <details><summary>Demo recording</summary><p className="studio-note">Record only the avatar, with English F4 narration or an emotion reel.</p><div className="media-actions"><button disabled={!ready||recording||!window.api} onClick={()=>void record('intro')}>Record introduction</button><button disabled={!ready||recording||!window.api} onClick={()=>void record('emotions')}>Record emotions</button>{recording&&<button onClick={()=>recorder.current?.stop()}>Stop and save</button>}</div><p className="media-status" role="status">{status}</p></details>;
}
