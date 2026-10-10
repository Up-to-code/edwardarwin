import { useEffect } from 'react';
export function useNativeGlass(mode:string,dark:boolean){
 useEffect(()=>{
  const api=window.api as any;if(!api?.setGlassRegions)return;
  const root=document.getElementById('studio-root');if(!root)return;
  let frame=0,alive=true,last='';
  const update=()=>{
   frame=0;if(!alive)return;
   const nodes=mode==='pet'?Array.from(root.querySelectorAll<HTMLElement>('.floating-dock,.floating-menu,.desktop-review,.floating-caption,.recording-stop')):[root];
   const regions=nodes.filter(node=>getComputedStyle(node).visibility!=='hidden'&&getComputedStyle(node).display!=='none').map(node=>{const b=node.getBoundingClientRect();return {x:Math.max(0,b.x),y:Math.max(0,b.y),width:Math.min(b.width,innerWidth-Math.max(0,b.x)),height:Math.min(b.height,innerHeight-Math.max(0,b.y)),radius:Math.min(22,parseFloat(getComputedStyle(node).borderRadius)||16)};}).filter(r=>r.width>0&&r.height>0);
   const signature=JSON.stringify(regions);if(signature===last)return;last=signature;
   void api.setGlassRegions(regions,dark).then((native:boolean)=>{if(alive)document.documentElement.dataset.nativeGlass=native?'true':'false';}).catch(()=>{if(alive)document.documentElement.dataset.nativeGlass='false';});
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
  const observer=new MutationObserver(schedule);observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','open']});
  const resize=new ResizeObserver(schedule);resize.observe(root);window.addEventListener('resize',schedule);schedule();
  return()=>{alive=false;observer.disconnect();resize.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);void api.setGlassRegions([],dark).catch(()=>{});delete document.documentElement.dataset.nativeGlass;};
 },[mode,dark]);
}
