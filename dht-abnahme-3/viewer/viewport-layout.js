/** Three disjoint viewport regions; controls never cover the DHT. */
const app=document.querySelector('.app'),rail=app.querySelector('.notice-rail'),tabs=app.querySelector('.explore-tabs');
const layerLabel=app.querySelector('#schicht-wahl')?.closest('label');
const navigation=document.createElement('div');navigation.className='dht-navigation';navigation.setAttribute('role','group');navigation.setAttribute('aria-label','Ansichten und Körperschichten');
if(tabs){rail.prepend(navigation);navigation.append(tabs);}
if(layerLabel){navigation.append(layerLabel);layerLabel.classList.add('dht-layer-select');layerLabel.querySelector('select').setAttribute('aria-label','Körperschicht auswählen');const skin=layerLabel.querySelector('option[value="haut"]');if(skin)skin.textContent='Haut';}
const information=document.createElement('div');information.className='dht-information';app.querySelector('.app-content').prepend(information);information.append(document.getElementById('mvp-hinweis'));
const notices=document.createElement('div');notices.className='dht-notices';app.querySelector('.app-content').before(notices);
for(const id of ['safety-core','female-standhinweis']){const node=document.getElementById(id);if(node)notices.append(node);}
let pending,contextModule;
function layout(){
 pending=undefined;
 const host=app.querySelector('#avatar-stage'),width=document.documentElement.clientWidth,height=window.innerHeight;
 const side=width>=780&&height>=620;
 // At least 69.5% of the entire browser viewport, before small anchor targets.
 const gap=4,top=2,available=height-4,canvasWidth=side?Math.ceil(.705*width*height/available):width-4,canvasHeight=side?available:Math.ceil(.705*width*height/canvasWidth);
 const left=side?Math.floor((width-canvasWidth-12)*.44):0;
 const canvasLeft=side?left+gap+2:2,dockLeft=side?canvasLeft+canvasWidth+gap:2,dockTop=side?top:top+canvasHeight+gap;
 const dockWidth=Math.max(1,width-dockLeft-2),dockHeight=Math.max(1,height-dockTop-2);
 const values={'--dht-rail-height':0,'--dht-canvas-left':canvasLeft,'--dht-canvas-top':top,'--dht-canvas-width':canvasWidth,'--dht-canvas-height':canvasHeight,'--dht-left-width':left,'--dht-dock-left':dockLeft,'--dht-dock-top':dockTop,'--dht-dock-width':dockWidth,'--dht-dock-height':dockHeight};
 for(const [name,value]of Object.entries(values))if(app.style.getPropertyValue(name)!==value+'px')app.style.setProperty(name,value+'px');
 app.dataset.dock=side?'side':'bottom';app.dataset.dashboard='true';
 if(host?.querySelector('.avatar-search')){
  let menu=host.querySelector('.dashboard-nav');
  if(!menu){menu=document.createElement('nav');menu.className='dashboard-nav';menu.setAttribute('aria-label','DHT Navigation');const title=document.createElement('h1');title.textContent='DHT';menu.append(title);host.prepend(menu);}
  if(navigation.parentElement!==menu)menu.append(navigation);
  for(const selector of ['.layer-panel','.avatar-actions']){const node=host.querySelector(selector);if(node&&node.parentElement!==menu)menu.append(node);}
  if(side&&information.parentElement!==menu)menu.append(information);
  if(!side){const panel=app.querySelector('.hd-organ-panel');const owner=panel&&!panel.hidden?panel:app.querySelector('.app-content');if(information.parentElement!==owner)owner.prepend(information);}
  for(const id of ['canvas-name','zoom-panel','zoom-surface']){const control=host.querySelector('.avatar-viewport #'+id);if(control)host.append(control);}
  if(host.dataset.ready==='true'&&!host.querySelector('#dashboard-context')){
   contextModule ||= import('./dashboard-context.js');contextModule.then(module=>module.mountDashboardContext(app));
  }
 }
 const safetyHeight=Math.ceil(notices.getBoundingClientRect().height);
 for(const [name,value]of Object.entries({'--dht-content-top':dockTop+safetyHeight,'--dht-content-height':Math.max(1,dockHeight-safetyHeight)}))if(app.style.getPropertyValue(name)!==value+'px')app.style.setProperty(name,value+'px');
}
function schedule(){if(pending===undefined)pending=requestAnimationFrame(layout);}
const sizes=new ResizeObserver(schedule);sizes.observe(rail);sizes.observe(notices);
const states=new MutationObserver(schedule);states.observe(app,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','data-ready','data-mode','data-local-flow','data-local-gate']});
window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);layout();
window.addEventListener('pagehide',event=>{if(!event.persisted){sizes.disconnect();states.disconnect();cancelAnimationFrame(pending);window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);}});
