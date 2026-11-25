/** The historical full workbench is available only in a local context.
 * Public origins expose the synthetic selection view and no personal input. */
import {isLocalContext} from '../../eigene-daten/kontext.js';
export function publicFullView(url = location) {
  if(isLocalContext(url))return false;
  const main=document.createElement('main');main.className='shell';
  const h=document.createElement('h1');h.textContent='Eigene Daten · Beispiel';
  const p=document.createElement('p');p.textContent='Beispieldaten einer erfundenen Person. Eigene Werte erfassen Sie in der lokalen Fassung – sie verlassen Ihr Gerät nicht.';
  const a=document.createElement('a');const target=new URL('index.html',new URL(document.querySelector('meta[name="dht-selection-root"]').content,document.baseURI));target.searchParams.set('modus','daten');a.href=target.href;a.textContent='Zur Beispielansicht „Eigene Daten“';
  const home=document.createElement('a');home.href='/';home.target='_top';home.textContent='← Sanexio Startseite';home.style.cssText='display:inline-flex;align-items:center;min-height:44px;color:#98171c;font-weight:700';
  main.append(home,h,p,a);document.body.replaceChildren(main);document.documentElement.dataset.ready='true';return true;
}
