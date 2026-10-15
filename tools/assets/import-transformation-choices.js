#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const index=process.argv.indexOf('--input'),input=index<0?null:path.resolve(process.argv[index+1]||'');
if(!input)throw Error('--input <verified package> required');
const read=p=>JSON.parse(fs.readFileSync(path.join(input,p),'utf8'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const validation=read('package-validation.json'),visual=read('visual-review.json');
if(!validation.pass||!visual.pass)throw Error('Final production verification must pass');
const sumBytes=fs.readFileSync(path.join(input,'SHA256SUMS.txt'));
for(const line of sumBytes.toString('utf8').trim().split(/\r?\n/)){
 const match=line.match(/^([a-f0-9]{64})  (.+)$/);if(!match)throw Error('Invalid checksum record');
 const file=path.resolve(input,match[2]);if(!file.startsWith(input+path.sep)||sha(fs.readFileSync(file))!==match[1])throw Error('Sealed source changed: '+match[2]);
}
const manifest=read('manifest.json'),catalog=read('transformation-catalog.json');
if(manifest.assets.length!==74||catalog.characters.length!==21)throw Error('Expected 74 GLBs / 21 characters');
const moduleFile=path.join(root,'public/plaza/character-transformations.js');
const old=require(moduleFile),configFile=path.join(__dirname,'island-models.json');
const config=JSON.parse(fs.readFileSync(configFile,'utf8')),budgetFile=path.join(__dirname,'budgets.json');
const budgets=JSON.parse(fs.readFileSync(budgetFile,'utf8'));
config.sources.transformationChoices=path.basename(input);
const contract={commonRig:read('pipeline/common-motion-rig.json'),characters:[]},report=[];
for(const c of catalog.characters){
 const id=c.runtimeCharacterId,previous=old.characters.find(v=>v.id===id);if(!previous)throw Error('Unknown existing character: '+id);
 const animal=id.startsWith('animal-'),base=`characters/${animal?'native':'ip-characters'}/${id}`;
 const variants={};
 for(const [mode,source]of Object.entries(c.variants)){
  if(c.human&&mode!=='current')throw Error('Native human excluded');
  const out=base+(mode===c.defaultVariant?'':'_'+mode)+'.glb',lowOut=out.replace(/\.glb$/,'_low.glb');
  const rows=['high','low'].map(lod=>manifest.assets.find(a=>a.id===c.id&&a.mode===mode&&a.lod===lod));
  if(rows.some(a=>!a||a.visualReview!=='pass'))throw Error('Missing accepted source: '+id+' '+mode);
  const [high,low]=rows;
  const entry={out,src:'transformationChoices:'+high.file,sha256:high.sha256,lowSrc:'transformationChoices:'+low.file,lowSha256:low.sha256,precompressed:true};
  const existing=config.files.findIndex(f=>f.out===out);if(existing<0)config.files.push(entry);else config.files[existing]=entry;
  for(const [asset,target]of [[high,out],[low,lowOut]]){
   const bytes=fs.readFileSync(path.join(input,asset.file));if(sha(bytes)!==asset.sha256)throw Error('Model hash differs');
   const output=path.join(root,config.outDir,target);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,bytes);
   if(asset.triangles>budgets.character.triangles)budgets.fileOverrides[target]={triangles:asset.triangles,sourceSha256:asset.sha256,reason:'User-authorized transformation fidelity exception, pack30; global character budget unchanged'};
   report.push({id,mode,lod:asset.lod,out:target,source:asset.file,sha256:asset.sha256,triangles:asset.triangles,bytes:bytes.length});
  }
  variants[mode]={url:'/assets/island/'+out,lowUrl:'/assets/island/'+lowOut,rig:read(source.rig)};
 }
 const items=Object.fromEntries(c.requiredSlots.map(slot=>[slot,(animal?'avatar_animal_'+id.slice(7):'avatar_ip_'+id)+'_'+slot]));
 if(JSON.stringify(items)!==JSON.stringify(previous.items))throw Error('Existing required item IDs changed: '+id);
 contract.characters.push({id,label:c.label,ip:!animal,human:c.human,defaultVariant:c.defaultVariant,items,variants,...variants[c.defaultVariant]});
}
if(Object.values(contract.characters).reduce((n,c)=>n+Object.keys(c.variants).length,0)!==37)throw Error('Expected 37 variants');
fs.writeFileSync(configFile,JSON.stringify(config,null,2)+'\n');
budgets.$transformationChoices='Pack30 explicit fidelity exception applies only to listed transformation file hashes and measured triangle counts. Human5 current only, nonhuman16 current/native; GPU performance remains unverified.';
fs.writeFileSync(budgetFile,JSON.stringify(budgets,null,2)+'\n');
const code=fs.readFileSync(moduleFile,'utf8');
if(!/^const DATA=.*;$/m.test(code))throw Error('DATA marker missing; do not overwrite runtime logic');
fs.writeFileSync(moduleFile,code.replace(/^const DATA=.*;$/m,'const DATA='+JSON.stringify(contract)+';'));
fs.writeFileSync(path.join(__dirname,'transformation-choices-import.json'),JSON.stringify({package:path.basename(input),checksumManifestSha256:sha(sumBytes),characters:21,current:21,native:16,variants:37,GLBs:74,bytes:report.reduce((n,r)=>n+r.bytes,0),sourceVerified:true,files:report},null,2)+'\n');
console.log(JSON.stringify({imported:74,variants:37,sourcePackage:path.basename(input)}));
