/* Existing, source-linked explanatory material from dashboard-texte.json. */
const navigation = document.querySelector('.dht-navigation');
if (navigation) {
  const section = document.createElement('section');
  section.className = 'dht-wissenswert';
  const heading = document.createElement('strong');
  heading.textContent = 'Wusstest du?';
  const text = document.createElement('p');
  text.textContent = 'Entdecken Sie die Körperansicht als anatomischen Atlas.';
  fetch('./dashboard-texte.json').then(response => { if (!response.ok) throw new Error('Text nicht verfügbar'); return response.json(); }).then(data => { const fact = data.wusstest_du?.[0]?.text; if (fact) text.textContent = fact; }).catch(() => {});
  section.append(heading, text);
  navigation.append(section);
}
