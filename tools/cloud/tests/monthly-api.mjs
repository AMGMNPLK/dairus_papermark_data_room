// Disposable local-only integration: no real identities, notifications or publication.
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { loadCloudEnvironment } from '../common.mjs';
loadCloudEnvironment({ seeding: true });
const { PrismaClient } = await import('@prisma/client');
const db = new PrismaClient();
const base = 'http://127.0.0.1:3000';
const origin = base;
const suffix=randomUUID();
const teamId=process.env.PAPERMARK_TEAM_ID;
const hash='a'.repeat(64), password=`synthetic-${suffix}`;
const equal=(actual,expected,label)=>{if(actual!==expected)throw new Error(`${label}: expected ${expected}, got ${actual}`)};
class Client {
  cookies = new Map();
  async call(path, options={}) {
    const headers = new Headers(options.headers || {});headers.set('origin',origin);
    if (this.cookies.size) headers.set('cookie',[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; '));
    const response=await fetch(base+path,{...options,headers,redirect:'manual'});
    for(const value of response.headers.getSetCookie()){const [part]=value.split(';');const index=part.indexOf('=');this.cookies.set(part.slice(0,index),part.slice(index+1));}
    let data;try{data=await response.json()}catch{data=null} return {status:response.status,data};
  }
  async login(provider,credentials){
    const csrf=await this.call('/api/auth/csrf');equal(csrf.status,200,'csrf');
    const body=new URLSearchParams({...credentials,csrfToken:csrf.data.csrfToken,json:'true'});
    await this.call(`/api/auth/callback/${provider}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
    const session=await this.call('/api/auth/session');if(!session.data?.user?.id)throw new Error(`login failed: ${provider}`);
  }
  post(path,data){return this.call(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});}
}
let room, reviewer, unrelated, investor, candidateIds=[];
try {
  const owner=new Client(), anonymous=new Client(), finance=new Client(), other=new Client();
  const secret=(await readFile('.cloud/login-password.txt','utf8')).trim();
  await owner.login('owner',{password:secret});
  room=await db.dataroom.create({data:{teamId,name:`Synthetic ${suffix}`,pId:`dr_${suffix}`,enableChangeNotifications:false,allowBulkDownload:false,defaultPermissionStrategy:'HIDDEN_BY_DEFAULT'}});
  const passwordHash=await bcrypt.hash(password,10);
  reviewer=await db.monthlyPrincipal.create({data:{teamId,email:`finance-${suffix}@example.invalid`,passwordHash,role:'finance',verifiedAt:new Date()}});
  unrelated=await db.monthlyPrincipal.create({data:{teamId,email:`finance-other-${suffix}@example.invalid`,passwordHash,role:'finance',verifiedAt:new Date()}});
  investor=await db.monthlyPrincipal.create({data:{teamId,email:`investor-${suffix}@example.invalid`,passwordHash,role:'investor',verifiedAt:new Date()}});
  await db.monthlyRoomMembership.create({data:{teamId,roomId:room.id,principalId:investor.id}});
  await finance.login('monthly-principal',{email:reviewer.email,password});
  await other.login('monthly-principal',{email:unrelated.email,password});
  const content={title:'Synthetic candidate',report:'Synthetic result',claims:[{id:'claim-1',text:'Synthetic result',review:['finance'],evidence:[{source:'fixture',reference:'fixture-1',date:'2030-04-01T00:00:00Z',sha256:hash}]}],files:[],audience:{roomId:room.id,investorIds:[investor.id]},visibility:{allowDownload:false,expiresAt:'2099-01-01T00:00:00Z',notifications:false},gaps:[]};
  equal((await anonymous.call('/api/monthly?period=2030-04')).status,401,'anonymous founder denial');
  const saved=await owner.post('/api/monthly',{period:'2030-04',content});equal(saved.status,201,'save candidate');const candidate=saved.data.candidate;candidateIds.push(candidate.id);
  equal((await finance.call(`/api/monthly/review?candidateId=${candidate.id}`)).status,404,'unassigned denial');
  equal((await owner.post('/api/monthly/assign',{candidateId:candidate.id,principalId:reviewer.id,claimId:'claim-1'})).status,201,'assign');
  equal((await other.call(`/api/monthly/review?candidateId=${candidate.id}`)).status,404,'other reviewer denial');
  const packet=await finance.call(`/api/monthly/review?candidateId=${candidate.id}`);equal(packet.status,200,'assigned packet');equal(packet.data.claims.length,1,'claim scope');
  const receipt={candidateId:candidate.id,candidateHash:candidate.hash,claimId:'claim-1',claimHash:packet.data.claims[0].claimHash,decision:'approved',limitations:'Synthetic fixture only',confirmReviewed:true};
  equal((await other.post('/api/monthly/review',receipt)).status,404,'unassigned receipt denial');
  equal((await finance.post('/api/monthly/review',{...receipt,claimHash:'0'.repeat(64)})).status,409,'tampered claim denial');
  equal((await finance.post('/api/monthly/review',receipt)).status,201,'review receipt');
  const approval=await owner.post('/api/monthly/approve',{candidateId:candidate.id,candidateHash:candidate.hash,confirmReviewed:true});equal(approval.status,409,'unverified evidence approval blocked');if(!approval.data.gaps.some(x=>x.includes('Evidence bytes')))throw new Error('missing explicit evidence blocker');
  content.report='Changed result';content.claims[0].text='Changed result';
  const changed=await owner.post('/api/monthly',{period:'2030-04',content});equal(changed.status,201,'new version');candidateIds.push(changed.data.candidate.id);
  equal((await finance.post('/api/monthly/review',receipt)).status,409,'old candidate denial');
  equal((await owner.post('/api/monthly/approve',{candidateId:candidate.id,candidateHash:candidate.hash,confirmReviewed:true})).status,409,'stale approval denial');
  await db.monthlyPrincipal.update({where:{id:reviewer.id},data:{revokedAt:new Date()}});
  equal((await finance.call(`/api/monthly/review?candidateId=${candidate.id}`)).status,401,'revoked session denial');
  equal((await anonymous.call('/api/media?grant=invalid')).status,401,'direct media denial');
  console.log('Synthetic monthly API checks passed: owner, assigned and unrelated reviewers, anonymous access, tampering, evidence gate, version change and revocation.');
} finally {
  if(candidateIds.length){await db.monthlyReviewReceipt.deleteMany({where:{candidateId:{in:candidateIds}}});await db.monthlyReviewAssignment.deleteMany({where:{candidateId:{in:candidateIds}}});await db.monthlyApproval.deleteMany({where:{candidateId:{in:candidateIds}}});await db.monthlyCandidate.deleteMany({where:{id:{in:candidateIds}}});}
  if(investor)await db.monthlyRoomMembership.deleteMany({where:{principalId:investor.id}});
  for(const p of [reviewer,unrelated,investor])if(p)await db.monthlyPrincipal.delete({where:{id:p.id}});
  if(room)await db.dataroom.delete({where:{id:room.id}});
  await db.$disconnect();
}
