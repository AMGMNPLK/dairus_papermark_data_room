#!/usr/bin/env python3
"""Private synthetic proposal only. No production Papermark integration or mail."""
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from http.cookies import SimpleCookie
from urllib.parse import urlparse, unquote
import argparse, datetime, hashlib, json, os, secrets, sqlite3, uuid

os.umask(0o077)
BASE=Path(__file__).resolve().parent
DATABASE=BASE/'data/fixture.sqlite3'
PRINCIPALS={
 'investor-a':{'name':'Investor A (synthetic)','roomId':'room-a','role':'investor','password':'fixture-a-only'},
 'investor-b':{'name':'Investor B (synthetic)','roomId':'room-b','role':'investor','password':'fixture-b-only'},
 'reviewer':{'name':'Founder reviewer (synthetic)','roomId':None,'role':'reviewer','password':'fixture-review-only'},
}
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def encode(v):return json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':'))
def sha(v):return hashlib.sha256(v.encode() if isinstance(v,str) else v).hexdigest()
def connect():
 c=sqlite3.connect(DATABASE,timeout=10);c.row_factory=sqlite3.Row;c.execute('PRAGMA foreign_keys=ON');return c

def pdf(text):
 escaped=text.replace('\\','\\\\').replace('(','\\(').replace(')','\\)')
 stream=('BT /F1 18 Tf 54 730 Td ('+escaped+') Tj 0 -34 Td /F1 12 Tf (SYNTHETIC TEST ONLY - NOT COMPANY EVIDENCE) Tj ET').encode()
 objects=[b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',b'<< /Length '+str(len(stream)).encode()+b' >>\nstream\n'+stream+b'\nendstream']
 output=b'%PDF-1.4\n';offsets=[0]
 for i,obj in enumerate(objects,1):offsets.append(len(output));output+=str(i).encode()+b' 0 obj\n'+obj+b'\nendobj\n'
 start=len(output);output+=b'xref\n0 6\n0000000000 65535 f \n'+b''.join(f'{offset:010} 00000 n \n'.encode() for offset in offsets[1:])
 return output+f'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n'.encode()

def approval_basis(row):
 return sha(encode({k:row[k] for k in ['artifact_id','version','content_sha','evidence_sha','audience','visibility']}))
def initialize():
 DATABASE.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
 with connect() as c:
  c.executescript('CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,principal TEXT NOT NULL,created_at TEXT NOT NULL);CREATE TABLE IF NOT EXISTS versions(id TEXT PRIMARY KEY,artifact_id TEXT NOT NULL,room_id TEXT NOT NULL,kind TEXT NOT NULL,version INTEGER NOT NULL,body TEXT NOT NULL,content_sha TEXT NOT NULL,evidence_sha TEXT NOT NULL,audience TEXT NOT NULL,visibility TEXT NOT NULL,approval_sha TEXT,created_at TEXT NOT NULL,UNIQUE(artifact_id,version));CREATE TABLE IF NOT EXISTS publications(artifact_id TEXT PRIMARY KEY,version_id TEXT NOT NULL REFERENCES versions(id));CREATE TABLE IF NOT EXISTS questions(id TEXT PRIMARY KEY,principal TEXT NOT NULL,room_id TEXT NOT NULL,client_request_id TEXT NOT NULL,payload_sha TEXT NOT NULL,text TEXT NOT NULL,context_type TEXT NOT NULL,context_id TEXT,context_version TEXT,status TEXT NOT NULL,owner TEXT NOT NULL,next_action TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(principal,client_request_id));')
  if c.execute('SELECT COUNT(*) FROM versions').fetchone()[0]:return
  for suffix in ['a','b']:
   room='room-'+suffix;principal='investor-'+suffix
   document={'title':f'Synthetic acceptance checklist {suffix.upper()}','purpose':'Test evidence for the fictional acceptance milestone.','date':'2026-10-08','downloadAllowed':False,'scope':f'Investor {suffix.upper()} only (synthetic)','file':'test-document-'+suffix+'.pdf'}
   document_bytes=pdf(document['title']);(BASE/'data'/document['file']).write_bytes(document_bytes);document['fileSha256']=sha(document_bytes)
   update={'title':'September test edition','period':'September 2026 (synthetic)','publishedAt':'2026-10-09','dataAsOf':'2026-10-08','summary':'A fictional pilot handover is accepted. Paid terms are still pending. No revenue amount or payment date is verified.','founderNote':'This is a private test of a clearer investor experience. Every outcome and document here is synthetic.','sections':[
    {'title':'Delivered','items':['Synthetic pilot handover accepted using a test checklist.','Synthetic billing workflow passed a fictional end-to-end check.','Synthetic support handover documented for the next checkpoint.']},
    {'title':'In progress','items':['Agree paid terms after the fictional pilot acceptance. Owner: commercial lead (synthetic).']},
    {'title':'Risks','items':['Payment is not verified; no revenue figure is shown. Owner: finance reviewer (synthetic).']},
    {'title':'Next steps','items':['Review the missing commercial terms. The next checkpoint date is not confirmed.']},
    {'title':'Asks','items':['Tell the founder which investment question needs an answer first. No introduction or funding request is assumed.']}],
    'outcomes':[{'title':'Synthetic pilot handover accepted','why':'The fictional delivery has an explicit acceptance checkpoint.','state':'Test-verified','documentId':'document-'+suffix},{'title':'Synthetic billing workflow tested','why':'The fictional invoicing path can be checked before commercial terms are agreed.','state':'Founder-reported test','documentId':'document-'+suffix},{'title':'Synthetic support handover documented','why':'The fictional next step has an accountable owner.','state':'Test-verified','documentId':'document-'+suffix}],
    'milestone':{'title':'Agree paid terms','stage':'Pending (synthetic)','owner':'Commercial lead (synthetic)','dependency':'Accepted test pilot and reviewed commercial terms','checkpoint':'Date not confirmed'},
    'risk':{'text':'Revenue and receipt of payment are not verified.','owner':'Finance reviewer (synthetic)','nextAction':'Review source evidence before including any figure.'},
    'nextUpdate':'Date not confirmed'}
   historical={'title':'Historical test edition','period':'October 2023 (synthetic)','publishedAt':'2023-11-02','dataAsOf':'2023-10-31','summary':'Synthetic historical context. This does not establish current traction.','historical':True,'sections':[{'title':'Context','items':['This fictional older edition is separate from the latest test reporting period. No Gmail data is present.']}], 'founderNote':'Synthetic historical test only.'}
   investment={'id':'investment-'+suffix,'originalInstrument':'Synthetic instrument — example only','originalPurchaseAmount':None,'holdings':{'status':'Not verified','asOf':None,'provenance':'No holdings source is included in this test.'},'valuation':{'status':'Under review','amount':None,'provenance':'No current valuation evidence is included.'},'liquidity':{'status':'Received (synthetic)','nextAction':'Founder to clarify the request; no buyer, price or payment date is confirmed.'},'reviewLimits':'Company progress does not settle the investment value or liquidity request.'}
   for artifact_id,kind,body in [('document-'+suffix,'document',document),('update-'+suffix,'update',update),('history-'+suffix,'update',historical),('investment-'+suffix,'investment',investment)]:
    row={'id':artifact_id+'-v1','artifact_id':artifact_id,'room_id':room,'kind':kind,'version':1,'body':encode(body),'content_sha':sha(document_bytes) if kind=='document' else sha(encode(body)),'evidence_sha':sha('synthetic-evidence-'+artifact_id),'audience':encode([principal]),'visibility':encode({'preview':True,'download':False,'notification':False}),'created_at':now()}
    row['approval_sha']=approval_basis(row)
    c.execute('INSERT INTO versions('+','.join(row)+') VALUES('+','.join('?' for _ in row)+')',list(row.values()))
    c.execute('INSERT INTO publications VALUES(?,?)',(artifact_id,row['id']))
 DATABASE.chmod(0o600)

class Error(Exception):
 def __init__(self,code,message):self.code=code;self.message=message
class Handler(BaseHTTPRequestHandler):
 server_version='PrivateFixture/1'
 def log_message(self,*args):pass
 def output(self,code,value,content_type='application/json',extra=None):
  raw=encode(value).encode() if content_type=='application/json' else value
  self.send_response(code)
  for key,value in {'Content-Type':content_type,'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow, noarchive','X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",**(extra or {})}.items():self.send_header(key,value)
  self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
 def body(self):
  try:length=int(self.headers.get('Content-Length','0'))
  except ValueError:raise Error(400,'Invalid request length')
  if length<1 or length>16384:raise Error(413,'Request exceeds the private test bound')
  if self.headers.get('Origin') not in [f'http://127.0.0.1:{self.server.server_port}',f'http://localhost:{self.server.server_port}']:raise Error(403,'Request origin denied')
  try:body=json.loads(self.rfile.read(length))
  except (ValueError,UnicodeError):raise Error(400,'Invalid JSON')
  if not isinstance(body,dict):raise Error(400,'Use a JSON object')
  return body
 def principal(self):
  cookie=SimpleCookie();cookie.load(self.headers.get('Cookie',''));token=cookie.get('fixture_session')
  with connect() as c:row=c.execute('SELECT principal,created_at FROM sessions WHERE token=?',(token.value if token else '',)).fetchone()
  if not row:raise Error(401,'Synthetic login required')
  if datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(row['created_at'])>datetime.timedelta(hours=4):raise Error(401,'Synthetic session expired')
  return row['principal'],PRINCIPALS[row['principal']]
 def room(self,room_id):
  principal,identity=self.principal()
  if identity['role']!='investor' or identity['roomId']!=room_id:raise Error(404,'Room unavailable')
  return principal,identity
 def version(self,artifact_id,principal,version_id=None,kind=None):
  with connect() as c:
   row=c.execute('SELECT v.* FROM versions v JOIN publications p ON p.version_id=v.id WHERE v.artifact_id=?',(artifact_id,)).fetchone() if version_id is None else c.execute('SELECT * FROM versions WHERE artifact_id=? AND id=?',(artifact_id,version_id)).fetchone()
  if not row or principal not in json.loads(row['audience']) or (kind and row['kind']!=kind):raise Error(404,'Artifact unavailable')
  if not row['approval_sha'] or row['approval_sha']!=approval_basis(row):raise Error(403,'Test version awaiting exact approval')
  return row
 def view(self,row):
  return {'id':row['artifact_id'],'versionId':row['id'],'version':row['version'],'contentSha256':row['content_sha'],'evidenceSha256':row['evidence_sha'],'scope':json.loads(row['audience']),'visibility':json.loads(row['visibility']),'approvalState':'Test approved exact snapshot','body':json.loads(row['body'])}
 def questions(self,room_id,principal):
  with connect() as c:rows=c.execute('SELECT * FROM questions WHERE room_id=? AND principal=? ORDER BY created_at DESC,id',(room_id,principal)).fetchall()
  return [self.question(row) for row in rows]
 def question(self,row):return {k:row[k] for k in ['id','text','context_type','context_id','context_version','status','owner','next_action','created_at']}
 def handle_request(self,method):
  parts=[unquote(p) for p in urlparse(self.path).path.split('/') if p]
  if method=='GET' and not parts:return self.output(200,(BASE/'assets/index.html').read_bytes(),'text/html; charset=utf-8')
  if method=='GET' and len(parts)==2 and parts[0]=='assets' and parts[1] in ['app.js','styles.css']:
   return self.output(200,(BASE/'assets'/parts[1]).read_bytes(),'text/javascript; charset=utf-8' if parts[1].endswith('.js') else 'text/css; charset=utf-8')
  if parts==['api','login'] and method=='POST':
   data=self.body();principal=data.get('principal');identity=PRINCIPALS.get(principal)
   if set(data)!={'principal','password'} or not identity or not secrets.compare_digest(str(data.get('password','')),identity['password']):raise Error(401,'Invalid synthetic fixture login')
   token=secrets.token_urlsafe(32)
   with connect() as c:c.execute('INSERT INTO sessions VALUES(?,?,?)',(token,principal,now()))
   return self.output(200,{'principal':principal,**{k:v for k,v in identity.items() if k!='password'}},extra={'Set-Cookie':f'fixture_session={token}; HttpOnly; SameSite=Strict; Path=/'})
  if parts==['api','logout'] and method=='POST':
   self.body();self.principal();cookie=SimpleCookie();cookie.load(self.headers.get('Cookie',''));token=cookie.get('fixture_session')
   with connect() as c:c.execute('DELETE FROM sessions WHERE token=?',(token.value if token else '',))
   return self.output(200,{'loggedOut':True},extra={'Set-Cookie':'fixture_session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/'})
  if parts==['api','session'] and method=='GET':
   principal,identity=self.principal();return self.output(200,{'principal':principal,**{k:v for k,v in identity.items() if k!='password'}})
  if parts[:2]==['api','review']:
   principal,identity=self.principal()
   if identity['role']!='reviewer':raise Error(403,'Founder fixture review only')
   if method=='GET' and len(parts)==2:
    with connect() as c:rows=c.execute('SELECT v.*,p.version_id FROM versions v LEFT JOIN publications p ON p.artifact_id=v.artifact_id ORDER BY artifact_id,version DESC').fetchall()
    return self.output(200,{'testOnly':True,'versions':[{'id':r['id'],'artifactId':r['artifact_id'],'version':r['version'],'kind':r['kind'],'roomId':r['room_id'],'contentSha256':r['content_sha'],'evidenceSha256':r['evidence_sha'],'audience':json.loads(r['audience']),'approvalState':'Test approved snapshot' if r['approval_sha']==approval_basis(r) else 'Pending review','publishedVersionId':r['version_id'],'isPublished':r['version_id']==r['id']} for r in rows]})
   if method=='POST' and len(parts)==3 and parts[2]=='change':
    data=self.body()
    if set(data)!={'artifactId','change'} or data['change'] not in ['content','evidence','audience','visibility']:raise Error(400,'Choose a bounded synthetic change')
    with connect() as c:
     c.execute('BEGIN IMMEDIATE')
     old=c.execute('SELECT * FROM versions WHERE artifact_id=? ORDER BY version DESC LIMIT 1',(data['artifactId'],)).fetchone()
     if not old:raise Error(404,'Test artifact unavailable')
     new=dict(old);new.update(id=str(uuid.uuid4()),version=old['version']+1,approval_sha=None,created_at=now())
     if data['change']=='content':
      body=json.loads(old['body']);body['testDraftChange']='Synthetic changed content, not approved';new['body']=encode(body);new['content_sha']=sha(new['body'])
     if data['change']=='evidence':new['evidence_sha']=sha('changed-test-evidence-'+new['id'])
     if data['change']=='audience':new['audience']=encode(['investor-b'] if 'investor-a' in json.loads(old['audience']) else ['investor-a'])
     if data['change']=='visibility':new['visibility']=encode({'preview':True,'download':True,'notification':False})
     c.execute('INSERT INTO versions('+','.join(new)+') VALUES('+','.join('?' for _ in new)+')',list(new.values()))
    return self.output(201,{'candidateVersionId':new['id'],'approvalState':'Pending review','publicationChanged':False,'emailSent':False})
   raise Error(403,'Approval, publication and sending are unavailable in this fixture')
  if len(parts)<4 or parts[:2]!=['api','rooms']:raise Error(404,'Route unavailable')
  room_id=parts[2];principal,identity=self.room(room_id);resource=parts[3];suffix=room_id[-1]
  if method=='GET' and len(parts)==4:
   if resource=='overview':return self.output(200,self.view(self.version('update-'+suffix,principal,kind='update')))
   if resource in ['updates','documents']:
    with connect() as c:rows=c.execute('SELECT v.* FROM versions v JOIN publications p ON p.version_id=v.id WHERE v.room_id=? AND kind=? ORDER BY artifact_id',(room_id,'update' if resource=='updates' else 'document')).fetchall()
    return self.output(200,{'items':[self.view(self.version(r['artifact_id'],principal)) for r in rows]})
   if resource=='questions':return self.output(200,{'items':self.questions(room_id,principal)})
   if resource=='investment':return self.output(200,self.view(self.version('investment-'+suffix,principal,kind='investment')))
  if method=='GET' and resource in ['updates','investment'] and len(parts)==5:
   row=self.version(parts[4],principal,kind='update' if resource=='updates' else 'investment')
   if row['room_id']!=room_id:raise Error(404,'Artifact unavailable')
   return self.output(200,self.view(row))
  if method=='GET' and resource=='documents' and len(parts) in [7,8] and parts[5]=='versions':
   row=self.version(parts[4],principal,parts[6],kind='document')
   if row['room_id']!=room_id:raise Error(404,'Document unavailable')
   if len(parts)==7:return self.output(200,self.view(row))
   if parts[7] not in ['preview','download']:raise Error(404,'Document route unavailable')
   if parts[7]=='download' and not json.loads(row['visibility'])['download']:raise Error(403,'Download not permitted for this exact version')
   doc=json.loads(row['body']);file=BASE/'data'/doc['file'];content=file.read_bytes()
   if sha(content)!=row['content_sha']:raise Error(409,'Test document integrity mismatch')
   return self.output(200,content,'application/pdf',{'Content-Disposition':'inline; filename="synthetic-checklist.pdf"' if parts[7]=='preview' else 'attachment; filename="synthetic-checklist.pdf"'})
  if method=='GET' and resource=='questions' and len(parts)==5:
   with connect() as c:row=c.execute('SELECT * FROM questions WHERE id=? AND room_id=? AND principal=?',(parts[4],room_id,principal)).fetchone()
   if not row:raise Error(404,'Question unavailable')
   return self.output(200,self.question(row))
  if method=='POST' and resource in ['questions','contact'] and len(parts)==4:
   data=self.body();allowed={'text','contextType','contextId','contextVersion','clientRequestId'}
   if set(data)!=allowed or not isinstance(data['text'],str) or not data['text'].strip() or len(data['text'])>2000:raise Error(400,'Use a question of 1–2,000 characters')
   try:uuid.UUID(data['clientRequestId'])
   except (ValueError,TypeError):raise Error(400,'Invalid request identifier')
   if data['contextType'] not in ['update','document','general','contact']:raise Error(400,'Unsupported question context')
   if data['contextType'] in ['update','document']:
    version=self.version(data['contextId'],principal,data['contextVersion'],kind=data['contextType'])
    if version['room_id']!=room_id:raise Error(404,'Context unavailable')
   elif data['contextId'] is not None or data['contextVersion'] is not None:raise Error(400,'Unexpected context identifier')
   payload_hash=sha(encode({k:v for k,v in data.items() if k!='clientRequestId'}))
   with connect() as c:
    c.execute('BEGIN IMMEDIATE')
    old=c.execute('SELECT * FROM questions WHERE principal=? AND client_request_id=?',(principal,data['clientRequestId'])).fetchone()
    if old:
     if old['payload_sha']!=payload_hash:raise Error(409,'Request identifier already belongs to different text')
     return self.output(200,{'saved':True,'duplicateRetry':True,'question':self.question(old),'emailSent':False})
    qid=str(uuid.uuid4());c.execute('INSERT INTO questions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',(qid,principal,room_id,data['clientRequestId'],payload_hash,data['text'],data['contextType'],data['contextId'],data['contextVersion'],'Received','Founder (synthetic)','Review question; no reply commitment date confirmed',now()))
    row=c.execute('SELECT * FROM questions WHERE id=?',(qid,)).fetchone()
   return self.output(201,{'saved':True,'duplicateRetry':False,'question':self.question(row),'emailSent':False})
  raise Error(403,'Replies, sharing, publication and sending are unavailable in this private test')
 def dispatch(self,method):
  try:self.handle_request(method)
  except Error as e:self.output(e.code,{'message':e.message})
  except Exception:self.output(503,{'message':'Private fixture temporarily unavailable'})
 def do_GET(self):self.dispatch('GET')
 def do_POST(self):self.dispatch('POST')
 def do_PUT(self):self.dispatch('PUT')
 def do_DELETE(self):self.dispatch('DELETE')

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=7936);args=parser.parse_args();initialize()
 server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
 print(json.dumps({'privateSyntheticPreview':True,'address':f'http://127.0.0.1:{args.port}','database':str(DATABASE),'productionChanges':False}),flush=True)
 try:server.serve_forever()
 except KeyboardInterrupt:pass
 finally:server.server_close()
