"""Offline draft generation from public UI copy only; never invoked by the portal.
Install tooling in an isolated environment. Model code must be reviewed before use.
Outputs are drafts requiring script, placeholder and native-language review.
"""
import argparse,json,re,time
from pathlib import Path
import torch
from transformers import AutoModelForSeq2SeqLM,AutoTokenizer
from IndicTransToolkit.processor import IndicProcessor

CONTEXT={'Save':'Save changes','Refresh':'Reload the page','Edit':'Edit the record','Add':'Add a record','Class name':'School class name','Classes':'School classes','Sections':'Class sections','Cancel':'Cancel the action'}
LANGUAGES={'hi':'hin_Deva','ta':'tam_Taml','ur':'urd_Arab','as':'asm_Beng','bn':'ben_Beng','brx':'brx_Deva','doi':'doi_Deva','gu':'guj_Gujr','kn':'kan_Knda','ks-Arab':'kas_Arab','kok-Deva':'gom_Deva','mai':'mai_Deva','ml':'mal_Mlym','mni-Mtei':'mni_Mtei','mr':'mar_Deva','ne':'npi_Deva','or':'ory_Orya','pa-Guru':'pan_Guru','sa':'san_Deva','sat-Olck':'sat_Olck','sd-Arab':'snd_Arab','te':'tel_Telu'}
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--model',required=True);p.add_argument('--output',required=True);p.add_argument('--locales',nargs='*');a=p.parse_args()
source=json.loads(Path(a.source).read_text());out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
if not source or not all(isinstance(k,str) and k==v for k,v in source.items()):raise ValueError('Expected a checked-in UI source catalogue, not arbitrary school data')
device='mps' if torch.backends.mps.is_available() else 'cpu'
print('Loading reviewed local translation model on',device,flush=True)
model=AutoModelForSeq2SeqLM.from_pretrained(a.model,trust_remote_code=True,local_files_only=True,attn_implementation='eager').to(device).eval()
tokenizer=AutoTokenizer.from_pretrained(a.model,trust_remote_code=True,local_files_only=True)
processor=IndicProcessor(inference=True)
# Translate literal segments while retaining interpolation tokens byte for byte.
segments={key:re.split(r'(\{\w+\})',key) for key in source}
phrases=list(dict.fromkeys(s.strip() for parts in segments.values() for s in parts if s.strip() and not re.fullmatch(r'\{\w+\}',s) and re.search('[A-Za-z]',s)))
phrases.sort(key=len)
for tag in a.locales or LANGUAGES:
 if tag not in LANGUAGES:raise ValueError('Unknown target language')
 destination=out/(tag+'.json')
 if destination.exists():print('Already generated',tag,flush=True);continue
 started=time.time();checkpoint=out/(tag+'.checkpoint.json');translated=json.loads(checkpoint.read_text()) if checkpoint.exists() else {}
 pending=[phrase for phrase in phrases if phrase not in translated]
 for offset in range(0,len(pending),4):
  batch=pending[offset:offset+4]
  prepared=processor.preprocess_batch([CONTEXT.get(text,text) for text in batch],src_lang='eng_Latn',tgt_lang=LANGUAGES[tag])
  inputs=tokenizer(prepared,truncation=True,padding='longest',return_tensors='pt').to(device)
  with torch.inference_mode():generated=model.generate(**inputs,num_beams=2,max_new_tokens=160,use_cache=True)
  decoded=tokenizer.batch_decode(generated.detach().cpu().tolist(),skip_special_tokens=True,clean_up_tokenization_spaces=True)
  values=processor.postprocess_batch(decoded,lang=LANGUAGES[tag])
  translated.update(zip(batch,values))
  checkpoint.write_text(json.dumps(translated,ensure_ascii=False))
  del inputs,generated
  if device=='mps':torch.mps.empty_cache()
  print(tag,len(translated),'/',len(phrases),flush=True)
 pack={}
 for key,parts in segments.items():
  result=''.join(part if part.strip() not in translated else part[:len(part)-len(part.lstrip())]+translated[part.strip()]+part[len(part.rstrip()):] for part in parts)
  if sorted(re.findall(r'\{\w+\}',key))!=sorted(re.findall(r'\{\w+\}',result)) or not result.strip():raise ValueError('Invalid placeholders or empty output')
  pack[key]=result
 destination.write_text(json.dumps(pack,ensure_ascii=False,indent=2)+'\n')
 print('Draft saved',tag,round(time.time()-started,1),'seconds',flush=True)
