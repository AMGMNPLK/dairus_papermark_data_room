// AGPL-3.0-only. Canonical hashing binds all candidate fields, including any
// supplemental provenance fields, rather than trusting a client-supplied digest.
import { createHash } from 'node:crypto';
export function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype)
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  throw new Error('Invalid JSON value');
}
export const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const text = (x, max=2000) => typeof x === 'string' && x.trim().length > 0 && x.length <= max;
const instant = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(x) && Number.isFinite(Date.parse(x));
const hash = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
export function validateCandidate(period, c) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period || '')) return 'Invalid period';
  if (!c || typeof c !== 'object' || Array.isArray(c) || !text(c.title,200) || !text(c.report,100000) || !Array.isArray(c.claims) || c.claims.length > 500 || !Array.isArray(c.files) || c.files.length > 100 || !Array.isArray(c.gaps) || c.gaps.some(g => !text(g,2000))) return 'Invalid candidate';
  if (!c.audience || !text(c.audience.roomId,200) || !Array.isArray(c.audience.investorIds) || c.audience.investorIds.some(x => !text(x,200)) || new Set(c.audience.investorIds).size !== c.audience.investorIds.length || !c.visibility || typeof c.visibility.allowDownload !== 'boolean' || !instant(c.visibility.expiresAt) || c.visibility.notifications !== false) return 'Explicit audience, expiry, download and disabled notifications required';
  const ids = new Set();
  for (const claim of c.claims) {
    if (!claim || !text(claim.id,200) || ids.has(claim.id) || !text(claim.text,10000) || !Array.isArray(claim.review) || claim.review.some(x => !['finance','legal'].includes(x)) || new Set(claim.review).size !== claim.review.length || !Array.isArray(claim.evidence)) return 'Invalid claim';
    ids.add(claim.id);
    if (claim.evidence.some(e => !e || !text(e.source,200) || !text(e.reference,1000) || !instant(e.date) || !hash(e.sha256))) return 'Evidence requires source, date, reference and SHA-256';
  }
  if (c.files.some(f => !f || !text(f.versionId,200) || !hash(f.sha256)) || new Set(c.files.map(f=>f.versionId)).size !== c.files.length) return 'Invalid file versions';
  if (c.video && (!hash(c.video.sha256) || !hash(c.video.scriptSha256) || !hash(c.video.timelineSha256) || !hash(c.video.captionsSha256) || !hash(c.video.assetProvenanceSha256))) return 'Video requires exact asset, script, timeline, captions and provenance hashes';
  try { if (Buffer.byteLength(canonical(c)) > 1024*1024) return 'Candidate exceeds size limit'; } catch { return 'Invalid JSON'; }
  return null;
}
export function approvalGaps(candidate, receipts) {
  const gaps=[];
  if (!candidate.claims.length) gaps.push('No claims to review');
  if (candidate.gaps.length) gaps.push('Source gaps require resolution or an authenticated disposition');
  gaps.push('Evidence bytes and specialist scope assignment require independent verification before approval');
  if (candidate.report !== candidate.claims.map(c => c.text).join('\n\n')) gaps.push('Report must contain exactly the reviewed claim text in order');
  if (!candidate.audience.investorIds.length) gaps.push('No audience selected');
  if (Date.parse(candidate.visibility.expiresAt) <= Date.now()) gaps.push('Visibility has expired');
  for (const c of candidate.claims) {
    if (!c.evidence.length) gaps.push(`Claim ${c.id} lacks evidence`);
    for (const scope of c.review) {
      // Latest receipt for a claim/scope controls: a later rejection cannot be masked.
      const relevant=receipts.filter(r => r.claimId===c.id && r.scope===scope && r.claimHash===digest(c)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
      if (!relevant.length || relevant[0].decision !== 'approved') gaps.push(`Claim ${c.id} needs ${scope} review`);
    }
  }
  return gaps;
}
