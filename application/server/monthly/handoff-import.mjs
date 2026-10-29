// AGPL-3.0-only. Import an unsigned preparation as an unsaved owner draft.
const validText = (v, max = 2000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const hash = v => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const instant = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const strings = (value, max = 1000) => Array.isArray(value) && value.length <= max && value.every(v => validText(v));

export function importMonthlyHandoff(raw, expectedPeriod) {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > 1024 * 1024) throw new Error('Handoff exceeds the size limit');
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('Handoff is not valid JSON'); }
  if (!data || data.schema !== 'monthly-preparation/v1' || data.state !== 'private_draft' || data.publication_enabled !== false || data.sending_enabled !== false || typeof data.synthetic !== 'boolean' || !hash(data.input_sha256)) throw new Error('Invalid or unsupported handoff');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(expectedPeriod) || data.period?.month !== expectedPeriod || !validText(data.period.timezone, 100) || !instant(data.period.start_inclusive) || !instant(data.period.end_exclusive)) throw new Error('Handoff period does not match the selected month');
  if (!data.coverage || !strings(data.coverage.issues) || !Array.isArray(data.claims) || data.claims.length > 500) throw new Error('Handoff is missing coverage or claims');
  const gaps = [...data.coverage.issues];
  gaps.push('Imported source coverage and evidence require independent verification');
  if (data.synthetic) gaps.push('Synthetic fixture; not live source coverage');
  const ids = new Set();
  const claims = data.claims.map(claim => {
    if (!claim || !validText(claim.id, 200) || ids.has(claim.id) || !validText(claim.text, 10000) || !['progress', 'risks', 'plans', 'asks'].includes(claim.section) || !strings(claim.record_refs) || !strings(claim.issues) || !Array.isArray(claim.review_scopes) || claim.review_scopes.some(x => !['finance', 'legal'].includes(x)) || new Set(claim.review_scopes).size !== claim.review_scopes.length || !Array.isArray(claim.evidence) || claim.evidence.length > 500) throw new Error('Invalid claim in handoff');
    ids.add(claim.id);
    for (const issue of claim.issues) gaps.push(`Claim ${claim.id}: ${issue}`);
    const accepted = [];
    for (const e of claim.evidence) {
      if (!e || typeof e !== 'object' || Array.isArray(e) || Object.keys(e).some(k => !['source', 'reference', 'date', 'sha256'].includes(k)) || Object.values(e).some(v => typeof v !== 'string' || v.length > 1000)) throw new Error('Invalid evidence reference');
      if (validText(e.source, 200) && validText(e.reference, 1000) && instant(e.date) && hash(e.sha256)) accepted.push(e);
      else gaps.push(`Claim ${claim.id}: evidence source, date or SHA-256 missing`);
    }
    return { id: claim.id, text: claim.text, review: claim.review_scopes, evidence: accepted,
      provenance: { section: claim.section, recordRefs: claim.record_refs, sourceEvidence: claim.evidence, issues: claim.issues } };
  });
  return { title: `Monthly update — ${expectedPeriod}`, report: claims.map(c => c.text).join('\n\n'), claims, files: [],
    audience: {roomId:'', investorIds:[]}, visibility: {allowDownload:false, expiresAt:'', notifications:false},
    gaps: [...new Set(gaps)], provenance: {schema:data.schema, period:data.period, inputSha256:data.input_sha256, synthetic:data.synthetic, coverage:data.coverage} };
}
