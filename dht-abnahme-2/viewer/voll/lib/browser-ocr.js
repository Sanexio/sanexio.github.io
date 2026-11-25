import {enabled,checked} from '../../avatar/local-source.js';

export async function mountBrowserOCR() {
  if(!await enabled(14))return {clear(){}};
  const panel=document.getElementById('panel-ocr'),boundary=panel.querySelector('p');
  boundary.textContent='Bild-OCR läuft vollständig lokal auf diesem Gerät. Erkennung kann sich verlesen. Kein erkannter Wert gilt vor Ihrer Einzelbestätigung als übernommen; Original und Vorschlag bitte vergleichen. Keine automatische Laborübernahme.';
  const host=document.createElement('div');host.id='browser-ocr';panel.append(host);
  const label=document.createElement('label');label.textContent='Lokales Bild (PNG/JPEG, höchstens 10 MB) ';const file=document.createElement('input');file.id='ocr-image';file.type='file';file.accept='image/png,image/jpeg';label.append(file);host.append(label);
  const run=document.createElement('button');run.id='ocr-recognize';run.textContent='Bild auf diesem Gerät erkennen';run.type='button';host.append(run);
  const clear=document.createElement('button');clear.id='ocr-clear';clear.textContent='Ergebnis verwerfen';clear.type='button';host.append(clear);
  const status=document.createElement('p');status.id='ocr-status';status.setAttribute('role','status');host.append(status);
  const preview=document.createElement('canvas');preview.id='ocr-preview';preview.style.cssText='max-width:100%;height:auto';preview.hidden=true;host.append(preview);
  const raw=document.createElement('pre');raw.id='ocr-raw';raw.style.whiteSpace='pre-wrap';host.append(raw);
  const candidates=document.createElement('div');candidates.id='ocr-candidates';host.append(candidates);
  const accepted=document.createElement('pre');accepted.id='ocr-confirmed';host.append(accepted);
  const credit=document.createElement('p');credit.textContent='Tesseract.js 6.0.1 · Tesseract.js-core 6.1.2 · deutsche tessdata_best-Erkennungsdaten · Apache 2.0. Laufzeit, Sprachdaten und Lizenztexte liegen lokal im Paket. Fundstellen: github.com/naptha/tesseract.js (LICENSE.md); github.com/naptha/tesseract.js-core (LICENSE); github.com/tesseract-ocr/tessdata_best (LICENSE). Abruf und Lizenzlesung 14.11.2026. Keine Dokumente oder Bilder gespeichert.';host.append(credit);
  const base=new URL('../ocr/',import.meta.url),sources=await (await fetch(new URL('sources.json',base))).json();
  let generation=0,worker=null,confirmed=[],scriptPromise;
  function discard(){generation++;worker?.terminate();worker=null;confirmed=[];raw.textContent='';candidates.replaceChildren();accepted.textContent='';preview.hidden=true;file.value='';run.disabled=false;status.textContent='Ergebnis verworfen; keine Werte übernommen.';}
  clear.addEventListener('click',discard);file.addEventListener('change',()=>{generation++;worker?.terminate();worker=null;confirmed=[];raw.textContent='';candidates.replaceChildren();accepted.textContent='';preview.hidden=true;run.disabled=false;status.textContent='Bild gewählt; noch keine Werte übernommen.';});
  function showCandidates(text){
    const rows=text.split(/\n+/).map(line=>line.match(/^\s*([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß0-9 _-]*?)\s*[:=]\s*([-+]?\d+(?:[.,]\d+)?)\s*(\S*)\s*$/)).filter(Boolean);
    candidates.replaceChildren();confirmed=[];accepted.textContent='Keine Werte bestätigt.';
    rows.forEach((match,index)=>{
      const row=document.createElement('fieldset');row.dataset.candidate=index;const legend=document.createElement('legend');legend.textContent=`Vorschlag ${index+1} — noch nicht übernommen`;row.append(legend);
      const inputs=[];
      for(const [key,name,value] of [['marker','Feld',match[1]],['wert','Wert',match[2]],['einheit','Einheit',match[3]]]){const l=document.createElement('label');l.textContent=name+' ';const input=document.createElement('input');input.dataset.field=key;input.value=value;input.autocomplete='off';l.append(input);row.append(l);inputs.push(input);}
      const button=document.createElement('button');button.type='button';button.dataset.confirm=index;button.textContent='Diesen Wert einzeln bestätigen';
      button.addEventListener('click',()=>{
        const marker=inputs[0].value.trim(),numberText=inputs[1].value.trim(),wert=Number(numberText.replace(',','.'));
        if(!marker||!/^[-+]?\d+(?:[.,]\d+)?$/.test(numberText)||!Number.isFinite(wert)){legend.textContent='Feld und endlicher Zahlenwert erforderlich; nichts übernommen.';return;}
        confirmed.push({marker,wert,einheit:inputs[2].value.trim(),einzeln_bestaetigt:true});
        button.disabled=true;inputs.forEach(i=>i.disabled=true);legend.textContent=`Vorschlag ${index+1} einzeln bestätigt — nur in diesem Import`;accepted.textContent=JSON.stringify(confirmed,null,2);
        status.textContent=`Bild lokal erkannt · ${rows.length} prüfbare Vorschläge · ${confirmed.length} einzeln bestätigt. Keine automatische Laborübernahme.`;
      });row.append(button);candidates.append(row);
    });
    status.textContent=`Bild lokal erkannt · ${rows.length} prüfbare Vorschläge · 0 bestätigt. Nicht erkannte Zeilen stehen im Rohtext; bitte nichts daraus ableiten.`;
  }
  run.addEventListener('click',async()=>{
    const input=file.files[0];if(!input){status.textContent='Bitte ein lokales Bild wählen.';return;}
    if(!['image/png','image/jpeg'].includes(input.type)||input.size>10000000){status.textContent='Nur PNG/JPEG bis 10 MB; nichts übernommen.';return;}
    const job=++generation;run.disabled=true;confirmed=[];candidates.replaceChildren();raw.textContent='';accepted.textContent='Keine Werte bestätigt.';status.textContent='Lokale Erkennung wird vorbereitet …';
    let activeWorker,deadline;
    try{
      const bitmap=await createImageBitmap(input);if(bitmap.width*bitmap.height>16000000){bitmap.close();throw Error('Bild hat mehr als 16 Millionen Pixel');}
      preview.width=bitmap.width;preview.height=bitmap.height;preview.getContext('2d').drawImage(bitmap,0,0);bitmap.close();preview.hidden=false;
      // Verify all shipped executable and language bytes before starting the worker.
      for(const s of sources.files)await checked(new URL(s.file,base),s.sha256);
      if(job!==generation)return;
      if(!scriptPromise)scriptPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL('tesseract.min.js',base);s.onload=resolve;s.onerror=()=>reject(Error('Lokale OCR-Laufzeit fehlt'));document.head.append(s);});
      await scriptPromise;if(job!==generation)return;
      const task=(async()=>{
        activeWorker=await window.Tesseract.createWorker('deu',1,{workerPath:new URL('worker.min.js',base).href,corePath:new URL('tesseract-core-lstm.wasm.js',base).href,langPath:base.href,gzip:false,cacheMethod:'none',workerBlobURL:false,logger:m=>{if(job===generation&&m.status)status.textContent=`Lokale Erkennung: ${m.status} ${Math.round((m.progress||0)*100)} %`;}});
        if(job!==generation){await activeWorker.terminate();return;}
        worker=activeWorker;await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});return await worker.recognize(preview);
      })();
      const result=await Promise.race([task,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Zeitgrenze der lokalen Erkennung erreicht')),90000);})]);
      if(job!==generation)return;
      raw.textContent=result.data.text;showCandidates(result.data.text);host.dataset.recognized='true';
    }catch(e){if(job===generation){generation++;run.disabled=false;status.textContent=`Erkennung nicht verfügbar: ${e.message}. Keine Werte übernommen.`;}}
    finally{clearTimeout(deadline);await activeWorker?.terminate();if(worker===activeWorker)worker=null;if(job===generation)run.disabled=false;}
  });
  window.addEventListener('pagehide',()=>worker?.terminate());
  return {clear:discard};
}
