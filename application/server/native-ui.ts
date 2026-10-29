// Compatibility boundary for the original AGPL screens. Unregistered operations
// fail closed. Commercial server handlers, invitations and mail are not mounted.
import { communityGet, communityMutate, communityAnalytics } from "./community";
import prisma from "@/lib/prisma";
import { owner, safe, HttpError, renderState, ownedVersion, mediaGrant } from "./core";

export const json = (value: unknown, status = 200) => new Response(
  JSON.stringify(value, (_, v) => typeof v === "bigint" ? Number(v) : v),
  { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
);
export const unavailable = () => json({ message: "This operation is unavailable on this installation. Sharing, invitations and notifications remain disabled." }, 403);
export const flags = { ai:false, annotations:false, tokens:false, incomingWebhooks:false, workflows:false, conversations:false, advancedPermissions:false };

export async function teamsGet(request: Request) {
 if (/^\/api\/teams\/[^/]+\/(datarooms|viewers)(\/|$)/.test(new URL(request.url).pathname)) return communityGet(request);
 return safe(async () => {
  const user = await owner();
  const url = new URL(request.url);
  const parts = url.pathname.slice("/api/teams".length).split("/").filter(Boolean).map(decodeURIComponent);
  const team = await prisma.team.findUniqueOrThrow({ where:{ id:user.teamId }, include:{ users:{ include:{ user:{ select:{ id:true, name:true, email:true, image:true } } } }, documents:{ select:{ id:true, name:true, owner:{select:{id:true}} } } } });
  if (!parts.length) return json([{ ...team, role:"ADMIN" }]);
  if (parts[0] !== user.teamId) throw new HttpError(404,"Workspace unavailable");
  const resource = parts.slice(1).join("/");
  if (!resource) return json(team);
  if (resource === "billing/plan") return json({ plan:"free", startsAt:null, endsAt:null, pausedAt:null, isPaused:false, isCustomer:false, subscriptionCycle:"monthly", discount:null });
  if (resource === "billing") return json({ id:team.id, plan:"free", startsAt:null, endsAt:null, subscriptionId:null, _count:{documents:team.documents.length} });
  if (resource === "limits") return json({ documents:50, links:50, users:1, datarooms:100, domains:0, dataroomUpload:false, fileSizeLimits:{maxPages:80,pdf:20}, usage:{documents:team.documents.length, links:await prisma.link.count({where:{teamId:team.id}}), users:team.users.length} });
  if (resource === "settings") return json({ timezone:team.timezone, enableExcelAdvancedMode:team.enableExcelAdvancedMode, replicateDataroomFolders:team.replicateDataroomFolders });
  if (resource === "ignored-domains") return json(team.ignoredDomains);
  if (resource === "global-block-list") return json(team.globalBlockList);
  if (resource === "integrations/slack") return json(null);
  if (resource === "ai-settings") return json({agentsEnabled:false,vectorStoreId:null,isAdmin:true,isAIFeatureEnabled:false});
  if (resource === "brand" || resource === "branding") return json(await prisma.brand.findUnique({where:{teamId:team.id}}));
  const lists: Record<string, () => Promise<unknown>> = {
   invitations:()=>prisma.invitation.findMany({where:{teamId:team.id}}),
   datarooms:()=>prisma.dataroom.findMany({where:{teamId:team.id},take:50}),
   domains:()=>prisma.domain.findMany({where:{teamId:team.id},take:50}),
   tags:()=>prisma.tag.findMany({where:{teamId:team.id},take:100}),
   agreements:()=>prisma.agreement.findMany({where:{teamId:team.id},take:50}),
   presets:()=>prisma.linkPreset.findMany({where:{teamId:team.id},take:50}),
   "link-presets":()=>prisma.linkPreset.findMany({where:{teamId:team.id},take:50}),
   webhooks:()=>prisma.webhook.findMany({where:{teamId:team.id},select:{pId:true,url:true,triggers:true},take:50}),
  };
  if (lists[resource]) {const rows=await lists[resource]();return json(resource==="tags"?{tags:rows,totalCount:Array.isArray(rows)?rows.length:0}:rows);}
  if (resource === "folders" || resource.startsWith("folders/")) {
   const tail=parts.slice(2);
   if (tail[0] === "documents") {
    const folder=await prisma.folder.findUnique({where:{teamId_path:{teamId:team.id,path:"/"+tail.slice(1).join("/")}}});
    if (!folder) throw new HttpError(404,"Folder unavailable");
    return json(await prisma.document.findMany({where:{teamId:team.id,folderId:folder.id},include:{links:true,_count:{select:{links:true,views:true,versions:true,datarooms:true}}},take:50}));
   }
   const parent=tail.length ? await prisma.folder.findUnique({where:{teamId_path:{teamId:team.id,path:"/"+tail.join("/")}}}) : null;
   if(tail.length&&!parent) throw new HttpError(404,"Folder unavailable");
   return json(await prisma.folder.findMany({where:{teamId:team.id,...(tail.length?{parentId:parent!.id}:url.searchParams.has("root")?{parentId:null}:{})},include:{_count:{select:{documents:true,childFolders:true}}},take:100}));
  }
  if (resource === "documents") {
   const query=url.searchParams.get("query")||"";
   const docs=await prisma.document.findMany({where:{teamId:team.id,...(!query?{folderId:null}:{}),name:{contains:query,mode:"insensitive"}},include:{folder:true,links:{where:{isArchived:false,deletedAt:null}},versions:{where:{isPrimary:true},take:1},_count:{select:{links:true,views:true,versions:true,datarooms:true}}},orderBy:{createdAt:"desc"},take:50});
   const sort=url.searchParams.get("sort");
   if(sort==="name")docs.sort((a,b)=>a.name.localeCompare(b.name));
   if(sort==="links")docs.sort((a,b)=>b._count.links-a._count.links);
   if(sort==="views")docs.sort((a,b)=>b._count.views-a._count.views);
   const page=Math.max(1,Number(url.searchParams.get("page"))||1),size=Math.max(1,Math.min(50,Number(url.searchParams.get("limit"))||10));
   return json({documents:docs.slice((page-1)*size,page*size).map(d=>({...d,folderList:[]})),pagination:{total:docs.length,pages:Math.ceil(docs.length/size),currentPage:page,pageSize:size}});
  }
  if (parts[1] === "documents" && parts[2] && parts[2] !== "document-processing-status") {
   const document=await prisma.document.findFirst({where:{id:parts[2],teamId:team.id},include:{versions:{orderBy:{versionNumber:"desc"}},links:true,folder:true,datarooms:{include:{dataroom:{select:{id:true,name:true}}}},_count:{select:{links:true,views:true}}}});
   if(!document)throw new HttpError(404,"Document unavailable");
   const primaryVersion=document.versions.find(v=>v.isPrimary)||document.versions[0];
   const action=parts.slice(3).join("/");
   if(!action)return json({...document,versions:primaryVersion?[primaryVersion]:[]});
   if(action==="preview-data") {
    const version=await ownedVersion(primaryVersion.id,team.id);
    if(!version.hasPages)throw new HttpError(409,"PDF processing is not complete");
    return json({documentId:document.id,documentName:document.name,documentType:"pdf",fileType:"pdf",isVertical:version.isVertical,numPages:version.numPages,pages:version.pages.map(page=>({pageNumber:String(page.pageNumber),file:mediaGrant({versionId:version.id,page:page.pageNumber,ownerId:user.id}),embeddedLinks:[],pageLinks:[],metadata:{width:1,height:1,scaleFactor:1}}))});
   }
   if(action==="links")return json(document.links.map(l=>({...l,views:[],_count:{views:0}})));
   if(action==="versions")return json(document.versions);
   if(action==="views" && document._count.views)throw new HttpError(503,"Historical engagement analytics is unavailable without its event warehouse");
   if(action==="views")return json({hiddenViewCount:0,viewsWithDuration:[],totalViews:document._count.views,hiddenFromPause:0});
   if(action==="overview")return json({document:{...document,primaryVersion,hasPageLinks:false,isEmpty:!document._count.links&&!document._count.views},limits:{canAddLinks:false,canAddDocuments:team.documents.length<50,canAddUsers:false},featureFlags:flags,team:{plan:"free",isTrial:false},counts:document._count});
  }
  if(resource==="documents/document-processing-status") {
   const id=url.searchParams.get("documentVersionId")||"";
   const version=await prisma.documentVersion.findFirst({where:{id,document:{teamId:team.id}}});
   if(!version)throw new HttpError(404,"Version unavailable");
   const state=await renderState(id);return json({currentPageCount:state?.pageCount||0,totalPages:version.numPages||0,hasPages:state?.status==="ready",failed:state?.status==="failed"});
  }
  throw new HttpError(404,"Feature unavailable");
 });
}

export async function teamsPatch(request: Request) {
 if (/^\/api\/teams\/[^/]+\/datarooms(\/|$)/.test(new URL(request.url).pathname)) return communityMutate(request);
 return safe(async()=>{
  const user=await owner(request,true),url=new URL(request.url);
  const parts=url.pathname.slice("/api/teams/".length).split("/").map(decodeURIComponent);
  if(parts[0]!==user.teamId)throw new HttpError(404,"Workspace unavailable");
  const data=await request.json();
  if(parts.slice(1).join("/")==="update-name") {
   if(typeof data.name!=="string"||!data.name.trim()||data.name.length>32||/[<>\x00-\x1f]/.test(data.name))throw new HttpError(400,"Use a name of 1–32 plain characters");
   return json(await prisma.team.update({where:{id:user.teamId},data:{name:data.name.trim()}}));
  }
  if(parts.slice(1).join("/")==="settings" && typeof data.timezone==="string") {
   try{new Intl.DateTimeFormat("en",{timeZone:data.timezone}).format();}catch{throw new HttpError(400,"Invalid timezone");}
   return json(await prisma.team.update({where:{id:user.teamId},data:{timezone:data.timezone}}));
  }
  return unavailable();
 });
}

export async function auxiliaryGet(request:Request) {
 if(new URL(request.url).pathname==="/api/analytics")return communityAnalytics(request);
 return safe(async()=>{
  const user=await owner(),url=new URL(request.url);
  if(url.searchParams.has("teamId")&&url.searchParams.get("teamId")!==user.teamId)throw new HttpError(404,"Workspace unavailable");
  if(url.pathname==="/api/feature-flags")return json(flags);
  if(url.pathname==="/api/analytics"){
   // Without a configured event warehouse, do not invent duration/completion data.
   const views=await prisma.view.count({where:{teamId:user.teamId}});
   if(views)throw new HttpError(503,"Historical engagement analytics requires the event warehouse; no duration or completion data is inferred");
   const type=url.searchParams.get("type");
   if(type==="overview")return json({counts:{links:await prisma.link.count({where:{teamId:user.teamId}}),documents:await prisma.document.count({where:{teamId:user.teamId}}),visitors:0,views:0},graph:[]});
   if(type==="views")return json({views:[],hiddenFromPause:0});
   if(type==="visitors")return json({visitors:[],hiddenFromPause:0});
   if(type==="links")return json(await prisma.link.findMany({where:{teamId:user.teamId},select:{id:true,name:true,documentId:true,document:{select:{name:true}}},take:50}).then(a=>a.map(l=>({...l,url:`${process.env.NEXT_PUBLIC_BASE_URL}/view/${l.id}`,documentName:l.document?.name,views:0,avgDuration:"—",lastViewed:null}))));
   if(type==="documents")return json(await prisma.document.findMany({where:{teamId:user.teamId},select:{id:true,name:true,_count:{select:{links:true}}},take:50}).then(a=>a.map(d=>({...d,views:0,links:d._count.links,avgDuration:"—",lastViewed:null}))));
  }
  throw new HttpError(404,"Feature unavailable");
 });
}

export { communityMutate as teamsPost };
