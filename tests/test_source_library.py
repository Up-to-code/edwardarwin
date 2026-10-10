import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from pydantic import ValidationError
from src.open_llm_vtuber import local_store
from src.open_llm_vtuber.source_library import Source,save_source,search_sources,register_capture,list_captures
class SourcesTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.patch=patch.object(local_store,'DB_PATH',Path(self.temp.name)/'nori.sqlite3');self.patch.start()
 def tearDown(self):self.patch.stop();self.temp.cleanup()
 def test_persistence_tags_and_update(self):
  save_source(Source(url='https://example.org/ui',title='Components',tags=[' UI Libraries ','ui libraries','Blogs'],notes='React components'))
  first=search_sources('ui libraries react')[0]
  self.assertEqual(first['tags'],['ui libraries','blogs'])
  save_source(Source(url=first['url'],title='Updated',tags=['UI libraries'],notes='React toolkit'))
  second=search_sources('toolkit')[0];self.assertEqual(first['created_at'],second['created_at']);self.assertEqual(len(search_sources()),1)
  self.assertEqual(search_sources("' OR 1=1"),[])
 def test_url_validation(self):
  for url in ['javascript:alert(1)','file:///etc/passwd','https://user:password@example.org','https://']:
   with self.assertRaises(ValidationError):Source(url=url)
 def test_captures(self):
  register_capture('/tmp/test.webm','screen-video');self.assertEqual(list_captures()[0]['kind'],'screen-video')
  with self.assertRaises(ValueError):register_capture('/tmp/test','audio')
if __name__=='__main__':unittest.main()
