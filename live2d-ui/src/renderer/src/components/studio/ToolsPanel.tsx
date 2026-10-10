import { useEffect, useState } from 'react';
export function ToolsPanel(){
 const [info,setInfo]=useState<{persona:string;system_prompt:string;tools:string[]}|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{let alive=true;fetch('/api/user-profile').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{if(alive)setInfo(data);}).catch(()=>{if(alive)setError('Could not load tools.');});return()=>{alive=false;};},[]);
 return <div className="tools-panel"><h2>Tools</h2><p className="studio-note">{error||(!info?'Loading…':info.tools.length?info.tools.join(' · '):'No MCP tools enabled.')}</p><label htmlFor="tool-persona">Character prompt</label><textarea id="tool-persona" readOnly rows={5} value={info?.persona||''}/><details><summary>System prompt</summary><pre className="prompt-view">{info?.system_prompt}</pre></details><details className="storage-details"><summary>Storage</summary><p className="studio-note">Local SQLite · notes, selected references, and chat history. Previous replies are retained when regenerated.</p><code>data/nori.sqlite3</code></details></div>;
}
