// Only read our local configuration. The destination is never fetched.
try {
  const response = await fetch(new URL('./rueckmeldung.json', import.meta.url));
  if (response.ok) {
    const {href} = await response.json();
    if (typeof href === 'string' && href.startsWith('https://')) {
      const url = new URL(href);
      if (url.protocol === 'https:' && url.hostname) {
        const link = document.createElement('a');
        link.id = 'mvp-kontakt';
        link.href = url.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Verbesserungsvorschlag senden';
        document.querySelector('#mvp-hinweis .mvp-text').append(link);
      }
    }
  }
} catch { /* Missing or invalid configuration leaves the invitation as text. */ }
