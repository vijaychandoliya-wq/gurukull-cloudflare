import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {SUPPORTED_LOCALE_TAGS} from '../src/locale-preferences.js';
it('expands school language choices without changing the default or saved user preference',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(`CREATE TABLE school_locale_settings(school_id TEXT PRIMARY KEY,default_locale TEXT,enabled_locales_json TEXT,version INTEGER,updated_at INTEGER);
   CREATE TABLE user_locale_preferences(school_id TEXT,user_id TEXT,locale_tag TEXT);
   INSERT INTO school_locale_settings VALUES('memory-only','ta','["en","ta"]',7,1);
   INSERT INTO user_locale_preferences VALUES('memory-only','memory-only','ta');`);
  db.exec(readFileSync(new URL('../../../migrations/0036_indian_language_core_previews.sql',import.meta.url),'utf8'));
  const row=db.prepare('SELECT * FROM school_locale_settings').get()!;
  expect(row.default_locale).toBe('ta');expect(row.version).toBe(8);expect(JSON.parse(String(row.enabled_locales_json))).toEqual([...SUPPORTED_LOCALE_TAGS]);
  expect(db.prepare('SELECT locale_tag FROM user_locale_preferences').get()?.locale_tag).toBe('ta');
 }finally{db.close();}
});
