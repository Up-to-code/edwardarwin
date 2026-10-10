"""Emma's finite desktop actions; no shell-command execution or arbitrary scripts."""
import json
from pathlib import Path
import requests
from mcp.server.fastmcp import FastMCP
mcp=FastMCP('Emma desktop')
def action(name,args=None):
    try:
        bridge=json.loads((Path(__file__).parent/'data/desktop-bridge.json').read_text())
        response=requests.post(f"http://127.0.0.1:{int(bridge['port'])}",headers={'Authorization':'Bearer '+bridge['token']},json={'action':name,'args':args or {}},timeout=90)
        response.raise_for_status()
        return response.json()
    except FileNotFoundError:return {'error':'Open the Emma desktop app first.'}
    except requests.RequestException:return {'error':'Desktop action failed or was canceled. Do not claim it succeeded.'}
@mcp.tool()
def open_app(name:str):
    """Open a Mac app only when the user asks. Names: Codex, Google Chrome, Safari, Notes, Calendar, Finder, Calculator, System Settings."""
    return action('open_app',{'name':name})
@mcp.tool()
def open_website(url:str):
    """Open the user's HTTP/HTTPS URL in Chrome. Ask for a URL when none was provided."""
    return action('open_website',{'url':url})
@mcp.tool()
def last_website_opened_by_nori():
    """Return only the website last opened by Emma, not the current tab in Chrome. Never assume manual navigation stayed on it."""
    return action('last_website')
@mcp.tool()
def save_source(url:str,title:str='',notes:str='',tags:list[str]|None=None):
    """Save a user-provided source URL, title, notes, and tags in local SQLite. Do not invent facts about its contents. Ask for the URL if uncertain."""
    return action('save_source',{'url':url,'title':title,'notes':notes,'tags':tags or []})
@mcp.tool()
def find_saved_sources(query:str=''):
    """Search sources saved in previous sessions by URL, title, notes, or tags, e.g. UI libraries, AI models, blogs."""
    return action('search_sources',{'query':query})
@mcp.tool()
def take_screenshot():
    """When requested, ask the user to choose a screen and save a PNG locally. Return its path; do not infer visual contents."""
    return action('screenshot')
@mcp.tool()
def open_file_or_folder(path:str=''):
    """Open a local file/folder chosen by the user in a native picker. A path is only the picker's starting location."""
    return action('open_file',{'path':path})
@mcp.tool()
def start_screen_recording():
    """Start screen video only on explicit request. The user chooses a screen. No microphone audio. The app displays a stop button."""
    return action('start_recording')
@mcp.tool()
def stop_screen_recording():
    """Stop requested screen video and save it locally. Return its file path."""
    return action('stop_recording')
if __name__=='__main__':mcp.run(transport='stdio')
