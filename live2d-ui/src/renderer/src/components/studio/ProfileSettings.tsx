import { useEffect, useState } from 'react';
type Reference = {name:string;text:string};
type Profile = {notes:string;files:Reference[]};
export function ProfileSettings() {
 const [profile,setProfile]=useState<Profile>({notes:'',files:[]});
 const [info,setInfo]=useState<{persona:string;system_prompt:string;tools:string[]}|null>(null);
 const [status,setStatus]=useState('Loading…');
 const [saving,setSaving]=useState(false);
 useEffect(()=>{let alive=true;fetch('/api/user-profile').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{if(alive){setProfile(data.profile);setInfo(data);setStatus('');}}).catch(()=>{if(alive)setStatus('Could not load your settings.');});return()=>{alive=false;};},[]);
 async function chooseFiles(){
  try {const files=await (window.api as any)?.chooseProfileFiles?.();if(files?.length)setProfile(p=>({...p,files:[...p.files,...files].slice(0,4)}));}
  catch {setStatus('Could not read the selected text files.');}
 }
 async function save(){setSaving(true);try{const r=await fetch('/api/user-profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(profile)});if(!r.ok){const error=await r.json();throw Error(error.detail||'Could not save.');}setStatus('Saved.');}catch(e){setStatus(e instanceof Error?e.message:'Could not save.');}finally{setSaving(false);}}
 return <div className="profile-panel">
  <label htmlFor="profile-notes">About you</label><textarea id="profile-notes" rows={4} maxLength={2000} value={profile.notes} disabled={!info||saving} placeholder="Your name, preferences, or things you want Emma to know…" onChange={e=>setProfile({...profile,notes:e.target.value})}/>
  <div className="profile-files"><span>References</span>{profile.files.map((file,index)=><div className="profile-file" key={`${file.name}-${index}`}><span>{file.name}</span><button aria-label={`Remove ${file.name}`} disabled={saving} onClick={()=>setProfile({...profile,files:profile.files.filter((_,i)=>i!==index)})}>×</button></div>)}<button disabled={!info||saving||profile.files.length>=4||!window.api} onClick={chooseFiles}>Add text files</button></div>
  <details className="storage-details"><summary>Local storage</summary><p className="studio-note">Saved in SQLite on this Mac. Only notes and files you select are used. Remove a reference and save to stop using it.</p><code>data/nori.sqlite3</code></details>
  <button disabled={!info||saving} onClick={save}>{saving?'Saving…':'Save'}</button><p className="studio-feedback" role="status">{status}</p>

 </div>;
}
