'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),load=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
test('변신 제작본 인수: 74개 실제 파일·37선택안·개별 예산 예외의 SHA와 빌드 설정 보존',()=>{
 const report=load('tools/assets/transformation-choices-import.json'),config=load('tools/assets/island-models.json'),budget=load('tools/assets/budgets.json');
 assert.equal(report.GLBs,74);assert.equal(report.variants,37);assert.equal(report.current,21);assert.equal(report.native,16);assert.equal(report.sourceVerified,true);
 assert.equal(report.files.length,74);assert.equal(new Set(report.files.map(a=>a.out)).size,74);
 assert.equal(budget.character.triangles,16464,'global character ceiling preserved');
 for(const a of report.files){
  const bytes=fs.readFileSync(path.join(root,config.outDir,a.out));
  assert.equal(bytes.length,a.bytes,a.out);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),a.sha256,a.out);
  const base=a.out.replace(/_low\.glb$/,'.glb'),entry=config.files.find(v=>v.out===base);
  assert.ok(entry?.precompressed,a.out);
  assert.equal(a.lod==='low'?entry.lowSha256:entry.sha256,a.sha256,a.out);
  if(a.triangles>16464){assert.equal(budget.fileOverrides[a.out]?.triangles,a.triangles,a.out);assert.equal(budget.fileOverrides[a.out]?.sourceSha256,a.sha256,a.out);}
 }
 const humans=new Set(['ironman','superman','batman','spiderman','captainamerica']);
 for(const a of report.files.filter(a=>humans.has(a.id)))assert.equal(a.mode,'current');
});
