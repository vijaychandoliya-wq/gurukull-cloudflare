import fs from 'node:fs';
const [sourcePath,packPath]=process.argv.slice(2);
if(!sourcePath||!packPath)throw Error('Expected source catalogue and combined pack file');
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
const packs=JSON.parse(fs.readFileSync(packPath,'utf8'));
const tags=['as','bn','brx','doi','gu','hi','kn','ks-Arab','kok-Deva','mai','ml','mni-Mtei','mr','ne','or','pa-Guru','sa','sat-Olck','sd-Arab','ta','te','ur'];
const scripts={as:'Bengali',bn:'Bengali',brx:'Devanagari',doi:'Devanagari',gu:'Gujarati',hi:'Devanagari',kn:'Kannada','ks-Arab':'Arabic','kok-Deva':'Devanagari',mai:'Devanagari',ml:'Malayalam','mni-Mtei':'Meetei_Mayek',mr:'Devanagari',ne:'Devanagari',or:'Oriya','pa-Guru':'Gurmukhi',sa:'Devanagari','sat-Olck':'Ol_Chiki','sd-Arab':'Arabic',ta:'Tamil',te:'Telugu',ur:'Arabic'};
const tokens=value=>[...value.matchAll(/\{\w+\}/g)].map(m=>m[0]).sort().join('|');
for(const tag of tags){
 const pack=packs[tag];if(!pack)throw Error(`Missing ${tag}`);
 let changed=0;
 const script=new RegExp('\\p{Script='+scripts[tag]+'}','u');
 if(!script.test(pack['School overview']||''))throw Error(`Wrong script in ${tag} dashboard heading`);
 for(const key of Object.keys(source)){
  if(typeof pack[key]!=='string'||!pack[key].trim()||tokens(key)!==tokens(pack[key]))throw Error(`Invalid ${tag}: ${key}`);
  if(pack[key]!==key)changed++;
 }
 if(changed<Object.keys(source).length*.8)throw Error(`${tag} has too much untranslated interface text`);
 console.log(`${tag}: ${changed}/${Object.keys(source).length} phrases changed; placeholders intact`);
}
console.log('Structure checks passed. Native-language approval is still required.');
