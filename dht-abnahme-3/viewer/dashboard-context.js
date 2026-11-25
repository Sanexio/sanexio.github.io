/** Explanations of view scale; no inferred anatomical or clinical bindings. */
const mounted=new WeakMap();
const descriptions={haut:'Haut: äußere Körperhülle. Diese Studienfigur zeigt keine individuelle Hautoberfläche.',muskel:'Muskeln ermöglichen Bewegung. Wählen Sie eine sichtbare Struktur oder suchen Sie nach ihrem Namen.',skelett:'Das Skelett stützt den Körper. Einzelne Knochen lassen sich auswählen und näher betrachten.',organ:'Organe übernehmen unterschiedliche Aufgaben. Die Auswahl öffnet belegte Strukturtexte und vorhandene Detailreferenzen.',binde:'Bänder verbinden Knochen; Sehnen übertragen Muskelkraft. Gezeigt wird der vorhandene Atlasbestand.',nerven:'Nerven leiten Signale. Die Farben unterscheiden zentrale und periphere Strukturen.',gefaesse:'Gefäße transportieren Blut. Rot kennzeichnet Arterien, Blau Venen im Referenzatlas.'};
const examples={haut:['Oberflächentemperatur','°C',[32.1,32.4,32.2,32.6,32.5,32.7]],muskel:['Kraft im Demonstrationsversuch','N',[31,34,33,36,35,38]],skelett:['Bewegungswinkel im Demonstrationsversuch','°',[92,95,94,98,99,101]],binde:['Dehnung im Demonstrationsversuch','mm',[2.1,2.4,2.3,2.6,2.5,2.7]],nerven:['Signallaufzeit im Demonstrationsversuch','ms',[4.1,4.0,4.2,4.1,4.0,4.1]],gefaesse:['Fluss im Demonstrationsversuch','ml/min',[60,62,61,64,63,65]]};
export function mountDashboardContext(app){
 const host=document.querySelector('#avatar-stage');if(!host||host.querySelector('#dashboard-context'))return;
 mounted.get(host)?.();const life=new AbortController();const eventOptions={signal:life.signal};
 const context=document.createElement('section');context.id='dashboard-context';context.setAttribute('aria-label','Strukturen und Zoom');
 const heading=document.createElement('h2');heading.textContent='Körper verstehen';
 const level=document.createElement('strong');level.id='dashboard-scale';level.textContent='Übersicht · Ganzer Körper';
 const text=document.createElement('p');text.id='dashboard-explanation';text.textContent=descriptions.haut;
 const hint=document.createElement('p');hint.className='dashboard-hint';hint.textContent='Drehen oder Verschieben wählen · Rad oder ＋/− zum Zoomen. Organ wählen für Gewebe, Zelle und Molekül, soweit belegt.';
 context.append(heading,level,text,hint);host.querySelector('.avatar-search')?.after(context);
 const sample=document.createElement('section');sample.id='dashboard-example-panel';sample.hidden=true;sample.setAttribute('aria-label','Beispielmessreihe der Ebene');host.append(sample);
 let selectedExplanation=null;
 function update(detail){
  if(!detail)return;const zoom=host.querySelector('#zoom-panel');const depth=Number(zoom?.dataset.level||0);
  const label=depth>1?['Körper','Organ','Gewebe','Zelle','Molekül'][depth]:detail.scope;
  const nextLevel=label+' · '+(depth>1?host.querySelector('#zoom-location')?.textContent:detail.title),nextText=depth>1?host.querySelector('#zoom-explanation')?.textContent:descriptions[detail.layer]||descriptions.haut;
  if(selectedExplanation && selectedExplanation.depth===depth){if(level.textContent!==selectedExplanation.name)level.textContent=selectedExplanation.name;if(text.textContent!==selectedExplanation.text)text.textContent=selectedExplanation.text;}else{if(level.textContent!==nextLevel)level.textContent=nextLevel;if(text.textContent!==nextText)text.textContent=nextText;}
  context.dataset.scope=label;
 }
 app.addEventListener('structure-explanation',event=>{const {name,text:explanation}=event.detail;const depth=Number(host.querySelector('#zoom-panel:not([hidden])')?.dataset.level||0);selectedExplanation=name?{name,text:explanation,depth}:null;if(name){level.textContent=name;text.textContent=explanation;}},eventOptions);
 let last={scope:'Übersicht',title:'Ganzer Körper',layer:'haut'};
 app.addEventListener('avatar-context',event=>{last=event.detail;update(last);},eventOptions);
 app.addEventListener('avatar-layer',event=>{last={...last,layer:event.detail.layer};selectedExplanation=null;sample.hidden=true;update(last);},eventOptions);
 const observer=new MutationObserver(()=>update(last));
 observer.observe(host,{subtree:true,childList:true,attributes:true,attributeFilter:['data-level','hidden']});
 app.addEventListener('dashboard-example',event=>{
  const {layer,id,name}=event.detail,spec=examples[layer];if(!spec)return;sample.replaceChildren();sample.hidden=false;
  const h=document.createElement('h2');h.textContent=name;
  const note=document.createElement('p');note.textContent='Synthetisches Beispiel · Messort nur zur Vorführung. Kein medizinisch validierter Bezug zur markierten Struktur.';
  const title=document.createElement('h3');title.textContent=spec[0];
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 300 100');svg.setAttribute('role','img');svg.setAttribute('aria-label','Sechs synthetische Beispielwerte');
  const values=spec[2],low=Math.min(...values),span=Math.max(...values)-low||1,coords=values.map((v,i)=>[12+i*55,85-(v-low)/span*65]);
  const line=document.createElementNS(svg.namespaceURI,'polyline');line.setAttribute('points',coords.map(p=>p.join(',')).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#167a79');line.setAttribute('stroke-width','3');svg.append(line);
  for(const [x,y]of coords){const point=document.createElementNS(svg.namespaceURI,'circle');point.setAttribute('cx',x);point.setAttribute('cy',y);point.setAttribute('r',4);point.setAttribute('fill','#167a79');svg.append(point);}
  const table=document.createElement('table'),caption=document.createElement('caption');caption.textContent='Beispielmessungen · '+spec[1];table.append(caption);
  values.forEach((v,i)=>{const row=table.insertRow();row.insertCell().textContent='Tag '+(i+1);row.insertCell().textContent=v.toLocaleString('de-DE')+' '+spec[1];});
  const close=document.createElement('button');close.type='button';close.textContent='Beispiel schließen';close.addEventListener('click',()=>{sample.hidden=true;host.querySelector(`[data-example-layer="${layer}"]`)?.focus({preventScroll:true});});
  sample.dataset.anchor=id;sample.append(h,note,title,svg,table,close);sample.scrollIntoView({block:'nearest'});
 },eventOptions);
 app.querySelector('.explore-tabs')?.addEventListener('click',()=>{sample.hidden=true;},eventOptions);
 mounted.set(host,()=>{life.abort();observer.disconnect();});
}
