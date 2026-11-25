/**
 * Termin-Formular-Anbindung — gleiche Origin wie Widget, kein externes Netz.
 * Schreibt JSON in name="dht_schmerzort_json" (hidden/textarea im .pxz-svc-form).
 */
(function () {
  'use strict';
  var cfg = window.PXZ_DHT_EMBED || {};
  var widgetSrc =
    cfg.widgetSrc ||
    '/wp-content/uploads/pxz-dht-patient-auswahl/index.html';
  var hostSel = cfg.hostSelector || '#pxz-dht-patient-host';
  var fieldSel = cfg.fieldSelector || '[name="dht_schmerzort_json"]';

  function mount() {
    var host = document.querySelector(hostSel);
    if (!host) return;
    var frame = document.createElement('iframe');
    frame.title = 'Wo tut es weh?';
    frame.src = widgetSrc;
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer';
    frame.style.cssText =
      'width:100%;min-height:520px;border:1px solid #9fb0c2;border-radius:10px';
    host.replaceChildren(frame);
    var allowed = new URL(widgetSrc, location.href).origin;
    window.addEventListener('message', function (ev) {
      if (ev.origin !== allowed) return;
      if (!ev.data || ev.data.type !== 'dht-patient-auswahl') return;
      var json = JSON.stringify(ev.data.payload);
      var form = host.closest('form') || document.querySelector('form.pxz-svc-form');
      var field = (form && form.querySelector(fieldSel)) || document.querySelector(fieldSel);
      if (field) {
        field.value = json;
        field.dispatchEvent(new Event('input', { bubbles: true }));
      }
      var status = document.querySelector('[data-pxz-dht-status]');
      if (status && ev.data.payload && Array.isArray(ev.data.payload.orte)) {
        status.textContent =
          'Schmerzorte übernommen (' + ev.data.payload.orte.length + ') — bitte Formular absenden.';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
