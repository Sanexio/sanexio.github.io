// Keep the catalogue, decoders and geometry off the initial rendering path.
const names = [
  ['herz','Herz'], ['lunge','Lunge'], ['niere','Niere'], ['leber','Leber'],
  ['gehirn','Gehirn'], ['magen','Magen'], ['kolon','Dickdarm','Kolon'],
  ['duenndarm','Dünndarm'], ['milz','Milz'], ['schilddruese','Schilddrüse'],
  ['harnblase','Harnblase','Blase'], ['harnleiter','Harnleiter'],
  ['pankreas','Bauchspeicheldrüse','Pankreas'], ['uterus','Gebärmutter','Uterus'],
  ['mamma','Brustdrüse','Brust'], ['ovar','Eierstock','Ovar'], ['prostata','Prostata'],
  ['carotis','Halsschlagader','Karotis'], ['gefaesse','Blutgefäße','Gefäße'],
  ['speiseroehre','Speiseröhre','Ösophagus'], ['gallenblase','Gallenblase'],
  ['nebenniere','Nebennieren'], ['hypophyse','Hypophyse','Hirnanhangdrüse'], ['gonaden_maennlich','Hoden']
];
const normalize = value => value.trim().toLocaleLowerCase('de').replace(/ß/g,'ss')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export function attachOrganAtlas(host, sex, signal) {
  const input = host.querySelector('#anatomie-suche');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary atlas-open';
  button.setAttribute('aria-haspopup','dialog');
  host.querySelector('.avatar-search').append(button);
  let group, pending = false;
  const refresh = () => {
    const query = normalize(input.value);
    const matches = query ? names.filter(row => row.some(name => normalize(name).includes(query))) : [];
    group = matches.length ? matches[0][0] : null;
    button.hidden = Boolean(query && !group);
    button.textContent = group ? matches[0][1] + ' im Organatlas öffnen' : 'Organatlas öffnen';
  };
  input.addEventListener('input',refresh);
  refresh();
  button.addEventListener('click',async () => {
    if (pending) return;
    pending = true;
    try {
      const {openOrganAtlas} = await import('./organatlas-ansicht.js');
      if (!signal?.aborted && host.isConnected) await openOrganAtlas(host, group, sex, signal);
    } catch {
      if (!signal?.aborted) button.textContent = 'Organatlas erneut öffnen';
    } finally { pending = false; }
  });
  return refresh;
}
