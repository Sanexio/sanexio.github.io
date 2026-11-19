/** Shared optional-layer lifecycle for both glass figures. Failed tasks are retryable. */
export function layerLifecycle({host,progress,layerStatus,load,rollback}) {
  const loading=new Map(),promotions=new Map(),loaded=new Set();let pending=0,foreground=0;
  async function ensureLayer(value,{background=false}={}) {
    if(value==='haut')return;
    if(loading.has(value)){if(!background)promotions.get(value)?.();return loading.get(value);}
    let promoted=!background;
    const promote=()=>{if(promoted)return;promoted=true;foreground++;progress.hidden=false;progress.removeAttribute('value');layerStatus.textContent='Organe werden geladen …';};
    promotions.set(value,promote);
    const added=[];
    const task=(async()=>{pending++;host.dataset.loading='true';if(promoted){foreground++;progress.hidden=false;layerStatus.textContent=value==='organ'?'Organe werden geladen …':'Schicht wird geladen …';}
      try {await load(value,{background,added});loaded.add(value);if(value==='organ'&&promoted){host.dataset.organs='ready';delete host.dataset.organError;}}
      catch(error){if(value==='organ'){host.dataset.organs='error';host.dataset.organError=error.message;}rollback(added);throw error;}
      finally{pending--;host.dataset.loading=String(pending>0);if(promoted)foreground--;promotions.delete(value);progress.hidden=!foreground;}
    })();loading.set(value,task);try{await task;}catch(error){loading.delete(value);throw error;}
  }
  return {ensureLayer,loaded};
}

/** A painted, usable glass body always precedes optional organs. */
export function organsAfterPaint({host,signal,ensureLayer,refresh,isSkin,render,fade}) {
  let frame=0;host.dataset.organs='pending';
  requestAnimationFrame(()=>requestAnimationFrame(async()=>{
    if(signal?.aborted)return;
    performance.mark('dht-organs-start');host.dataset.organs='loading';
    try {
      await ensureLayer('organ',{background:true});if(signal?.aborted)return;
      if(isSkin())refresh();
      if(fade&&isSkin()&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
        const start=performance.now();await new Promise(resolve=>{const tick=now=>{
          if(signal?.aborted||!isSkin()){resolve();return;}
          const t=Math.min(1,(now-start)/360);fade(t);render();
          if(t<1)frame=requestAnimationFrame(tick);else resolve();
        };tick(start);});
      }
      host.dataset.organs='ready';delete host.dataset.organError;performance.mark('dht-organs-ready');
    }catch(error){if(signal?.aborted)return;host.dataset.organs='error';host.dataset.organError=error.message;if(isSkin())refresh();}
  }));
  return ()=>cancelAnimationFrame(frame);
}

export function surfaceSelection(material,baseColor,{selected=false,muted=false,opacity=1}={}) {
  material.color.copy(baseColor);material.emissive?.setHex(selected?0x6d3525:0);
  material.opacity=muted?.08:opacity;material.transparent=material.opacity<1;material.depthWrite=!material.transparent;material.needsUpdate=true;
}

/** Replay a real choice made while the shared shell was still loading. */
export function replayPendingSelection(host,{choose,setLayer}) {
  const entry=host.dataset.pendingEntry,layer=host.dataset.pendingLayer;
  if(!entry&&!layer)return;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(!host.isConnected)return;
    if(entry&&choose)choose(entry);else if(layer)setLayer(layer);
  }));
}
