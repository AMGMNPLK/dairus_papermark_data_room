// Private investor communication archive, modified 2026-10-09. AGPL-3.0-only.
// Runtime owner state only: no mail provider, attachments, public access or sending API.
import { z } from "zod";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { owner, readState, writeState, readLimited, HttpError, safe } from "./core";
const id=z.string().regex(/^[a-f0-9]{16}$/);
const date=z.string().datetime({offset:true});
const section=z.object({id:z.string().regex(/^section-\d{1,3}$/),title:z.string().min(1).max(200),category:z.enum(["overview","asks","plans","progress","metrics","context","other"]),text:z.string().max(100000)}).strict();
const update=z.object({id,subject:z.string().min(1).max(300),sentAt:date,periodLabel:z.string().max(100),periodKey:z.string().regex(/^2023-(0[1-9]|1[0-2])$/),sourceUrl:z.string().url().refine(s=>{const u=new URL(s);return u.protocol==="https:"&&u.hostname==="mail.google.com";}),sourceSha256:z.string().regex(/^[a-f0-9]{64}$/),originalText:z.string().max(200000),sections:z.array(section).max(100),sourceNotes:z.array(z.string().max(1000)).max(10)}).strict();
const corpusSchema=z.object({schema:z.literal(1),audience:z.object({name:z.string().max(100),organization:z.string().max(100),year:z.literal(2023)}).strict(),coverage:z.object({matchingSentMessages:z.number().int().nonnegative().max(10000),originalUpdates:z.number().int().max(1000),timezone:z.literal("Europe/Madrid"),reviewedAt:date}).strict(),updates:z.array(update).max(1000)}).strict();
const noteSchema=z.object({id,note:z.string().max(10000),revision:z.string().uuid().nullable()}).strict();
const headers={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
async function corpus(){
 const raw=await readState<unknown>("investor-communications-2023.json"),result=corpusSchema.safeParse(raw);
 if(!result.success)throw new HttpError(503,"Investor archive is not available. Try again later.");
 const data=result.data;
 if(data.coverage.originalUpdates!==data.updates.length||new Set(data.updates.map(u=>u.id)).size!==data.updates.length||data.updates.some(u=>new Intl.DateTimeFormat("en",{year:"numeric",timeZone:"Europe/Madrid"}).format(new Date(u.sentAt))!=="2023"))throw new HttpError(503,"Investor archive needs a source review");
 return data;
}
export async function archiveGet(){return safe(async()=>{await owner();return Response.json(await corpus(),{headers});});}
async function existingNote(entryId:string){
 const data=await corpus();if(!data.updates.some(u=>u.id===entryId))throw new HttpError(404,"Update not found");
 const raw=await readState<unknown>(`investor-note-${entryId}.json`);
 if(!raw)return {id:entryId,note:"",revision:null};
 const result=noteSchema.safeParse(raw);if(!result.success||result.data.id!==entryId)throw new HttpError(503,"Private note needs review");return result.data;
}
export async function notesGet(request:Request){return safe(async()=>{await owner();const key=id.safeParse(new URL(request.url).searchParams.get("id"));if(!key.success)throw new HttpError(400,"Choose a valid update");return Response.json(await existingNote(key.data),{headers});});}
export async function notesPut(request:Request){return safe(async()=>{
 const user=await owner(request,true);let input:unknown;
 try{input=JSON.parse((await readLimited(request,50000)).toString());}catch(e){if(e instanceof HttpError&&e.status===413)throw new HttpError(413,"Note request is too large");if(e instanceof HttpError)throw e;throw new HttpError(400,"Enter a valid note");}
 const result=noteSchema.safeParse(input);if(!result.success)throw new HttpError(400,"Choose an update and a note of at most 10,000 characters");
 const body=result.data;
 // Serializes note saves across workers; revision prevents overwriting another open browser.
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"investor-note:"+user.teamId+":"+body.id}))`;
  const current=await existingNote(body.id);if(body.revision!==current.revision)throw new HttpError(409,"This note changed in another session. Reload it before saving.");
  const next={...body,revision:randomUUID()};await writeState(`investor-note-${body.id}.json`,next);
  return Response.json(next,{headers});
 },{maxWait:5000,timeout:10000});
});}
