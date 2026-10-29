import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importMonthlyHandoff } from '../../../application/server/monthly/handoff-import.mjs';
const example = () => ({schema:'monthly-preparation/v1', state:'private_draft', publication_enabled:false, sending_enabled:false, synthetic:true, input_sha256:'a'.repeat(64), period:{month:'2030-04',timezone:'Europe/Madrid',start_inclusive:'2030-04-01T00:00:00+02:00',end_exclusive:'2030-05-01T00:00:00+02:00'},coverage:{issues:['swarm:missing_read_export'],source_coverage_complete:false}, claims:[{id:'c1',text:'Synthetic outcome',section:'progress',record_refs:['clickup:fixture'],evidence:[{reference:'synthetic:1',sha256:'b'.repeat(64)}],review_scopes:['finance'],issues:['missing_evidence']}]});
const load = data => importMonthlyHandoff(JSON.stringify(data), '2030-04');
test('imports only an unsaved private draft with source lineage and gaps', () => {
  const result=load(example());
  assert.equal(result.report,'Synthetic outcome');
  assert.deepEqual(result.claims[0].provenance.recordRefs,['clickup:fixture']);
  assert.equal(result.claims[0].evidence.length,0);
  assert.equal(result.claims[0].provenance.sourceEvidence[0].reference,'synthetic:1');
  assert.ok(result.gaps.includes('swarm:missing_read_export'));
  assert.ok(result.gaps.some(x=>x.includes('evidence source, date or SHA-256 missing')));
  assert.deepEqual(result.audience.investorIds,[]);
  assert.equal(result.visibility.notifications,false);
});
test('rejects untrusted versions, mismatched periods, tampered status and malformed claims', () => {
  for (const update of [{schema:'monthly-preparation/v2'},{state:'approved'},{sending_enabled:true},{input_sha256:'x'}, {period:{month:'2030-05'}}]) assert.throws(()=>load({...example(),...update}));
  assert.throws(()=>importMonthlyHandoff('{','2030-04'));
  const duplicate=example(); duplicate.claims.push(duplicate.claims[0]); assert.throws(()=>load(duplicate));
});
test('preserves complete evidence without manufacturing review or audience', () => {
  const data=example(); data.claims[0].evidence=[{source:'fixture',reference:'synthetic:1',date:'2030-04-12T14:00:00+02:00',sha256:'b'.repeat(64)}];
  const result=load(data); assert.equal(result.claims[0].evidence.length,1);
  assert.ok(result.gaps.some(x=>x.includes('independent verification')));
  assert.equal(result.audience.roomId,''); assert.equal(result.visibility.expiresAt,'');
});
