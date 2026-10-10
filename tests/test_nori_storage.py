import json
import os
import tempfile
import unittest
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from src.open_llm_vtuber import local_store, user_profile, chat_history_manager as history

class LocalStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.cwd = os.getcwd()
        self.old_db = local_store.DB_PATH
        self.old_profile = user_profile.PROFILE_PATH
        os.chdir(self.temp.name)
        local_store.DB_PATH = Path(self.temp.name)/'data/test.sqlite3'
        user_profile.PROFILE_PATH = Path('data/user-profile.json')
    def tearDown(self):
        local_store.DB_PATH = self.old_db
        user_profile.PROFILE_PATH = self.old_profile
        os.chdir(self.cwd)
        self.temp.cleanup()
    def test_import_keeps_original_and_deleted_history_stays_deleted(self):
        folder = Path('chat_history/nori'); folder.mkdir(parents=True)
        original = json.dumps([{'role':'metadata','timestamp':'2026-10-10'},{'role':'human','content':'Hi','timestamp':'2026-10-10'}])
        source=folder/'old.json';source.write_text(original)
        self.assertEqual(history.get_history_list('nori')[0]['uid'],'old')
        self.assertEqual(history.get_history('nori','old')[0]['content'],'Hi')
        self.assertEqual(source.read_text(),original)
        self.assertTrue(history.delete_history('nori','old'))
        self.assertEqual(history.get_history_list('nori'),[])
        self.assertTrue(source.exists())
    def test_metadata_rename_and_config_isolation(self):
        uid=history.create_new_history('nori')
        history.store_message('nori',uid,'human','Hello')
        history.store_message('nori',uid,'ai','Welcome',name='Nori')
        self.assertTrue(history.update_metadate('nori',uid,{'title':'First chat'}))
        self.assertEqual(history.get_metadata('nori',uid)['title'],'First chat')
        self.assertTrue(history.modify_latest_message('nori',uid,'ai','Hey'))
        self.assertTrue(history.rename_history_file('nori',uid,'renamed'))
        self.assertEqual(history.get_history('nori','renamed')[-1]['content'],'Hey')
        self.assertEqual(history.get_history('other','renamed'),[])
    def test_parallel_appends_are_not_lost(self):
        uid=history.create_new_history('nori')
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(lambda i:history.store_message('nori',uid,'human',str(i)),range(16)))
        self.assertEqual(len(history.get_history('nori',uid)),16)
    def test_profile_migration_save_clear_and_limit(self):
        user_profile.PROFILE_PATH.parent.mkdir()
        user_profile.PROFILE_PATH.write_text('{"notes":"Short replies","files":[]}')
        self.assertEqual(user_profile.read_profile().notes,'Short replies')
        user_profile.save_profile(user_profile.UserProfile(notes='English',files=[user_profile.ReferenceFile(name='notes.md',text='Likes animation')]))
        self.assertIn('Likes animation',user_profile.profile_context())
        user_profile.save_profile(user_profile.UserProfile())
        self.assertEqual(user_profile.profile_context(),'')
        self.assertTrue(user_profile.PROFILE_PATH.exists())
        with self.assertRaises(ValueError):
            user_profile.save_profile(user_profile.UserProfile(files=[user_profile.ReferenceFile(name='a',text='x'*7000),user_profile.ReferenceFile(name='b',text='x'*7000)]))

    def test_regeneration_preserves_revision_and_prior_turns(self):
        uid=history.create_new_history('nori')
        for role,text in [('human','First'),('ai','One'),('human','Second'),('ai','Two')]:
            history.store_message('nori',uid,role,text)
        turn=history.prepare_regeneration('nori',uid)
        self.assertEqual(turn['content'],'Second')
        self.assertEqual([m['content'] for m in history.get_history('nori',uid)],['First','One'])
        with local_store.connection() as db:
            raw=db.execute("SELECT value FROM settings WHERE key LIKE 'revision:%'").fetchone()[0]
        self.assertEqual(json.loads(raw)[-1]['content'],'Two')
        self.assertEqual(local_store.DB_PATH.stat().st_mode & 0o777,0o600)
        history.store_message('nori',uid,'human','Second')
        self.assertIsNone(history.prepare_regeneration('nori',uid))

if __name__=='__main__': unittest.main()
