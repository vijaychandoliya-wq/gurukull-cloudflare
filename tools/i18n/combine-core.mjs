import fs from 'node:fs';
import path from 'node:path';
const [draftDir,terminologyDir,destination]=process.argv.slice(2);
if(!draftDir||!terminologyDir||!destination)throw Error('Expected draft directory, terminology directory and destination');
const packs={};
for(const file of fs.readdirSync(draftDir).filter(name=>name.endsWith('.json')&&!name.endsWith('.checkpoint.json')).sort()){
 const tag=file.slice(0,-5);
 const terminology=JSON.parse(fs.readFileSync(path.join(terminologyDir,file),'utf8'));
 const pack={...JSON.parse(fs.readFileSync(path.join(draftDir,file),'utf8')),...terminology};
 for(const [key,value] of Object.entries(pack)){
  const normalised=value.normalize('NFC');
  pack[key]=/[.!?…]$/.test(key)?normalised:normalised.replace(/[।.!?۔]+$/u,'');
 }
 packs[tag]=pack;
}
// School-specific terminology for the existing Hindi interface.
Object.assign(packs.hi,{Save:'परिवर्तन सहेजें','Class name':'कक्षा का नाम',Classes:'कक्षाएँ',Sections:'अनुभाग'});
fs.writeFileSync(destination,JSON.stringify(packs,null,2)+'\n');
console.log(`${Object.keys(packs).length} core draft packs combined`);
