/**
 * S79 (2026-05-22) — Wizard-Engine Frontend.
 *
 * Initialisiert alle .pxz-wizard-Container auf einer Seite. Liest die
 * JSON-Spec aus dem nachfolgenden <script class="pxz-wizard-data"> und
 * rendert Steps mit Inputs (select, radio, number, date, multiselect).
 *
 * Pro Wizard-Key kann ein Modul eine Compute-Funktion am globalen Objekt
 * window.pxzWizardCompute[<key>] registrieren:
 *   pxzWizardCompute['a1_findrisk'] = function(answers){
 *     return { score: 12, band: 'mod', explain: '…', advice: '…' };
 *   };
 *
 * Erwartetes Compute-Result-Schema:
 *   {
 *     band:    'low' | 'mod' | 'high' | 'veryhigh',
 *     headline:'…',                  // Haupt-Risk-Label
 *     score:    optional Number,     // numerischer Score
 *     unit:     optional String,     // z. B. '%/10y'
 *     summary:  optional String,     // 1-2 Sätze Klartext
 *     details:  optional Array<{label,value}>,
 *     advice:   optional Array<String>, // konkrete Empfehlungen
 *     cta_text: optional String,     // Override für Doctolib-CTA
 *     cta_url:  optional String      // Override-URL (z. B. per-Disziplin)
 *   }
 */
