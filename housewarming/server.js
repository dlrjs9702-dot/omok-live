"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 3000);
const SECRET = process.env.SHARE_TOKEN || "";
const STORE = process.env.DATA_PATH || "/tmp/housewarming-20261123-state.json";
const OWNERS = ["공희운", "이창민", "이건", "김우성"];
const MEATS = ["삼겹살", "목살", "항정살"];
const clients = new Set();
const seeds = [
  ["식사 재료","비빔면","6봉"],
  ["식사 재료","상추·깻잎","각 1봉"],
  ["식사 재료","마늘·고추","적당량"],
  ["식사 재료","쌈장","1통"],
  ["식사 재료","김치","1팩"],
  ["식사 재료","소금·후추","1세트"],
  ["조리 도구","휴대용 가스버너","1대"],
  ["조리 도구","부탄가스","2~3개"],
  ["조리 도구","구이용 불판","1개"],
  ["조리 도구","고기 집게·가위","각 1개"],
  ["조리 도구","비빔면용 냄비·채반","각 1개"],
  ["식기·정리","앞접시·그릇","4세트"],
  ["식기·정리","젓가락·숟가락","4세트"],
  ["식기·정리","컵","4개"],
  ["식기·정리","키친타월·물티슈","각 1개"],
  ["식기·정리","쓰레기·음식물 봉투","각 1개"],
  ["음료·간식","생수","2L × 2병"],
  ["음료·간식","탄산음료","1.5L × 2병"],
  ["음료·간식","과자","2~3봉"],
  ["보드게임","보드게임 구성품 확인","보유 중"],
  ["보드게임","테이블·의자","4인용"]
];
function newState() {
  return {
    version:0, savedAt:new Date().toISOString(),
    meats: Object.fromEntries(MEATS.map((name) => [name, {grams:name==="삼겹살"?800:name==="목살"?400:0,owner:"",done:false}])),
    items: seeds.map(([category,name,quantity]) => ({id:crypto.randomUUID(),category,name,quantity,owner:"",done:false}))
  };
}
let redisClient = null;
let state;
try { state = JSON.parse(fs.readFileSync(STORE,"utf8")); }
catch (_) { state = newState(); }
function send(res, code, obj) {
  res.writeHead(code, {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});
  res.end(JSON.stringify(obj));
}
function validOwner(value){ return value==="" || OWNERS.includes(value); }
function bounded(value, max=120){return String(value==null?"":value).slice(0,max).trim();}
function commit(){
  state.version += 1;
  state.savedAt = new Date().toISOString();
  if (redisClient) redisClient.set("housewarming:20261123:state", JSON.stringify(state)).catch(err => console.warn("Redis write:",err.message));
  try { fs.writeFileSync(STORE+".tmp",JSON.stringify(state),"utf8"); fs.renameSync(STORE+".tmp",STORE); }
  catch(err){console.warn("Ephemeral write failed:",err.message);}
  for(const res of clients){try {res.write("data: change\n\n");} catch(_) {clients.delete(res);} }
}
function authorize(url,req){
  const key = url.searchParams.get("key") || req.headers["x-share-token"] || "";
  return !!SECRET && key === SECRET;
}
function readBody(req){
  return new Promise((resolve,reject)=>{
    let data="";
    req.on("data",part=>{data+=part;if(data.length>65536){reject(new Error("large body"));req.destroy();}});
    req.on("end",()=>{try{resolve(JSON.parse(data||"{}"));}catch(_){reject(new Error("invalid json"));}});
    req.on("error",reject);
  });
}
const html = fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8");
const server = http.createServer(async(req,res)=>{
  const url = new URL(req.url,"http://localhost");
  if(req.method==="GET" && (url.pathname==="/" || url.pathname==="/index.html")){
    res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"});
    return res.end(html);
  }
  if(url.pathname==="/health") return send(res,200,{ok:true});
  if(!url.pathname.startsWith("/api/")) return send(res,404,{error:"not found"});
  if(!authorize(url,req)) return send(res,403,{error:"공유 링크의 접근 키가 필요합니다."});
  if(req.method==="GET" && url.pathname==="/api/state") return send(res,200,state);
  if(req.method==="GET" && url.pathname==="/api/events"){
    res.writeHead(200,{"Content-Type":"text/event-stream; charset=utf-8","Cache-Control":"no-cache, no-transform","Connection":"keep-alive","X-Accel-Buffering":"no"});
    res.write("data: connected\n\n");
    clients.add(res);
    const ping=setInterval(()=>{try{res.write(": ping\n\n");}catch(_){}},20000);
    req.on("close",()=>{clearInterval(ping);clients.delete(res);});
    return;
  }
  try{
    if(req.method==="POST" && url.pathname==="/api/items"){
      const body=await readBody(req), name=bounded(body.name,100);
      if(!name) return send(res,400,{error:"준비물 이름을 입력해 주세요."});
      const item={id:crypto.randomUUID(),category:bounded(body.category||"기타",40),name,quantity:bounded(body.quantity,40),owner:validOwner(body.owner)?body.owner:"",done:false};
      state.items.push(item); commit(); return send(res,201,{item});
    }
    const itemMatch=url.pathname.match(/^\/api\/items\/([0-9a-f-]+)$/);
    if(itemMatch){
      const i=state.items.findIndex(x=>x.id===itemMatch[1]);
      if(i<0) return send(res,404,{error:"이미 삭제된 항목입니다."});
      if(req.method==="DELETE"){state.items.splice(i,1);commit();return send(res,200,{ok:true});}
      if(req.method==="PATCH"){
        const body=await readBody(req);
        if("owner" in body && !validOwner(body.owner))return send(res,400,{error:"담당자를 선택해 주세요."});
        for(const f of ["category","name","quantity","owner","done"]){
          if(!(f in body))continue;
          if(f==="done")state.items[i].done=!!body.done;
          else state.items[i][f]=bounded(body[f],f==="name"?100:40);
        }
        if(!state.items[i].name) return send(res,400,{error:"이름을 입력해 주세요."});
        commit(); return send(res,200,{item:state.items[i]});
      }
    }
    const meatMatch=url.pathname.match(/^\/api\/meats\/(.+)$/);
    if(req.method==="PATCH" && meatMatch){
      const name=decodeURIComponent(meatMatch[1]), body=await readBody(req);
      if(!MEATS.includes(name))return send(res,404,{error:"고기 종류를 확인해 주세요."});
      if("grams" in body){const n=Number(body.grams);if(!Number.isInteger(n)||n<0||n>20000)return send(res,400,{error:"수량은 0~20,000g 사이여야 합니다."});state.meats[name].grams=n;}
      if("owner" in body){if(!validOwner(body.owner))return send(res,400,{error:"담당자가 올바르지 않습니다."});state.meats[name].owner=body.owner;}
      if("done" in body)state.meats[name].done=!!body.done;
      commit();return send(res,200,{meat:state.meats[name]});
    }
    if(req.method==="POST" && url.pathname==="/api/restore"){
      const b=await readBody(req);
      if(state.version!==0) return send(res,409,{error:"이미 공동 수정된 목록입니다."});
      if(!Number.isInteger(b.version)||b.version<1||!Array.isArray(b.items)||b.items.length>250||!b.meats) return send(res,400,{error:"백업 데이터가 올바르지 않습니다."});
      const items=b.items.filter(x=>x && typeof x.name==="string" && x.name.trim()).map(x=>({
        id:typeof x.id==="string" && /^[0-9a-f-]{36}$/.test(x.id)?x.id:crypto.randomUUID(),
        category:bounded(x.category,40),name:bounded(x.name,100),quantity:bounded(x.quantity,40),
        owner:validOwner(x.owner)?x.owner:"",done:!!x.done
      }));
      const meats={};
      for(const name of MEATS){const x=b.meats[name]||{};meats[name]={grams:Number.isInteger(x.grams)?Math.max(0,Math.min(x.grams,20000)):0,owner:validOwner(x.owner)?x.owner:"",done:!!x.done};}
      state.items=items;state.meats=meats;commit();return send(res,200,{ok:true});
    }
    return send(res,404,{error:"not found"});
  }catch(err){console.error(err);return send(res,500,{error:"처리 중 문제가 발생했습니다."});}
});
async function boot(){
  if(process.env.REDIS_URL){
    try{
      const {createClient}=require("redis");
      const client=createClient({url:process.env.REDIS_URL,socket:{connectTimeout:6000}});
      client.on("error",err=>console.warn("Redis connection:",err.message));
      await client.connect();
      redisClient=client;
      const stored=await client.get("housewarming:20261123:state");
      if(stored){state=JSON.parse(stored);console.log("Loaded shared checklist from Redis");}
      else console.log("Starting fresh shared checklist");
    }catch(err){console.warn("Shared cache unavailable; using local backup:",err.message);}
  }
  server.listen(PORT,"0.0.0.0",()=>console.log("Housewarming site on",PORT));
}
boot().catch(err=>{console.error(err);process.exit(1);});
