export function validateG6B(model) {
  const errors=[];
  if(!model || model.schema!=='g6b-minimal/1') errors.push('Schema g6b-minimal/1 erforderlich.');
  const compartments=Array.isArray(model?.kompartimente)?model.kompartimente:[];
  const flows=Array.isArray(model?.fluss)?model.fluss:[];
  if(!compartments.length || compartments.length>100) errors.push('1 bis 100 Kompartimente erforderlich.');
  if(!flows.length || flows.length>1000) errors.push('1 bis 1000 Flüsse erforderlich.');
  const ids=new Set();
  for(const c of compartments) {
    if(typeof c?.id!=='string'||! /^[a-zA-Z][\w-]{0,63}$/.test(c.id)||ids.has(c.id)) errors.push('Ungültige oder doppelte Kennung.');
    ids.add(c?.id);
    if(!Number.isFinite(c?.volumen_l)||c.volumen_l<=0) errors.push('Positives Volumen erforderlich.');
  }
  for(const f of flows) {
    if(!ids.has(f?.von)||!ids.has(f?.nach)||f.von===f.nach) errors.push('Unbekanntes oder identisches Flussziel.');
    if(!Number.isFinite(f?.rate_l_h)||f.rate_l_h<0||f.rate_l_h>100000) errors.push('Ungültige Rate.');
  }
  if(!Array.isArray(model?.quellen)||!model.quellen.length||model.quellen.some(s=>s!=='synthetisch-browser-demo')) errors.push('Quelle nicht im lokalen Quellenregister.');
  return {ok:errors.length===0,fehler:errors};
}
export function balanceFlow(model) {
  const v=validateG6B(model);if(!v.ok) throw Error(v.fehler.join(' '));
  const b=Object.fromEntries(model.kompartimente.map(c=>[c.id,0]));
  for(const f of model.fluss){b[f.von]-=f.rate_l_h;b[f.nach]+=f.rate_l_h;} return b;
}
/** Konservativer synthetischer Transport; keine physiologische Validierung. */
export function simulateG6B(model,{hours=1,initial=100}={}) {
  balanceFlow(model);if(!Number.isFinite(hours)||hours<=0||hours>24||!Number.isFinite(initial)||initial<0) throw Error('Ungültiger Modellparameter.');
  const amounts=Object.fromEntries(model.kompartimente.map((c,i)=>[c.id,i===0?initial:0]));
  const volumes=Object.fromEntries(model.kompartimente.map(c=>[c.id,c.volumen_l]));
  const rates=Object.fromEntries(model.kompartimente.map(c=>[c.id,model.fluss.filter(f=>f.von===c.id).reduce((s,f)=>s+f.rate_l_h,0)]));
  const points=[{t_h:0,...amounts}];
  for(let i=1;i<=100;i++) {
    const next={...amounts};
    for(const f of model.fluss){const sum=rates[f.von];const moved=sum?amounts[f.von]*(1-Math.exp(-sum/volumes[f.von]*hours/100))*f.rate_l_h/sum:0;next[f.von]-=moved;next[f.nach]+=moved;}
    Object.assign(amounts,next);points.push({t_h:i*hours/100,...amounts});
  }
  return points;
}
