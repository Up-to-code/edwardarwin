"""Saved sources and desktop captures in the existing local database."""
import json
from datetime import datetime, timezone
from urllib.parse import urlparse
from pydantic import BaseModel, Field, field_validator
from .local_store import connection
class Source(BaseModel):
    url: str = Field(max_length=3000)
    title: str = Field(default='', max_length=200)
    notes: str = Field(default='', max_length=4000)
    tags: list[str] = Field(default_factory=list, max_length=20)
    @field_validator('url')
    @classmethod
    def valid_url(cls, value):
        parsed=urlparse(value)
        if parsed.scheme not in ('http','https') or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError('Use an HTTP or HTTPS website URL without credentials.')
        return value
    @field_validator('tags')
    @classmethod
    def clean_tags(cls, value):
        return list(dict.fromkeys(tag.strip().lower()[:40] for tag in value if tag.strip()))
def tables(db):
    db.execute('CREATE TABLE IF NOT EXISTS sources(url TEXT PRIMARY KEY,title TEXT NOT NULL,notes TEXT NOT NULL,tags TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)')
    db.execute('CREATE TABLE IF NOT EXISTS captures(path TEXT PRIMARY KEY,kind TEXT NOT NULL,created_at TEXT NOT NULL)')
def save_source(source:Source):
    now=datetime.now(timezone.utc).isoformat()
    with connection() as db:
        tables(db)
        db.execute('INSERT INTO sources VALUES(?,?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET title=excluded.title,notes=excluded.notes,tags=excluded.tags,updated_at=excluded.updated_at',(source.url,source.title or urlparse(source.url).hostname,source.notes,json.dumps(source.tags),now,now))
    return source.model_dump()
def search_sources(query=''):
    with connection() as db:
        tables(db)
        rows=db.execute('SELECT url,title,notes,tags,created_at,updated_at FROM sources ORDER BY updated_at DESC').fetchall()
    terms=query.lower().split()
    result=[dict(zip(('url','title','notes','tags','created_at','updated_at'),row)) for row in rows]
    for item in result:item['tags']=json.loads(item['tags'])
    return [item for item in result if all(term in ' '.join((item['url'],item['title'],item['notes'],' '.join(item['tags']))).lower() for term in terms)][:100]
def register_capture(path,kind):
    if kind not in ('screenshot','screen-video'):raise ValueError('Invalid capture kind')
    with connection() as db:
        tables(db)
        db.execute('INSERT OR REPLACE INTO captures VALUES(?,?,?)',(path,kind,datetime.now(timezone.utc).isoformat()))
    return {'path':path,'kind':kind}
def list_captures():
    with connection() as db:
        tables(db)
        return [dict(zip(('path','kind','created_at'),row)) for row in db.execute('SELECT path,kind,created_at FROM captures ORDER BY created_at DESC LIMIT 100')]
