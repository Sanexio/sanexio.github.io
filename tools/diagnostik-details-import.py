import json, yaml
from pathlib import Path
from urllib.parse import urljoin, urlparse
root=Path.home() / 'Cortex/projects/Sanexio-Tenant/trunk/content'
items=json.loads(Path('src/data/untersuchungen.json').read_text())
progs=json.loads(Path('src/data/laborprogramme.json').read_text())['programmes']
items += [{'id':p['praxis_slug'],'name':p['praxis_name'],'quelle':'pages/_shared/'+p['praxis_slug']+'.yaml'} for p in progs]
items += [{'id':'genetik-beratung','name':'Genetik-Beratung','quelle':'pages/_shared/labor-genetik-beratung.yaml'}]
out=[]
for item in items:
 path=root/item['quelle']; d=yaml.safe_load(path.read_text()) if path.exists() else {}
 practice=d.get('views', {}).get('practice', {})
 cta=practice.get('cta_url')
 if cta:
  cta=urljoin('https://westend-hausarzt.com/', cta)
  if urlparse(cta).scheme not in ('https', 'http'):
   raise ValueError('Ungültige CTA-URL: '+cta)
 sections=d.get('sections',[])
 hero=next((s for s in sections if s.get('type')=='hero'),{})
 bodies=[s['body_html']['de'] for s in sections if s.get('type')=='body' and s.get('body_html',{}).get('de')]
 out.append({'id':item['id'],'name':item['name'],'quelle':item['quelle'],'lead':hero.get('lead',{}).get('de',''),'body': '\n'.join(bodies),'source_available':path.exists(), 'cta_url':cta, 'cta_label':practice.get('cta_label', {}).get('de') if cta else None})
Path('src/data/diagnostik-details.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
