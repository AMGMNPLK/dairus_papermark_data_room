import os
from pathlib import Path
import datetime,hashlib,http.cookiejar,json,urllib.request,urllib.error,uuid
BASE=Path(__file__).resolve().parents[1];ORIGIN=os.environ.get('INVESTOR_ROOM_URL','http://127.0.0.1:7936');checks=[]
def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def call(c,path,body=None,origin=ORIGIN,method=None):
 request=urllib.request.Request(ORIGIN+path,data=json.dumps(body).encode() if body is not None else None,headers={'Origin':origin,'Content-Type':'application/json'},method=method or ('POST' if body is not None else 'GET'))
 try:
  with c.open(request,timeout=10) as r:raw=r.read();return r.status,raw,r.headers
 except urllib.error.HTTPError as e:return e.code,e.read(),e.headers

def expect(label,c,path,code=200,body=None,origin=ORIGIN,method=None):
 status,raw,headers=call(c,path,body,origin,method);assert status==code,(label,status,raw[:100]);checks.append({'check':label,'passed':True,'status':status});return raw,headers
anon=client();a=client();b=client();review=client()
for path in ['/api/session','/api/rooms/room-a/overview','/api/rooms/room-a/documents','/api/rooms/room-a/documents/document-a/versions/document-a-v1/preview','/api/rooms/room-a/questions','/api/rooms/room-a/investment']:
 expect('Anonymous denied '+path,anon,path,401)
for c,p,password in [(a,'investor-a','fixture-a-only'),(b,'investor-b','fixture-b-only'),(review,'reviewer','fixture-review-only')]:
 raw,h=expect('Synthetic principal login '+p,c,'/api/login',body={'principal':p,'password':password});assert 'HttpOnly' in h['Set-Cookie'] and 'SameSite=Strict' in h['Set-Cookie']
raw,h=expect('Investor A overview approved v1',a,'/api/rooms/room-a/overview');overview=json.loads(raw);assert overview['versionId']=='update-a-v1' and overview['body']['milestone']['checkpoint']=='Date not confirmed' and len(overview['body']['outcomes'])==3
assert h['Cache-Control']=='private, no-store' and h['Vary']=='Cookie'
expect('Latest update exact version',a,'/api/rooms/room-a/updates/update-a')
expect('Historical edition separate from current',a,'/api/rooms/room-a/updates/history-a')
raw,_=expect('Exact synthetic document metadata',a,'/api/rooms/room-a/documents/document-a/versions/document-a-v1');doc=json.loads(raw)
raw,h=expect('Exact authorized PDF preview',a,'/api/rooms/room-a/documents/document-a/versions/document-a-v1/preview');assert raw.startswith(b'%PDF-') and hashlib.sha256(raw).hexdigest()==doc['contentSha256'] and h['Content-Type']=='application/pdf'
expect('Unapproved download denied',a,'/api/rooms/room-a/documents/document-a/versions/document-a-v1/download',403)
for path in ['/api/rooms/room-b/overview','/api/rooms/room-b/updates','/api/rooms/room-b/documents','/api/rooms/room-b/documents/document-b/versions/document-b-v1/preview','/api/rooms/room-b/questions','/api/rooms/room-b/investment','/api/rooms/room-a/updates/update-b','/api/rooms/room-a/investment/investment-b','/api/rooms/room-a/documents/document-b/versions/document-b-v1/preview']:
 expect('Cross-investor backing request denied '+path,a,path,404)
raw,_=expect('Investment unknowns remain explicit',a,'/api/rooms/room-a/investment');investment=json.loads(raw)['body'];assert investment['originalPurchaseAmount'] is None and investment['valuation']['amount'] is None and investment['holdings']['status']=='Not verified'
raw,_=expect('Initial own questions read',a,'/api/rooms/room-a/questions');before=len(json.loads(raw)['items'])
payload={'text':'SYNTHETIC: Please clarify the next investment review checkpoint.','contextType':'document','contextId':'document-a','contextVersion':'document-a-v1','clientRequestId':str(uuid.uuid4())}
raw,_=expect('Private question saved and context version pinned',a,'/api/rooms/room-a/questions',201,payload);saved=json.loads(raw);qid=saved['question']['id'];assert saved['saved'] and not saved['emailSent'] and saved['question']['status']=='Received'
raw,_=expect('Question retry idempotent',a,'/api/rooms/room-a/questions',200,payload);assert json.loads(raw)['question']['id']==qid and json.loads(raw)['duplicateRetry']
expect('Idempotency key cannot silently replace text',a,'/api/rooms/room-a/questions',409,{**payload,'text':'SYNTHETIC: Changed text for same request'})
raw,_=expect('Question count increases once',a,'/api/rooms/room-a/questions');assert len(json.loads(raw)['items'])==before+1
expect('Saved question readback',a,'/api/rooms/room-a/questions/'+qid)
expect('Other investor cannot guess saved question',b,'/api/rooms/room-b/questions/'+qid,404)
expect('Other investor cannot access question room',b,'/api/rooms/room-a/questions/'+qid,404)
expect('Foreign question context denied',a,'/api/rooms/room-a/questions',404,{**payload,'clientRequestId':str(uuid.uuid4()),'contextId':'document-b','contextVersion':'document-b-v1'})
expect('Cross-origin question denied',a,'/api/rooms/room-a/questions',403,{**payload,'clientRequestId':str(uuid.uuid4())},'https://unapproved.invalid')
for path in ['/api/rooms/room-a/questions/'+qid+'/reply','/api/rooms/room-a/send','/api/rooms/room-a/notifications','/api/rooms/room-a/share','/api/rooms/room-a/publish']:
 expect('Reply/send/publication path unavailable '+path,a,path,403,{})
expect('Investor cannot read founder review',a,'/api/review',403)
for change in ['content','evidence','audience','visibility']:
 raw,_=expect('Changed '+change+' creates pending candidate',review,'/api/review/change',201,{'artifactId':'update-a','change':change});result=json.loads(raw);assert result['approvalState']=='Pending review' and not result['publicationChanged'] and not result['emailSent']
 raw,_=expect('Original approved publication remains pinned after '+change,a,'/api/rooms/room-a/overview');assert json.loads(raw)['versionId']=='update-a-v1'
 expect('Candidate not reachable via document/version route',a,'/api/rooms/room-a/documents/update-a/versions/'+result['candidateVersionId']+'/preview',404)
for path in ['/api/review/approve','/api/review/publish','/api/review/send']:
 expect('Founder cannot approve/publish/send in fixture '+path,review,path,403,{})
raw,_=expect('Founder review lists private pending versions',review,'/api/review');rows=json.loads(raw)['versions'];assert any(r['approvalState']=='Pending review' and not r['isPublished'] for r in rows)
result={'atUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':True,'testOnly':True,'syntheticOnly':True,'productionChanges':False,'externalServices':False,'emailSent':False,'checks':checks,'savedQuestionId':qid,'database':str(BASE/'data/fixture.sqlite3'),'limitations':['Synthetic selectable test logins are not production investor authentication.','No real founder calendar link or reply publication is configured.','Production Papermark integration, migrations and content approvals remain separate.']}
(BASE/'checks/access-flow-receipt.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'passed':True,'checks':len(checks),'syntheticOnly':True,'savedQuestionReadback':True,'idempotentRetry':True,'crossInvestorRequestsDenied':True,'publicationUnchanged':True}))