(function () {
  'use strict';

  window.pxzWizardCompute = window.pxzWizardCompute || {};

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function bindWizard(root) {
    if (root.dataset.pxzInit === '1') return;
    root.dataset.pxzInit = '1';

    var dataScript = root.nextElementSibling;
    while (dataScript && !dataScript.matches('script.pxz-wizard-data')) {
      dataScript = dataScript.nextElementSibling;
    }
    if (!dataScript) return;

    var spec;
    try { spec = JSON.parse(dataScript.textContent); }
    catch (e) { return; }

    var i18n      = spec.i18n      || {};
    var toolI18n  = spec.tool_i18n || {};
    var steps     = Array.isArray(spec.steps) ? spec.steps : [];
    var stage     = root.querySelector('.pxz-wizard-stage');
    var bar       = root.querySelector('.pxz-wizard-bar');
    var btnBack   = root.querySelector('[data-pxz-back]');
    var btnNext   = root.querySelector('[data-pxz-next]');
    var btnReset  = root.querySelector('[data-pxz-restart]');

    var cur       = 0;
    var answers   = {};
    var finished  = false;

    function pct() {
      if (!steps.length) return 0;
      var p = Math.min(100, Math.round((cur / steps.length) * 100));
      return p;
    }

    function render() {
      bar.style.setProperty('--p', pct() + '%');
      if (finished) return renderResult();
      var step = steps[cur];
      if (!step) return renderResult();
      btnBack.hidden    = cur === 0;
      btnBack.style.display = (cur === 0) ? 'none' : '';
      btnReset.hidden   = cur === 0;
      btnReset.style.display = (cur === 0) ? 'none' : '';
      btnNext.hidden    = false;
      btnNext.style.removeProperty('display');
      btnNext.textContent = (cur === steps.length - 1) ? (i18n.submit || 'Show') : (i18n.next || 'Next');

      var html  = '<div class="pxz-wizard-step" role="group" aria-labelledby="pxz-wz-q-' + esc(step.id) + '">';
      html     += '<p class="pxz-wizard-stepcount">' + esc(i18n.step_label || 'Step') + ' ' + (cur + 1) + ' ' + esc(i18n.of || 'of') + ' ' + steps.length + '</p>';
      var label = (step.label && step.label[spec.lang]) || step.label_default || step.id;
      html     += '<p id="pxz-wz-q-' + esc(step.id) + '" class="pxz-wizard-question">' + esc(label) + '</p>';
      if (step.help) {
        var help = (step.help[spec.lang]) || step.help_default || '';
        if (help) html += '<p class="pxz-wizard-help">' + esc(help) + '</p>';
      }
      html     += renderInput(step);
      html     += '</div>';
      stage.innerHTML = html;

      var firstFocus = stage.querySelector('input,select,button[data-pxz-opt]');
      if (firstFocus) { try { firstFocus.focus({preventScroll:true}); } catch (e) { firstFocus.focus(); } }
    }

    function renderInput(step) {
      var type = step.type || 'radio';
      var name = 'pxz-' + spec.key + '-' + step.id;
      var current = answers[step.id];

      if (type === 'radio' || type === 'select') {
        var opts = step.options || [];
        if (type === 'radio') {
          var rad = '<ul class="pxz-wizard-options" role="radiogroup">';
          opts.forEach(function (o, i) {
            var lab = (o.label && o.label[spec.lang]) || o.label_default || o.value;
            var checked = (current === o.value) ? ' aria-pressed="true" data-active="1"' : '';
            rad += '<li><button type="button" class="pxz-wizard-option" data-pxz-opt data-value="' + esc(o.value) + '"' + checked + '>' + esc(lab) + '</button></li>';
          });
          rad += '</ul>';
          return rad;
        }
        var sel = '<label class="pxz-wizard-field"><select name="' + esc(name) + '" data-pxz-field>';
        sel += '<option value="">—</option>';
        opts.forEach(function (o) {
          var lab = (o.label && o.label[spec.lang]) || o.label_default || o.value;
          sel += '<option value="' + esc(o.value) + '"' + (current === o.value ? ' selected' : '') + '>' + esc(lab) + '</option>';
        });
        sel += '</select></label>';
        return sel;
      }
      if (type === 'number') {
        var min  = (step.min  != null) ? ' min="' + esc(step.min)  + '"' : '';
        var max  = (step.max  != null) ? ' max="' + esc(step.max)  + '"' : '';
        var stp  = (step.stepv != null) ? ' step="' + esc(step.stepv) + '"' : ' step="any"';
        var unit = step.unit ? '<span class="pxz-wizard-unit">' + esc(step.unit) + '</span>' : '';
        var val  = (current != null) ? ' value="' + esc(current) + '"' : '';
        return '<label class="pxz-wizard-field pxz-wizard-number">' +
               '<input type="number" inputmode="decimal" name="' + esc(name) + '" data-pxz-field' + min + max + stp + val + ' autocomplete="off">' +
               unit +
               '</label>';
      }
      if (type === 'date') {
        var dval = (current != null) ? ' value="' + esc(current) + '"' : '';
        var dmin = (step.min) ? ' min="' + esc(step.min) + '"' : '';
        var dmax = (step.max) ? ' max="' + esc(step.max) + '"' : '';
        return '<label class="pxz-wizard-field"><input type="date" name="' + esc(name) + '" data-pxz-field' + dmin + dmax + dval + '></label>';
      }
      if (type === 'multiselect') {
        var ms = '<ul class="pxz-wizard-options pxz-wizard-multi">';
        var arr = Array.isArray(current) ? current : [];
        (step.options || []).forEach(function (o) {
          var lab = (o.label && o.label[spec.lang]) || o.label_default || o.value;
          var on  = arr.indexOf(o.value) !== -1 ? ' data-active="1" aria-pressed="true"' : '';
          ms += '<li><button type="button" class="pxz-wizard-option" data-pxz-multi data-value="' + esc(o.value) + '"' + on + '>' + esc(lab) + '</button></li>';
        });
        ms += '</ul>';
        return ms;
      }
      // fallback: text
      var tval = (current != null) ? ' value="' + esc(current) + '"' : '';
      return '<label class="pxz-wizard-field"><input type="text" name="' + esc(name) + '" data-pxz-field' + tval + '></label>';
    }

    function readCurrent() {
      var step = steps[cur];
      if (!step) return undefined;
      var type = step.type || 'radio';
      if (type === 'radio') {
        var act = stage.querySelector('[data-pxz-opt][data-active="1"]');
        return act ? act.getAttribute('data-value') : undefined;
      }
      if (type === 'multiselect') {
        var arr = [];
        stage.querySelectorAll('[data-pxz-multi][data-active="1"]').forEach(function (b) { arr.push(b.getAttribute('data-value')); });
        return arr;
      }
      var el = stage.querySelector('[data-pxz-field]');
      if (!el) return undefined;
      return el.value;
    }

    function validateCurrent() {
      var step = steps[cur];
      if (!step) return true;
      var val = readCurrent();
      if (step.optional) {
        answers[step.id] = val;
        return true;
      }
      if (step.type === 'multiselect') {
        if (!Array.isArray(val) || val.length === 0) return false;
        answers[step.id] = val;
        return true;
      }
      if (step.type === 'number') {
        if (val === '' || val == null || isNaN(parseFloat(val))) return false;
        answers[step.id] = parseFloat(val);
        return true;
      }
      if (val == null || val === '') return false;
      answers[step.id] = val;
      return true;
    }

    function showError(msg) {
      var err = stage.querySelector('.pxz-wizard-error');
      if (!err) {
        err = document.createElement('p');
        err.className = 'pxz-wizard-error';
        err.setAttribute('role', 'alert');
        stage.appendChild(err);
      }
      err.textContent = msg;
    }

    function renderResult() {
      bar.style.setProperty('--p', '100%');
      var fn = window.pxzWizardCompute[spec.key];
      var out;
      try { out = fn ? fn(answers, spec) : { band: 'low', headline: i18n.result_title }; }
      catch (e) { out = { band: 'low', headline: i18n.result_title, summary: String(e && e.message || e) }; }

      var band = out.band || 'low';
      var bandLabel = i18n['risk_' + band] || band;

      var html = '';
      html += '<div class="pxz-wizard-result pxz-wizard-band-' + esc(band) + '" tabindex="-1">';
      html += '<p class="pxz-wizard-result-band">' + esc(bandLabel) + '</p>';
      html += '<h3 class="pxz-wizard-result-headline">' + esc(out.headline || i18n.result_title) + '</h3>';
      if (out.score != null) {
        html += '<p class="pxz-wizard-result-score"><strong>' + esc(out.score) + '</strong>';
        if (out.unit) html += ' <span class="pxz-wizard-result-unit">' + esc(out.unit) + '</span>';
        html += '</p>';
      }
      if (out.summary) html += '<p class="pxz-wizard-result-summary">' + esc(out.summary) + '</p>';
      if (Array.isArray(out.details) && out.details.length) {
        html += '<dl class="pxz-wizard-result-details">';
        out.details.forEach(function (d) {
          html += '<dt>' + esc(d.label) + '</dt><dd>' + esc(d.value) + '</dd>';
        });
        html += '</dl>';
      }
      if (Array.isArray(out.advice) && out.advice.length) {
        html += '<ul class="pxz-wizard-result-advice">';
        out.advice.forEach(function (a) { html += '<li>' + esc(a) + '</li>'; });
        html += '</ul>';
      }

      // CTA
      var ctaUrl   = out.cta_url   || spec.cta_url   || '';
      var ctaLabel = out.cta_text  || spec.cta_label || i18n.cta_book;
      html += '<div class="pxz-wizard-result-cta">';
      if (ctaUrl) {
        html += '<a class="pxz-btn pxz-btn-primary" href="' + esc(ctaUrl) + '" target="_blank" rel="noopener external" data-pxz-outbound="doctolib">' + esc(ctaLabel) + '</a>';
      }
      html += '<button type="button" class="pxz-btn pxz-btn-ghost" data-pxz-print>' + esc(i18n.cta_print) + '</button>';
      html += '</div>';
      html += '</div>';
      stage.innerHTML = html;

      // S79e (2026-05-23): defensive Button-Hide auf der Result-Card.
      // Manche Browser oder CSS-Pfade respektieren `hidden`-Attribut
      // nicht zuverlässig (z. B. wenn `display: flex` vom Container
      // erbt). Doppelte Sicherung über style.display = 'none', damit
      // der „Auswertung anzeigen"-Submit-Button auf dem Ergebnis-
      // Bildschirm garantiert nicht mehr erscheint.
      btnNext.hidden  = true;
      btnNext.style.display = 'none';
      btnBack.hidden  = false;
      btnBack.style.removeProperty('display');
      btnReset.hidden = false;
      btnReset.style.removeProperty('display');

      var card = stage.querySelector('.pxz-wizard-result');
      if (card) { try { card.focus({preventScroll:false}); } catch (e) { card.focus(); } }

      var printBtn = stage.querySelector('[data-pxz-print]');
      if (printBtn) printBtn.addEventListener('click', function () { window.print(); });
    }

    /* Event-Wiring */
    stage.addEventListener('click', function (ev) {
      var opt = ev.target.closest('[data-pxz-opt]');
      if (opt) {
        stage.querySelectorAll('[data-pxz-opt]').forEach(function (b) { b.removeAttribute('data-active'); b.setAttribute('aria-pressed','false'); });
        opt.setAttribute('data-active', '1');
        opt.setAttribute('aria-pressed', 'true');
        return;
      }
      var multi = ev.target.closest('[data-pxz-multi]');
      if (multi) {
        var on = multi.getAttribute('data-active') === '1';
        if (on) { multi.removeAttribute('data-active'); multi.setAttribute('aria-pressed','false'); }
        else    { multi.setAttribute('data-active','1'); multi.setAttribute('aria-pressed','true'); }
      }
    });

    btnNext.addEventListener('click', function () {
      if (finished) return;
      if (!validateCurrent()) { showError(i18n.required || 'required'); return; }
      cur += 1;
      if (cur >= steps.length) { finished = true; }
      render();
    });
    btnBack.addEventListener('click', function () {
      if (finished) { finished = false; cur = steps.length - 1; render(); return; }
      if (cur > 0) { cur -= 1; render(); }
    });
    btnReset.addEventListener('click', function () {
      cur = 0; answers = {}; finished = false; render();
    });

    render();
  }

  ready(function () {
    document.querySelectorAll('[data-pxz-wizard]').forEach(bindWizard);
  });
})();
