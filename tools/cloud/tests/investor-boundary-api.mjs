// Synthetic local-only checks for the current closed investor boundary.
// This is not a test of an investor portal: no such serving route exists.
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { encode } from 'next-auth/jwt';
import { loadCloudEnvironment } from '../common.mjs';

loadCloudEnvironment({ seeding: true });
const { PrismaClient } = await import('@prisma/client');
const db = new PrismaClient();
const base = 'http://127.0.0.1:3000';
const suffix = randomUUID();
const teamId = process.env.PAPERMARK_TEAM_ID;
const password = `synthetic-${suffix}`;
const equal = (actual, expected, label) => {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
};
class Client {
  cookies = new Map();
  async call(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('origin', base);
    if (this.cookies.size) headers.set('cookie', [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '));
    const response = await fetch(base + path, { ...options, headers, redirect: 'manual' });
    for (const value of response.headers.getSetCookie()) {
      const [part] = value.split(';');
      const i = part.indexOf('=');
      if (i > 0) this.cookies.set(part.slice(0, i), part.slice(i + 1));
    }
    let data;
    try { data = await response.json(); } catch { data = null; }
    return { status: response.status, data };
  }
  async login(email) {
    const csrf = await this.call('/api/auth/csrf');
    equal(csrf.status, 200, 'csrf');
    const body = new URLSearchParams({ email, password, csrfToken: csrf.data.csrfToken, json: 'true' });
    await this.call('/api/auth/callback/monthly-principal', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
    const session = await this.call('/api/auth/session');
    if (!session.data?.user?.id) throw new Error('Synthetic investor login failed');
    return session.data.user.id;
  }
}

const principals = [], rooms = [];
try {
  const passwordHash = await bcrypt.hash(password, 10);
  for (const label of ['one', 'two']) {
    const p = await db.monthlyPrincipal.create({ data: { teamId, email: `investor-${label}-${suffix}@example.invalid`, passwordHash, role: 'investor', verifiedAt: new Date() } });
    principals.push(p);
    const room = await db.dataroom.create({ data: { teamId, name: `Synthetic ${label} ${suffix}`, pId: `dr_${label}_${suffix}`, enableChangeNotifications: false, allowBulkDownload: false, defaultPermissionStrategy: 'HIDDEN_BY_DEFAULT' } });
    rooms.push(room);
    await db.monthlyRoomMembership.create({ data: { teamId, roomId: room.id, principalId: p.id } });
  }
  const clients = [new Client(), new Client()];
  for (let i = 0; i < clients.length; i++) {
    equal(await clients[i].login(principals[i].email), `monthly:${principals[i].id}:0`, 'investor identity');
    equal((await clients[i].call('/api/monthly?period=2030-04')).status, 401, 'founder workspace denied');
    equal((await clients[i].call('/api/investor-updates')).status, 401, 'founder archive denied');
    equal((await clients[i].call('/api/preview?versionId=synthetic')).status, 401, 'founder file preview denied');
    for (const room of rooms) {
      equal((await clients[i].call(`/api/teams/${encodeURIComponent(teamId)}/datarooms/${encodeURIComponent(room.id)}`)).status, 401, 'own and other room API denied');
    }
    equal((await clients[i].call('/api/monthly/review?candidateId=synthetic')).status, 403, 'review packet denied');
    equal((await clients[i].call('/api/monthly/review/evidence?candidateId=synthetic&claimId=synthetic&index=0')).status, 403, 'review evidence denied');
  }
  // An owner-bound media grant is not a bearer grant for an investor session.
  const ownerGrant = jwt.sign({ ownerId: process.env.PAPERMARK_OWNER_ID, versionId: 'synthetic', page: 1 }, process.env.PAPERMARK_MEDIA_SECRET, { algorithm: 'HS256', expiresIn: 120, issuer: 'papermark-community', audience: 'media' });
  for (const client of clients) equal((await client.call(`/api/media?grant=${encodeURIComponent(ownerGrant)}`)).status, 401, 'owner media grant denied to investor');
  // Compare the same active principal with live and expired signed sessions.
  // The live session reaches role authorization (403); an expired one does not.
  const sessionSub = `monthly:${principals[0].id}:0`;
  const signed = new Client(), expired = new Client();
  signed.cookies.set('next-auth.session-token', await encode({ secret: process.env.NEXTAUTH_SECRET, token: { sub: sessionSub }, maxAge: 60 }));
  expired.cookies.set('next-auth.session-token', await encode({ secret: process.env.NEXTAUTH_SECRET, token: { sub: sessionSub }, maxAge: -60 }));
  equal((await signed.call('/api/monthly/review?candidateId=synthetic')).status, 403, 'live signed session reaches role authorization');
  equal((await expired.call('/api/monthly/review?candidateId=synthetic')).status, 401, 'expired session denied');
  // A live session is checked against the current principal on every reviewer request.
  await db.monthlyPrincipal.update({ where: { id: principals[0].id }, data: { sessionVersion: { increment: 1 } } });
  equal((await clients[0].call('/api/monthly/review?candidateId=synthetic')).status, 401, 'session version revocation');
  await db.monthlyPrincipal.update({ where: { id: principals[1].id }, data: { revokedAt: new Date() } });
  equal((await clients[1].call('/api/monthly/review?candidateId=synthetic')).status, 401, 'principal revocation');
  console.log('Synthetic investor boundary passed: two principals, founder/reviewer/room/media denial, session version, expiry and principal revocation. Investor serving remains unavailable.');
} finally {
  for (const p of principals) {
    await db.monthlyRoomMembership.deleteMany({ where: { principalId: p.id } });
    await db.monthlyPrincipal.delete({ where: { id: p.id } });
  }
  for (const room of rooms) await db.dataroom.delete({ where: { id: room.id } });
  await db.$disconnect();
}
