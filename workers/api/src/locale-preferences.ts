import type {Hono} from 'hono';
import {z} from 'zod';
import {db,readBody,requireAuth,requireRole,type AppEnv,type ApiContext} from './context.js';
import {audit,command,cleanupGuards,guard,parse} from './management-common.js';
import {fail} from './security.js';

/**
 * Locale tags are deliberately exact. Language-only fallbacks would collapse
 * different scripts (for example ks-Arab and sd-Arab) into the wrong locale.
 * This registry is also mirrored by the web and mobile clients.
 */
export const SUPPORTED_LOCALE_TAGS = [
  'en','as','bn','brx','doi','gu','hi','kn','ks-Arab','kok-Deva','mai','ml',
  'mni-Mtei','mr','ne','or','pa-Guru','sa','sat-Olck','sd-Arab','ta','te','ur',
] as const;
export type SupportedLocaleTag = typeof SUPPORTED_LOCALE_TAGS[number];

/** Only reviewed packs can be selected in production. The full registry is
 * retained so future packs have stable identifiers without pretending that
 * machine-generated text is a reviewed translation. */
export const PILOT_LOCALE_TAGS = ['en','hi','ta','ur'] as const;
export const DEFAULT_LOCALE_TAG = 'en' as const;
const supportedTags = new Set<string>(SUPPORTED_LOCALE_TAGS);
const pilotTags = new Set<string>(PILOT_LOCALE_TAGS);

export function isSupportedLocaleTag(value:unknown): value is SupportedLocaleTag {
  return typeof value==='string' && supportedTags.has(value);
}
export function isPilotLocaleTag(value:unknown): value is typeof PILOT_LOCALE_TAGS[number] {
  return typeof value==='string' && pilotTags.has(value);
}

type LocaleSettings = {defaultLocale:string;enabledLocales:string[];version:number};
const DEFAULT_SETTINGS:LocaleSettings = {defaultLocale:DEFAULT_LOCALE_TAG,enabledLocales:[...PILOT_LOCALE_TAGS],version:0};
type SettingsRow = {default_locale:string;enabled_locales_json:string;version:number};
type PreferenceRow = {language_mode:'follow_school'|'explicit';locale_tag:string|null;version:number};

function parseEnabledLocales(value:string):string[] {
  try {
    const parsed=JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every(isPilotLocaleTag) || !parsed.length) throw new Error('invalid locale settings');
    return [...new Set(parsed)];
  } catch {
    // A corrupted administrative setting must not put a tenant into an
    // unusable language. The safe, reviewed product default remains English.
    return [...DEFAULT_SETTINGS.enabledLocales];
  }
}

function toSettings(row:SettingsRow|undefined|null):LocaleSettings {
  if(!row)return {...DEFAULT_SETTINGS,enabledLocales:[...DEFAULT_SETTINGS.enabledLocales]};
  const enabledLocales=parseEnabledLocales(row.enabled_locales_json);
  return {
    defaultLocale:isPilotLocaleTag(row.default_locale)&&enabledLocales.includes(row.default_locale)?row.default_locale:DEFAULT_LOCALE_TAG,
    enabledLocales,
    version:row.version,
  };
}

async function readSettings(c:ApiContext):Promise<LocaleSettings> {
  const row=await db(c).prepare('SELECT default_locale,enabled_locales_json,version FROM school_locale_settings WHERE school_id=?').bind(c.get('user').school_id).first<SettingsRow>();
  return toSettings(row);
}

function assertSelectableLocale(locale:string, enabled:string[]) {
  if(!isSupportedLocaleTag(locale))fail(422,'UNSUPPORTED_LOCALE','Choose a recognised Gurukull language code.');
  if(!isPilotLocaleTag(locale))fail(409,'LOCALE_PACK_NOT_READY','That language pack is planned but has not completed linguistic review.');
  if(!enabled.includes(locale))fail(422,'LOCALE_NOT_ENABLED','This school has not enabled the selected reviewed language.');
}

export const localePreferenceInput=z.object({
  mode:z.enum(['follow_school','explicit']),
  localeTag:z.string().trim().max(32).optional().nullable(),
  version:z.number().int().nonnegative(),
}).strict().superRefine((value,ctx)=>{
  if(value.mode==='explicit'&&!value.localeTag)ctx.addIssue({code:'custom',path:['localeTag'],message:'Choose a language when using an explicit preference.'});
  if(value.mode==='follow_school'&&value.localeTag!==null&&value.localeTag!==undefined)ctx.addIssue({code:'custom',path:['localeTag'],message:'Follow-school mode cannot include a selected language.'});
});

