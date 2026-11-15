/** Synthetischer Dreikompartimentrechner; keine klinische Parameterfreigabe. */
export function simulateCaffeine({dose_mg=100,hours=12,dt_h=0.25,events=[]}={}) {
  if(!Number.isFinite(dose_mg)||dose_mg<0||!Number.isFinite(hours)||hours<=0||hours>48||!Number.isFinite(dt_h)||dt_h<=0||dt_h>1||hours/dt_h>10000) throw Error('Ungültige Simulationsparameter.');
  if(!Array.isArray(events)||events.length>1000||events.some(e=>!['eingang','entnahme'].includes(e.typ)||!Number.isFinite(e.t_h)||e.t_h<0||e.t_h>hours||!Number.isFinite(e.modellmenge)||e.modellmenge<0)) throw Error('Ungültiges Ereignis.');
  const sorted=events.map((e,i)=>({...e,i})).sort((a,b)=>a.t_h-b.t_h||a.i-b.i);
  let blood=dose_mg,liver=0,rest=0,t=0,ei=0;
  function advance(to) {const h=to-t;if(h<=0)return;const before=blood;blood*=Math.exp(-0.5*h);liver=liver*Math.exp(-0.075*h)+0.21*before*(Math.exp(-0.075*h)-Math.exp(-0.5*h))/0.425;rest+=0.14*before*(1-Math.exp(-0.5*h))/0.5;t=to;}
  function event(e){if(e.typ==='eingang')blood+=e.modellmenge;else {if(e.modellmenge>blood+1e-9)throw Error('Entnahme übersteigt verfügbare Modellmenge.');blood=Math.max(0,blood-e.modellmenge);}}
  const points=[];
  for(let i=0;i<=Math.ceil(hours/dt_h);i++) {
    const target=Math.min(i*dt_h,hours);
    while(ei<sorted.length&&sorted[ei].t_h<=target+1e-10){advance(sorted[ei].t_h);event(sorted[ei++]);}
    advance(target);points.push({t_h:Number(target.toFixed(6)),blut_mg:blood,leber_mg:liver,rest_mg:rest});
  }
  return points;
}
