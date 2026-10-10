"""SQLite conversation histories with non-destructive import of legacy JSON files."""
import json
import uuid
from pathlib import Path
from datetime import datetime
from typing import Literal, List, TypedDict, Optional
from loguru import logger
from .local_store import connection

class HistoryMessage(TypedDict):
    role: Literal['human','ai']
    timestamp: str
    content: str
    name: Optional[str]
    avatar: Optional[str]

def _migrate(conf_uid, db):
    if not conf_uid or conf_uid in ('.','..') or Path(conf_uid).name != conf_uid:
        raise ValueError('Invalid configuration identifier')
    key = 'history:' + conf_uid
    if db.execute('SELECT 1 FROM migrations WHERE key=?',(key,)).fetchone():
        return
    folder = Path('chat_history') / conf_uid
    for path in folder.glob('*.json'):
        try:
            data = json.loads(path.read_text(encoding='utf8'))
            if isinstance(data,list):
                db.execute('INSERT OR IGNORE INTO histories VALUES(?,?,?)',(conf_uid,path.stem,json.dumps(data,ensure_ascii=False)))
        except (OSError,ValueError):
            logger.warning('Could not import history {}',path.name)
    db.execute('INSERT INTO migrations VALUES(?)',(key,))

def _read(conf, uid, db):
    row = db.execute('SELECT data FROM histories WHERE conf_uid=? AND uid=?',(conf,uid)).fetchone()
    return json.loads(row[0]) if row else None

def _write(conf,uid,data,db):
    db.execute('INSERT INTO histories VALUES(?,?,?) ON CONFLICT(conf_uid,uid) DO UPDATE SET data=excluded.data',(conf,uid,json.dumps(data,ensure_ascii=False)))

def create_new_history(conf_uid: str) -> str:
    if not conf_uid: return ''
    uid = f"{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}_{uuid.uuid4().hex}"
    with connection() as db:
        _migrate(conf_uid,db)
        _write(conf_uid,uid,[{'role':'metadata','timestamp':datetime.now().isoformat(timespec='seconds')}],db)
    return uid

def store_message(conf_uid,history_uid,role,content,name=None,avatar=None):
    if not conf_uid or not history_uid: return
    with connection() as db:
        _migrate(conf_uid,db)
        data = _read(conf_uid,history_uid,db) or []
        item={'role':role,'timestamp':datetime.now().isoformat(timespec='seconds'),'content':content}
        if name is not None: item['name']=name
        if avatar is not None: item['avatar']=avatar
        data.append(item)
        _write(conf_uid,history_uid,data,db)

def get_metadata(conf_uid,history_uid):
    if not conf_uid or not history_uid: return {}
    with connection() as db:
        _migrate(conf_uid,db)
        data=_read(conf_uid,history_uid,db)
    return data[0] if data and data[0].get('role')=='metadata' else {}

def update_metadate(conf_uid,history_uid,metadata):
    if not conf_uid or not history_uid: return False
    with connection() as db:
        _migrate(conf_uid,db)
        data=_read(conf_uid,history_uid,db)
        if data is None: return False
        if not data or data[0].get('role')!='metadata':
            data.insert(0,{'role':'metadata','timestamp':datetime.now().isoformat(timespec='seconds')})
        data[0].update(metadata)
        _write(conf_uid,history_uid,data,db)
    return True

def get_history(conf_uid,history_uid) -> List[HistoryMessage]:
    if not conf_uid or not history_uid: return []
    with connection() as db:
        _migrate(conf_uid,db)
        data=_read(conf_uid,history_uid,db) or []
    return [message for message in data if message.get('role')!='metadata']

def delete_history(conf_uid,history_uid):
    if not conf_uid or not history_uid: return False
    with connection() as db:
        _migrate(conf_uid,db)
        return db.execute('DELETE FROM histories WHERE conf_uid=? AND uid=?',(conf_uid,history_uid)).rowcount>0

def get_history_list(conf_uid):
    if not conf_uid: return []
    result=[]
    with connection() as db:
        _migrate(conf_uid,db)
        rows=db.execute('SELECT uid,data FROM histories WHERE conf_uid=?',(conf_uid,)).fetchall()
    for uid,raw in rows:
        data=[m for m in json.loads(raw) if m.get('role')!='metadata']
        if data:
            latest=data[-1]
            result.append({'uid':uid,'latest_message':latest,'timestamp':latest.get('timestamp','')})
    return sorted(result,key=lambda h:h['timestamp'],reverse=True)

def modify_latest_message(conf_uid,history_uid,role,new_content):
    if not conf_uid or not history_uid: return False
    with connection() as db:
        _migrate(conf_uid,db)
        data=_read(conf_uid,history_uid,db)
        if not data or data[-1].get('role')!=role: return False
        data[-1]['content']=new_content
        _write(conf_uid,history_uid,data,db)
    return True

def rename_history_file(conf_uid,old_history_uid,new_history_uid):
    if not conf_uid or not old_history_uid or not new_history_uid: return False
    with connection() as db:
        _migrate(conf_uid,db)
        if db.execute('SELECT 1 FROM histories WHERE conf_uid=? AND uid=?',(conf_uid,new_history_uid)).fetchone(): return False
        return db.execute('UPDATE histories SET uid=? WHERE conf_uid=? AND uid=?',(new_history_uid,conf_uid,old_history_uid)).rowcount>0


def prepare_regeneration(conf_uid, history_uid):
    """Keep the previous version and remove only the last human turn and its reply."""
    with connection() as db:
        _migrate(conf_uid, db)
        data = _read(conf_uid, history_uid, db)
        if not data or data[-1].get('role') != 'ai':
            return None
        index = next((i for i in range(len(data)-1, -1, -1) if data[i].get('role') == 'human'), None)
        if index is None:
            return None
        turn = data[index]
        key = 'revision:' + conf_uid + ':' + history_uid + ':' + str(uuid.uuid4())
        db.execute('INSERT INTO settings(key,value) VALUES(?,?)', (key, json.dumps(data, ensure_ascii=False)))
        _write(conf_uid, history_uid, data[:index], db)
        return turn
