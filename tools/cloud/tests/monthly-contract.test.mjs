import test from 'node:test';
import assert from 'node:assert/strict';
import { approvalGaps, canonical, digest, validateCandidate } from '../../../application/server/monthly/contract.mjs';
const h='a'.repeat(64);
const sample=()=>({title:'Synthetic update',report:'Synthetic result',claims:[{id:'c1',text:'Synthetic result',review:['finance','legal'],evidence:[{source:'fixture',reference:'record-1',date:'2030-04-01T00:00:00Z',sha256:h}]}],files:[{versionId:'v1',sha256:h}],audience:{roomId:'room-1',investorIds:['investor-1']},visibility:{allowDownload:false,expiresAt:'2099-01-01T00:00:00Z',notifications:false},gaps:[]});
test('canonical JSON binds content regardless of object key order',()=>{
 assert.equal(canonical({b:1,a:{z:2,y:3}}),canonical({a:{y:3,z:2},b:1}));
 const c=sample(), hash=digest(c);
 for (const change of [x=>x.report+=' changed',x=>x.claims[0].evidence[0].sha256='b'.repeat(64),x=>x.files[0].versionId='v2',x=>x.audience.investorIds.push('investor-2'),x=>x.visibility.allowDownload=true,x=>x.visibility.expiresAt='2098-01-01T00:00:00Z']) { const changed=structuredClone(c);change(changed);assert.notEqual(digest(changed),hash); }
});
test('candidate refuses incomplete visibility, ambiguous dates and undigested evidence',()=>{
 const c=sample();assert.equal(validateCandidate('2030-04',c),null);
 for (const edit of [x=>x.visibility.notifications=true,x=>x.visibility.expiresAt='2030-04-01',x=>x.claims[0].evidence[0].date='2030-04-01',x=>x.claims[0].evidence[0].sha256='',x=>x.claims.push(x.claims[0])]) { const changed=structuredClone(c);edit(changed);assert.ok(validateCandidate('2030-04',changed)); }
});
test('each applicable specialty must approve the exact claim and later rejection wins',()=>{
 const c=sample(), claimHash=digest(c.claims[0]);
 const receipt=(scope,decision,date,hash=claimHash)=>({scope,decision,claimHash:hash,claimId:'c1',createdAt:date});
 const finance=receipt('finance','approved','2030-05-01T00:00:00Z'), legal=receipt('legal','approved','2030-05-01T00:00:00Z');
 assert.ok(approvalGaps(c,[]).length);assert.ok(approvalGaps(c,[finance]).length);assert.deepEqual(approvalGaps(c,[finance,legal]),['Evidence bytes and specialist scope assignment require independent verification before approval']);
 assert.ok(approvalGaps(c,[finance,legal,receipt('legal','rejected','2030-05-02T00:00:00Z')]).length);
 c.claims[0].text='Changed';assert.ok(approvalGaps(c,[finance,legal]).length);
});
test('empty claim evidence and audience remain explicit blockers',()=>{
 const c=sample();c.claims[0].evidence=[];c.audience.investorIds=[];assert.ok(approvalGaps(c,[]).some(x=>x.includes('lacks evidence')));assert.ok(approvalGaps(c,[]).some(x=>x.includes('audience')));
});
test('video requires all exact provenance hashes',()=>{
 const c=sample();c.video={sha256:h,scriptSha256:h,timelineSha256:h,captionsSha256:h};assert.ok(validateCandidate('2030-04',c));c.video.assetProvenanceSha256=h;assert.equal(validateCandidate('2030-04',c),null);const before=digest(c);c.video.assetProvenanceSha256='b'.repeat(64);assert.notEqual(digest(c),before);
});

test('free-form report cannot bypass claim review',()=>{ const c=sample(); c.report += '\n\nUnreviewed statement'; assert.ok(approvalGaps(c,[]).some(x=>x.includes('exactly'))); });

test('declared source gaps remain blockers even after receipts',()=>{ const c=sample(); c.gaps=['Finance query failed']; assert.ok(approvalGaps(c,[]).some(x=>x.includes('Source gaps'))); });
