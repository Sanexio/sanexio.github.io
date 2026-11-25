/** Reserve a real viewport for the DHT; controls scroll in their own dock. */
const app=document.querySelector('.app');
const rail=app.querySelector('.notice-rail');
const tabs=app.querySelector('.explore-tabs');
const layerLabel=app.querySelector('#schicht-wahl')?.closest('label');
if(tabs&&layerLabel){
 const navigation=document.createElement('div');navigation.className='dht-navigation';
 navigation.setAttribute('role','group');navigation.setAttribute('aria-label','Ansichten und Körperschichten');
 tabs.before(navigation);navigation.append(tabs,layerLabel);
 layerLabel.classList.add('dht-layer-select');
 layerLabel.querySelector('select').setAttribute('aria-label','Körperschicht auswählen');
 const skin=layerLabel.querySelector('option[value="haut"]');if(skin)skin.textContent='Haut';
}
// Notices remain available in the control area and cannot enlarge over the body.
const notices=document.createElement('div');notices.className='dht-notices';
app.querySelector('.app-content').prepend(notices);
for(const id of ['mvp-hinweis','safety-core','female-standhinweis']){
 const notice=document.getElementById(id);if(notice)notices.append(notice);
}
let pending;
function layout(){
 pending=undefined;
 const host=app.querySelector('#avatar-stage');
 if(host?.dataset.ready==='true')for(const id of ['canvas-name','zoom-panel','zoom-surface']){
  const control=host.querySelector('.avatar-viewport #'+id);if(control)host.append(control);
 }
 const width=document.documentElement.clientWidth,height=window.innerHeight;
 const top=Math.ceil(rail.getBoundingClientRect().bottom)+2,gap=4;
 const portrait=width<=600&&height>width;
 const panel=app.querySelector('.hd-organ-panel');
 const expanded=panel&&!panel.hidden&&(panel.classList.contains('hd-expanded')||Boolean(panel.querySelector('details[open]')));
 // Keep a margin above the 2/3 visible-canvas threshold for in-canvas controls.
 const fraction=portrait?(expanded ? .71 : .74):.72;
 const available=Math.max(1,height-top-2),canvasWidth=portrait?width-4:Math.ceil(fraction*width*height/available);
 const canvasHeight=portrait?Math.ceil(fraction*width*height/canvasWidth):available;
 const dockLeft=portrait?2:canvasWidth+gap+2,dockTop=portrait?top+canvasHeight+gap:top;
 const values={'--dht-rail-height':top,'--dht-canvas-top':top,'--dht-canvas-width':canvasWidth,'--dht-canvas-height':canvasHeight,'--dht-dock-left':dockLeft,'--dht-dock-top':dockTop,'--dht-dock-width':Math.max(1,width-dockLeft-2),'--dht-dock-height':Math.max(1,height-dockTop-2)};
 for(const [name,value]of Object.entries(values))if(app.style.getPropertyValue(name)!==value+'px')app.style.setProperty(name,value+'px');
 app.dataset.dock=portrait?'bottom':'side';
}
function schedule(){if(pending===undefined)pending=requestAnimationFrame(layout);}
const sizeObserver=new ResizeObserver(schedule);sizeObserver.observe(rail);
const stateObserver=new MutationObserver(schedule);
stateObserver.observe(app,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','data-mode']});
window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);
layout();
window.addEventListener('pagehide',event=>{if(!event.persisted){sizeObserver.disconnect();stateObserver.disconnect();cancelAnimationFrame(pending);window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);}});
