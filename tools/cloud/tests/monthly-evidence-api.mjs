// Synthetic local evidence access and byte-integrity checks. No publication.
import { randomUUID, createHash } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { PDFDocument } from 'pdf-lib';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { loadCloudEnvironment } from '../common.mjs';
import { digest } from '../../../application/server/monthly/contract.mjs';
loadCloudEnvironment({seeding:true});
const { PrismaClient }=await import('@prisma/client');
const db=new PrismaClient(), teamId=process.env.PAPERMARK_TEAM_ID, suffix=randomUUID(), password=`fixture-${suffix}`;
const bucket=process.env.NEXT_PRIVATE_UPLOAD_BUCKET;
const s3=new S3Client({endpoint:process.env.NEXT_PRIVATE_UPLOAD_ENDPOINT,region:process.env.NEXT_PRIVATE_UPLOAD_REGION,forcePathStyle:true,requestChecksumCalculation:'WHEN_REQUIRED',credentials:{accessKeyId:process.env.NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID,secretAccessKey:process.env.NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY}});
const key=`${teamId}/core/${suffix}/source.pdf`, versions=[];
class Client {
 cookies=new Map();
 async call(p,o={}){const h=new Headers(o.headers||{});h.set('origin','http://127.0.0.1:3000');if(this.cookies.size)h.set('cookie',[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; '));const r=await fetch('http://127.0.0.1:3000'+p,{...o,headers:h,redirect:'manual'});for(const x of r.headers.getSetCookie()){const v=x.split(';')[0],i=v.indexOf('=');this.cookies.set(v.slice(0,i),v.slice(i+1));}return r;}
 async login(email){let r=await this.call('/api/auth/csrf');const {csrfToken}=await r.json();await this.call('/api/auth/callback/monthly-principal',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email,password,csrfToken,json:'true'})});r=await this.call('/api/auth/session');if(!(await r.json())?.user?.id)throw Error('Synthetic reviewer login failed');}
}
const eq=(actual,expected,label)=>{if(actual!==expected)throw Error(`${label}: expected ${expected}, got ${actual}`)};
let document,version,candidate,principal,other,statePath;
try {
 const pdf=await PDFDocument.create();pdf.addPage([200,200]);const bytes=Buffer.from(await pdf.save()), sha=createHash('sha256').update(bytes).digest('hex');
 versions.push((await s3.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:bytes,ContentType:'application/pdf',IfNoneMatch:'*'}))).VersionId);
 document=await db.document.create({data:{teamId,name:`Synthetic evidence ${suffix}.pdf`,file:key,type:'pdf',contentType:'application/pdf',storageType:'S3_PATH'}});
 version=await db.documentVersion.create({data:{documentId:document.id,versionNumber:1,file:key,type:'pdf',contentType:'application/pdf',storageType:'S3_PATH',hasPages:true}});
 statePath=path.join(process.env.PAPERMARK_STATE_DIR,`render-${version.id}.json`);await writeFile(statePath,JSON.stringify({status:'ready',sha256:sha,updatedAt:new Date().toISOString()}),{mode:0o600});
 const pw=await bcrypt.hash(password,10);
 principal=await db.monthlyPrincipal.create({data:{teamId,email:`evidence-${suffix}@example.invalid`,passwordHash:pw,role:'finance',verifiedAt:new Date()}});
 other=await db.monthlyPrincipal.create({data:{teamId,email:`other-evidence-${suffix}@example.invalid`,passwordHash:pw,role:'finance',verifiedAt:new Date()}});
 const content={title:'Synthetic',report:'A result',claims:[{id:'c1',text:'A result',review:['finance'],evidence:[{source:'fixture',reference:'fixture',date:'2030-04-01T00:00:00Z',sha256:sha,versionId:version.id}]}],files:[],audience:{roomId:'fixture-room',investorIds:[]},visibility:{expiresAt:'2099-01-01T00:00:00Z',allowDownload:false,notifications:false},gaps:[]};
 candidate=await db.monthlyCandidate.create({data:{teamId,period:'2031-04',content,hash:digest(content),createdBy:'cloud-synthetic-owner'}});
 await db.monthlyReviewAssignment.create({data:{candidateId:candidate.id,principalId:principal.id,claimId:'c1',scope:'finance',createdBy:'cloud-synthetic-owner'}});
 const allowed=new Client(), denied=new Client(), anonymous=new Client();await allowed.login(principal.email);await denied.login(other.email);
 const url=`/api/monthly/review/evidence?candidateId=${encodeURIComponent(candidate.id)}&claimId=c1&index=0`;
 eq((await anonymous.call(url)).status,401,'anonymous');eq((await denied.call(url)).status,404,'unassigned');
 let r=await allowed.call(url);eq(r.status,200,'assigned evidence');if(!bytes.equals(Buffer.from(await r.arrayBuffer())))throw Error('Evidence bytes differ');
 eq((await allowed.call(url.replace('claimId=c1','claimId=other'))).status,404,'claim tamper');
 versions.push((await s3.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:Buffer.from('synthetic changed bytes')}))).VersionId);
 eq((await allowed.call(url)).status,409,'changed stored bytes');
 await db.monthlyPrincipal.update({where:{id:principal.id},data:{revokedAt:new Date()}});eq((await allowed.call(url)).status,401,'revoked session');
 console.log('Synthetic evidence checks passed: assignment, exact byte readback, tampering, anonymous and cross-reviewer denial, and revocation.');
} finally {
 if(candidate){await db.monthlyReviewAssignment.deleteMany({where:{candidateId:candidate.id}});await db.monthlyCandidate.delete({where:{id:candidate.id}})}
 for(const p of [principal,other])if(p)await db.monthlyPrincipal.delete({where:{id:p.id}});
 if(version)await db.documentVersion.delete({where:{id:version.id}});if(document)await db.document.delete({where:{id:document.id}});
 if(statePath)await unlink(statePath).catch(()=>{});
 for(const VersionId of versions)if(VersionId)await s3.send(new DeleteObjectCommand({Bucket:bucket,Key:key,VersionId}));
 await db.$disconnect();
}
