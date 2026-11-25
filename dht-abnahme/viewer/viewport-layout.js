/** Keep the body inside the available viewport without hiding notices. */
const app=document.querySelector('.app');
const rail=app.querySelector('.notice-rail');
// Keep the existing layer selector in view without adding a second control.
const tabs=app.querySelector('.explore-tabs');
const layerLabel=app.querySelector('#schicht-wahl')?.closest('label');
if(tabs&&layerLabel){
 const navigation=document.createElement('div');navigation.className='dht-navigation';
 navigation.setAttribute('role','group');navigation.setAttribute('aria-label','Ansichten und Körperschichten');
 tabs.before(navigation);navigation.append(tabs,layerLabel);
 layerLabel.classList.add('dht-layer-select');
 const select=layerLabel.querySelector('select');select.setAttribute('aria-label','Körperschicht auswählen');
 const skin=select.querySelector('option[value="haut"]');if(skin)skin.textContent='Haut';
}
function measureRail(){
 const height=Math.ceil(rail.getBoundingClientRect().height)+4;
 if(app.style.getPropertyValue('--dht-rail-height')!==height+'px')
  app.style.setProperty('--dht-rail-height',height+'px');
}
const observer=new ResizeObserver(measureRail);
observer.observe(rail);
measureRail();
window.addEventListener('pagehide',event=>{if(!event.persisted)observer.disconnect();});