export const schoolLocaleSettingsInput=z.object({
  defaultLocale:z.string().trim().max(32),
  enabledLocales:z.array(z.string().trim().max(32)).min(1).max(PILOT_LOCALE_TAGS.length),
  version:z.number().int().nonnegative(),
}).strict().superRefine((value,ctx)=>{
  if(new Set(value.enabledLocales).size!==value.enabledLocales.length)ctx.addIssue({code:'custom',path:['enabledLocales'],message:'Choose each language only once.'});
  if(!value.enabledLocales.includes(value.defaultLocale))ctx.addIssue({code:'custom',path:['defaultLocale'],message:'The school default must be one of the enabled languages.'});
});

export function registerLocalePreferences(app:Hono<AppEnv>) {
  app.get('/api/portal/locale-preference',requireAuth,async c=>{
    const u=c.get('user');
    const [settings,preference]=await Promise.all([
      readSettings(c),
      db(c).prepare('SELECT language_mode,locale_tag,version FROM user_locale_preferences WHERE school_id=? AND user_id=?').bind(u.school_id,u.id).first<PreferenceRow>(),
    ]);
    const mode=preference?.language_mode||'follow_school';
    const explicit=preference?.locale_tag||null;
    const localeTag=mode==='explicit'&&explicit&&settings.enabledLocales.includes(explicit)?explicit:settings.defaultLocale;
    return c.json({data:{mode,localeTag,version:preference?.version||0,schoolDefaultLocale:settings.defaultLocale,enabledLocales:settings.enabledLocales,availableLocales:PILOT_LOCALE_TAGS,registry:SUPPORTED_LOCALE_TAGS}});
  });

  app.put('/api/portal/locale-preference',requireAuth,async c=>{
    const u=c.get('user'),input=parse(localePreferenceInput,await readBody(c)),settings=await readSettings(c),id=crypto.randomUUID();
    const localeTag=input.mode==='explicit'?input.localeTag!:null;
    if(localeTag)assertSelectableLocale(localeTag,settings.enabledLocales);
    return c.json(await command(c,'own-locale-preference.update',input,()=>[
      guard(c,'COALESCE((SELECT version FROM user_locale_preferences WHERE school_id=? AND user_id=?),0)=?',[u.school_id,u.id,input.version],id),
      db(c).prepare("INSERT INTO user_locale_preferences(school_id,user_id,language_mode,locale_tag,version,updated_at) VALUES(?,?,?,?,1,unixepoch()) ON CONFLICT(school_id,user_id) DO UPDATE SET language_mode=excluded.language_mode,locale_tag=excluded.locale_tag,version=user_locale_preferences.version+1,updated_at=unixepoch()").bind(u.school_id,u.id,input.mode,localeTag),
      audit(c,'update','locale_preference',u.id),cleanupGuards(c,id),
    ],{message:'Language preference saved.',data:{mode:input.mode,localeTag:localeTag||settings.defaultLocale,version:input.version+1}},['admin','teacher','staff','parent','student']));
  });

  app.get('/api/admin/locale-settings',requireAuth,async c=>{
    requireRole(c,'admin','superadmin');
    return c.json({data:await readSettings(c)});
  });

  app.put('/api/admin/locale-settings',requireAuth,async c=>{
    const u=requireRole(c,'admin','superadmin'),input=parse(schoolLocaleSettingsInput,await readBody(c)),id=crypto.randomUUID();
    for(const locale of input.enabledLocales)assertSelectableLocale(locale,PILOT_LOCALE_TAGS as unknown as string[]);
    assertSelectableLocale(input.defaultLocale,input.enabledLocales);
    return c.json(await command(c,'school-locale-settings.update',input,()=>[
      guard(c,'COALESCE((SELECT version FROM school_locale_settings WHERE school_id=?),0)=?',[u.school_id,input.version],id),
      db(c).prepare("INSERT INTO school_locale_settings(school_id,default_locale,enabled_locales_json,version,updated_by,updated_at) VALUES(?,?,?,?,?,unixepoch()) ON CONFLICT(school_id) DO UPDATE SET default_locale=excluded.default_locale,enabled_locales_json=excluded.enabled_locales_json,version=school_locale_settings.version+1,updated_by=excluded.updated_by,updated_at=unixepoch()").bind(u.school_id,input.defaultLocale,JSON.stringify(input.enabledLocales),1,u.id),
      audit(c,'configure','school_locale_settings',u.school_id),cleanupGuards(c,id),
    ],{message:'School language settings saved.',data:{defaultLocale:input.defaultLocale,enabledLocales:input.enabledLocales,version:input.version+1}}));
  });
}
