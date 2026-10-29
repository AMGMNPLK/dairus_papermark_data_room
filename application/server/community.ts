// Free community adaptation, 2026-10-09. AGPL-3.0-only.
// Local PostgreSQL only. No commercial server imports, mail, invitations or link creation.
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { owner, safe, HttpError, readLimited } from "./core";
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{"Cache-Control":"private, no-store"}});
function pagination(url:URL) {
 const positive=(s:string|null,fallback:number,max:number)=>Math.max(1,Math.min(max,Number.isSafeInteger(Number(s))&&Number(s)>0?Number(s):fallback));
 const page=positive(url.searchParams.get("page"),1,10000),pageSize=positive(url.searchParams.get("pageSize"),10,100);
 return {page,pageSize,offset:(page-1)*pageSize};
}
function meta(total:number,page:number,pageSize:number){return {currentPage:page,pageSize,totalItems:total,totalPages:Math.ceil(total/pageSize),hasNext:page*pageSize<total,hasPrev:page>1};}
function name(value:unknown,max=100) {
 if(typeof value!=="string"||!value.trim()||value.trim().length>max||/[<>\x00-\x1f/\\]/.test(value))throw new HttpError(400,`Use a plain name of 1–${max} characters`);
 return value.trim();
}
async function context(request:Request,mutating=false) {
 const user=await owner(request,mutating),url=new URL(request.url),parts=url.pathname.slice("/api/teams/".length).split("/").map(decodeURIComponent);
 if(parts[0]!==user.teamId)throw new HttpError(404,"Workspace unavailable");
 return {user,url,parts};
}
async function room(id:string,teamId:string,mutating=false) {
 const r=await prisma.dataroom.findFirst({where:{id,teamId}});if(!r)throw new HttpError(404,"Room unavailable");
 if(mutating&&await prisma.link.count({where:{dataroomId:id,teamId,deletedAt:null,isArchived:false}}))throw new HttpError(409,"This room has sharing links. A new approved snapshot is required before changing it.");
 return r;
}
function activeViews(teamId:string){return Prisma.sql`FROM "View" v JOIN "Document" d ON d.id=v."documentId" AND d."teamId"=${teamId} LEFT JOIN "Viewer" c ON c.id=v."viewerId" AND c."teamId"=${teamId} WHERE v."teamId"=${teamId} AND v."isArchived"=false`;}
export async function communityGet(request:Request):Promise<Response> {
 return safe(async()=>{
 const {user,url,parts}=await context(request);const resource=parts[1];
 if(resource==="viewers") {
  const {page,pageSize,offset}=pagination(url);
  if(!parts[2]) {
   const query=(url.searchParams.get("query")||"").slice(0,200),sort=url.searchParams.get("sortBy")==="totalVisits"?"totalVisits":"lastViewed",order=url.searchParams.get("sortOrder")==="asc"?"asc":"desc";
   const orderBy=sort==="totalVisits"?(order==="asc"?Prisma.sql`"totalVisits" ASC`:Prisma.sql`"totalVisits" DESC`):(order==="asc"?Prisma.sql`"lastViewed" ASC`:Prisma.sql`"lastViewed" DESC`);
   const common=Prisma.sql`WITH sessions AS (SELECT CASE WHEN c.id IS NULL THEN 'anonymous:'||v.id ELSE c.id END AS id, COALESCE(c.email,v."viewerEmail",'Anonymous visitor') AS email,v."viewerName",v."viewedAt",COALESCE(c.verified,false) AS verified ${activeViews(user.teamId)}), contacts AS (SELECT id,MAX(email) AS email,MAX("viewerName") AS "viewerName",MIN("viewedAt") AS "createdAt",MAX("viewedAt") AS "updatedAt",MAX("viewedAt") AS "lastViewed",COUNT(*)::int AS "totalVisits",BOOL_OR(verified) AS verified FROM sessions GROUP BY id) `;
   const condition=Prisma.sql` WHERE POSITION(LOWER(${query}) IN LOWER(email||' '||COALESCE("viewerName",'')))>0`;
   const count=await prisma.$queryRaw<{count:number}[]>(Prisma.sql`${common} SELECT COUNT(*)::int AS count FROM contacts ${condition}`);
   const viewers=await prisma.$queryRaw(Prisma.sql`${common} SELECT * FROM contacts ${condition} ORDER BY ${orderBy},id ASC LIMIT ${pageSize} OFFSET ${offset}`);
   return json({viewers,pagination:meta(count[0].count,page,pageSize),sorting:{sortBy:sort,sortOrder:order}});
  }
  if(parts.length!==3)throw new HttpError(404,"Visitor unavailable");
  const id=parts[2],anonymous=id.startsWith("anonymous:"),condition=anonymous?Prisma.sql`AND v.id=${id.slice(10)} AND c.id IS NULL`:Prisma.sql`AND c.id=${id}`;
  const identity=await prisma.$queryRaw<{id:string,email:string,verified:boolean,createdAt:Date,updatedAt:Date}[]>(Prisma.sql`SELECT ${id} AS id,COALESCE(MAX(c.email),MAX(v."viewerEmail"),'Anonymous visitor') AS email,BOOL_OR(COALESCE(c.verified,false)) AS verified,MIN(v."viewedAt") AS "createdAt",MAX(v."viewedAt") AS "updatedAt" ${activeViews(user.teamId)} ${condition} HAVING COUNT(*)>0`);
  if(!identity.length)throw new HttpError(404,"Visitor unavailable");
  const stats=await prisma.$queryRaw<{documentId:string,name:string,type:string,contentType:string,lastViewed:Date,viewCount:number}[]>(Prisma.sql`SELECT d.id AS "documentId",d.name,d.type,d."contentType",MAX(v."viewedAt") AS "lastViewed",COUNT(*)::int AS "viewCount" ${activeViews(user.teamId)} ${condition} GROUP BY d.id ORDER BY MAX(v."viewedAt") DESC,d.id ASC LIMIT 1000`);
  if(stats.length===1000)throw new HttpError(409,"Visitor history exceeds the local report bound; narrow the source dataset");
  const sort=url.searchParams.get("sortBy")==="viewCount"?"viewCount":"lastViewed",order=url.searchParams.get("sortOrder")==="asc"?"asc":"desc";
  stats.sort((a,b)=>(sort==="viewCount"?a.viewCount-b.viewCount:new Date(a.lastViewed).getTime()-new Date(b.lastViewed).getTime())*(order==="asc"?1:-1));
  return json({...identity[0],views:stats.slice(offset,offset+pageSize).map(s=>({...s,document:{id:s.documentId,name:s.name,type:s.type,contentType:s.contentType},totalDuration:null})),pagination:meta(stats.length,page,pageSize),sorting:{sortBy:sort,sortOrder:order},durationAvailable:false});
 }
 if(resource!=="datarooms")throw new HttpError(404,"Feature unavailable");
 if(!parts[2]) {
  const search=(url.searchParams.get("search")||"").slice(0,100),rows=await prisma.dataroom.findMany({where:{teamId:user.teamId,name:{contains:search,mode:"insensitive"}},include:{_count:{select:{documents:true,views:true}},links:{where:{deletedAt:null},select:{id:true,isArchived:true,expiresAt:true,createdAt:true}},views:{where:{isArchived:false},orderBy:{viewedAt:"desc"},take:1,select:{viewedAt:true}},tags:{include:{tag:true}}},orderBy:{name:"asc"},take:100});
  return json({datarooms:rows,totalCount:await prisma.dataroom.count({where:{teamId:user.teamId}})});
 }
 const r=await room(parts[2],user.teamId);
 if(parts.length===3)return json({...r,private:true,sharingEnabled:false});
 if(parts.length===4&&parts[3]==="content") {
  const [folders,documents,available]=await Promise.all([
   prisma.dataroomFolder.findMany({where:{dataroomId:r.id},select:{id:true,name:true,path:true,parentId:true},orderBy:{path:"asc"},take:200}),
   prisma.dataroomDocument.findMany({where:{dataroomId:r.id,document:{teamId:user.teamId}},select:{id:true,folderId:true,document:{select:{id:true,name:true,versions:{where:{isPrimary:true},select:{id:true,hasPages:true},take:1}}}},orderBy:{createdAt:"asc"},take:200}),
   prisma.document.findMany({where:{teamId:user.teamId},select:{id:true,name:true},orderBy:{name:"asc"},take:50})]);
  return json({room:r,folders,documents,available,sharingEnabled:false});
 }
 throw new HttpError(404,"Feature unavailable");
 });
}
export async function communityMutate(request:Request):Promise<Response> {
 return safe(async()=>{
 const {user,parts}=await context(request,true);
 if(parts[1]!=="datarooms"||parts.length>4)throw new HttpError(403,"Operation unavailable");
 const data=JSON.parse((await readLimited(request,8192)).toString());
 if(request.method==="POST"&&parts.length===2) {
  if(Object.keys(data).some(k=>k!=="name"))throw new HttpError(400,"Unsupported room control");
  const roomName=name(data.name);
  const created=await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.teamId+":rooms"}))`;
   if(await tx.dataroom.count({where:{teamId:user.teamId}})>=100)throw new HttpError(409,"Local room limit reached");
   return tx.dataroom.create({data:{teamId:user.teamId,name:roomName,pId:"dr_"+randomUUID().replaceAll("-",""),enableChangeNotifications:false,allowBulkDownload:false,agentsEnabled:false,conversationsEnabled:false,defaultPermissionStrategy:"HIDDEN_BY_DEFAULT"}});
  });return json({dataroom:created},201);
 }
 const r=await room(parts[2]||"",user.teamId,true);
 if(request.method==="PATCH"&&parts.length===3) {
  if(Object.keys(data).some(k=>k!=="name"))throw new HttpError(400,"Only a private room's name can be changed here");
  return json(await prisma.dataroom.update({where:{id:r.id},data:{name:name(data.name)}}));
 }
 if(request.method==="POST"&&parts[3]==="folders") {
  if(Object.keys(data).some(k=>!["name","parentId"].includes(k)))throw new HttpError(400,"Unsupported folder control");
  const folderName=name(data.name,80),parent=data.parentId?await prisma.dataroomFolder.findFirst({where:{id:String(data.parentId),dataroomId:r.id}}):null;
  if(data.parentId&&!parent)throw new HttpError(404,"Parent folder unavailable");
  if((parent?.path.length||0)>800)throw new HttpError(400,"Folder nesting limit reached");
  const path=(parent?.path||"")+"/"+folderName;
  return json(await prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${r.id+":folders"}))`;
   if(await tx.dataroomFolder.count({where:{dataroomId:r.id}})>=200)throw new HttpError(409,"Local folder limit reached");
   if(await tx.dataroomFolder.count({where:{dataroomId:r.id,path}}))throw new HttpError(409,"A folder with this name already exists");
   return tx.dataroomFolder.create({data:{dataroomId:r.id,name:folderName,path,parentId:parent?.id}});
  }),201);
 }
 if(request.method==="POST"&&parts[3]==="documents") {
  if(Object.keys(data).some(k=>!["documentId","folderId","remove"].includes(k)))throw new HttpError(400,"Unsupported document control");
  if(typeof data.documentId!=="string")throw new HttpError(400,"Choose a document");
  const document=await prisma.document.findFirst({where:{id:data.documentId,teamId:user.teamId}});if(!document)throw new HttpError(404,"Document unavailable");
  const folder=data.folderId?await prisma.dataroomFolder.findFirst({where:{id:String(data.folderId),dataroomId:r.id}}):null;if(data.folderId&&!folder)throw new HttpError(404,"Folder unavailable");
  if(data.remove===true){await prisma.dataroomDocument.deleteMany({where:{dataroomId:r.id,documentId:document.id}});return json({removedFromRoom:true,documentPreserved:true});}
  const item=await prisma.dataroomDocument.upsert({where:{dataroomId_documentId:{dataroomId:r.id,documentId:document.id}},create:{dataroomId:r.id,documentId:document.id,folderId:folder?.id},update:{folderId:folder?.id||null}});
  return json({item,private:true},201);
 }
 throw new HttpError(403,"Operation unavailable. Sharing and notifications remain disabled.");
 });
}

