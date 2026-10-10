type IconName='link'|'apps'|'camera'|'video'|'stop'|'open'|'plus'|'save'|'edit'|'folder'|'code'|'chrome'|'compass'|'note'|'calendar'|'calculator'|'settings'|'search';
const paths:Record<IconName,string>={
 link:'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
 apps:'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
 camera:'M3 7h4l2-3h6l2 3h4v13H3ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
 video:'M3 5h12v14H3ZM15 10l6-4v12l-6-4',stop:'M6 6h12v12H6Z',
 open:'M14 3h7v7M21 3l-9 9M10 3H3v18h18v-7',plus:'M12 5v14M5 12h14',
 save:'M5 3h12l4 4v14H3V3ZM7 3v6h9V3M7 21v-7h10v7',edit:'M16 3l5 5-12 12-6 1 1-6ZM14 5l5 5',
 folder:'M3 7V4h6l3 3h9v13H3Z',code:'M8 5l-6 7 6 7M16 5l6 7-6 7M14 3l-4 18',
 chrome:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 8h9M8.5 14l-5-8M14 15.5l-4.5 6',
 compass:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM16 8l-3 5-5 3 3-5Z',
 note:'M5 3h14v18H5ZM8 8h8M8 12h8M8 16h5',calendar:'M3 5h18v16H3ZM7 2v6M17 2v6M3 10h18M7 14h2M13 14h2',
 calculator:'M5 2h14v20H5ZM8 5h8v4H8ZM8 13h1M14 13h1M8 17h1M14 17h1',
 settings:'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',search:'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0ZM15 15l6 6',
};
export function DesktopIcon({name}:{name:IconName}){return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;}