export async function communityAnalytics(request:Request) {
 return safe(async()=>{
 const user=await owner(),url=new URL(request.url);if(url.searchParams.get("teamId")!==user.teamId)throw new HttpError(404,"Workspace unavailable");
 const interval=url.searchParams.get("interval")||"7d",days=({"24h":1,"7d":7,"30d":30} as Record<string,number>)[interval];
 let start:Date,end=new Date();
 if(interval==="custom") {
  start=new Date(url.searchParams.get("startDate")||"");end=new Date(url.searchParams.get("endDate")||"");end.setUTCHours(23,59,59,999);
  if(!Number.isFinite(+start)||!Number.isFinite(+end)||+end<+start||+end-(+start)>31*86400000)throw new HttpError(400,"Choose a valid range up to 31 days");
 }else{if(!days)throw new HttpError(400,"Choose a supported date range");start=new Date(+end-days*86400000);}
 const time=Prisma.sql`AND v."viewedAt">=${start} AND v."viewedAt"<=${end}`,type=url.searchParams.get("type");
 if(type==="overview") {
  const result=await prisma.$queryRaw<{views:number,visitors:number}[]>(Prisma.sql`SELECT COUNT(*)::int AS views,COUNT(DISTINCT COALESCE(c.id,'anonymous:'||v.id))::int AS visitors ${activeViews(user.teamId)} ${time}`);
  const graph=await prisma.$queryRaw(Prisma.sql`SELECT TO_CHAR(v."viewedAt" AT TIME ZONE 'UTC','YYYY-MM-DD') AS date,COUNT(*)::int AS views ${activeViews(user.teamId)} ${time} GROUP BY date ORDER BY date`);
  return json({counts:{...result[0],links:await prisma.link.count({where:{teamId:user.teamId,deletedAt:null,isArchived:false}}),documents:await prisma.document.count({where:{teamId:user.teamId}})},graph});
 }
 if(type==="views") {
  const views=await prisma.$queryRaw(Prisma.sql`SELECT v.id,v."viewerEmail",v."viewerName",v.verified,v."viewedAt",v."documentId",v."teamId",d.name AS "documentName",(SELECT l.name FROM "Link" l WHERE l.id=v."linkId") AS "linkName",NULL::int AS "totalDuration",NULL::int AS "completionRate" ${activeViews(user.teamId)} ${time} ORDER BY v."viewedAt" DESC,v.id LIMIT 500`);
  return json({views,hiddenFromPause:0});
 }
 if(type==="visitors") {
  const visitors=await prisma.$queryRaw(Prisma.sql`SELECT COALESCE(c.id,'anonymous:'||v.id) AS "viewerId",COALESCE(MAX(c.email),MAX(v."viewerEmail"),'Anonymous visitor') AS email,MAX(v."viewerName") AS "viewerName",BOOL_OR(COALESCE(c.verified,false)) AS verified,COUNT(*)::int AS "totalViews",COUNT(DISTINCT v."documentId")::int AS "uniqueDocuments",MAX(v."viewedAt") AS "lastActive",NULL::int AS "totalDuration" ${activeViews(user.teamId)} ${time} GROUP BY COALESCE(c.id,'anonymous:'||v.id) ORDER BY MAX(v."viewedAt") DESC LIMIT 500`);
  return json({visitors,hiddenFromPause:0});
 }
 if(type==="documents") {
  const rows=await prisma.$queryRaw(Prisma.sql`SELECT d.id,d.name,COUNT(v.id)::int AS views,MAX(v."viewedAt") AS "lastViewed",'Not recorded' AS "avgDuration" FROM "Document" d LEFT JOIN "View" v ON v."documentId"=d.id AND v."teamId"=${user.teamId} AND NOT v."isArchived" AND v."viewedAt">=${start} AND v."viewedAt"<=${end} WHERE d."teamId"=${user.teamId} GROUP BY d.id ORDER BY COUNT(v.id) DESC,d.id LIMIT 50`);return json(rows);
 }
 if(type==="links") {
  const rows=await prisma.$queryRaw<{id:string}[]>(Prisma.sql`SELECT l.id,l.name,l."documentId",d.name AS "documentName",COUNT(v.id)::int AS views,MAX(v."viewedAt") AS "lastViewed",'Not recorded' AS "avgDuration" FROM "Link" l JOIN "Document" d ON d.id=l."documentId" AND d."teamId"=${user.teamId} LEFT JOIN "View" v ON v."linkId"=l.id AND v."teamId"=${user.teamId} AND NOT v."isArchived" AND v."viewedAt">=${start} AND v."viewedAt"<=${end} WHERE l."teamId"=${user.teamId} AND l."deletedAt" IS NULL AND NOT l."isArchived" GROUP BY l.id,d.name ORDER BY COUNT(v.id) DESC,l.id LIMIT 50`);
  return json(rows.map(r=>({...r,url:`${process.env.NEXT_PUBLIC_BASE_URL}/view/${r.id}`})));
 }
 throw new HttpError(404,"Report unavailable");
 });
}
