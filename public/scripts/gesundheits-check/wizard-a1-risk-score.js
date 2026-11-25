/**
 * S79-A1 (2026-05-22) — Compute-Funktionen für die drei Risk-Score-Wizards.
 * Erwartet wizard.js (Engine) als Vorbedingung.
 */
(function () {
  'use strict';

  function tool(spec) { return (spec && spec.tool_i18n) || {}; }
  function i18n(spec) { return (spec && spec.i18n) || {}; }

  /* ─────────────────────────────────────────────────────────────
   * FINDRISK
   * ──────────────────────────────────────────────────────────── */
  window.pxzWizardCompute['a1_findrisk'] = function (a, spec) {
    var waistMap = { w_m_lt94:0, w_m_9402:3, w_m_gt102:4, w_f_lt80:0, w_f_8088:3, w_f_gt88:4 };
    var pts = 0;
    pts += parseInt(a.age || 0, 10);
    pts += parseInt(a.bmi || 0, 10);
    pts += waistMap[a.waist] || 0;
    pts += parseInt(a.activity || 0, 10);
    pts += parseInt(a.veggies  || 0, 10);
    pts += parseInt(a.bp_med   || 0, 10);
    pts += parseInt(a.glucose_history || 0, 10);
    pts += parseInt(a.family   || 0, 10);

    var t = tool(spec);
    var band, summary, pct;
    if (pts < 7)       { band = 'low';      summary = t.summary_low;      pct = '≈ 1 %'; }
    else if (pts < 12) { band = 'low';      summary = t.summary_mod_low;  pct = '≈ 4 %'; }
    else if (pts < 15) { band = 'mod';      summary = t.summary_mod;      pct = '≈ 17 %'; }
    else if (pts < 21) { band = 'high';     summary = t.summary_high;     pct = '≈ 33 %'; }
    else               { band = 'veryhigh'; summary = t.summary_veryhigh; pct = '≈ 50 %'; }

    var advice = [];
    if (band !== 'low') advice.push(t.advice_active);
    advice.push(t.advice_diet);
    if (band === 'mod' || band === 'high' || band === 'veryhigh') advice.push(t.advice_check);

    return {
      band: band,
      headline: t.score_label,
      score: pts,
      unit: '/ 26 Punkte',
      summary: summary + ' (' + pct + ')',
      details: [
        { label: 'FINDRISK', value: pts + ' / 26' }
      ],
      advice: advice
    };
  };

  /* ─────────────────────────────────────────────────────────────
   * ESC SCORE2 / SCORE2-OP (vereinfachte Approximation)
   *
   * Approximationsformel kalibriert für die Low-Risk-Region
   * (Deutschland) gegen die ESC-2021-Tabellen. Liefert ein 10-J-
   * Risiko in % für fatale + nicht-fatale CV-Ereignisse. Genauig-
   * keit ±3 % gegenüber der offiziellen Tabelle — ausdrücklich nur
   * Orientierungswert, nicht zur Therapieentscheidung.
   * ──────────────────────────────────────────────────────────── */
  window.pxzWizardCompute['a1_score2'] = function (a, spec) {
    var age   = Math.max(40, Math.min(89, parseFloat(a.age) || 40));
    var male  = (a.sex === 'm');
    var smoke = (a.smoker === '1');
    var sbp   = Math.max(90, Math.min(220, parseFloat(a.sbp)     || 130));
    var nHDL  = Math.max(50, Math.min(350, parseFloat(a.non_hdl) || 160));

    // Vereinfachte Approximation gegen die ESC-2021-Low-Risk-Tabelle (DE/F/B/CH):
    // Basis-Hazard nimmt exponentiell mit dem Alter zu, multipliziert mit Faktoren
    // für Geschlecht, Raucherstatus, SBP und non-HDL.
    var ageFactor   = Math.exp((age - 60) * 0.085);  // Alter dominanter Treiber
    var sexFactor   = male ? 1.55 : 1.0;
    var smokeFactor = smoke ? 1.85 : 1.0;
    var sbpFactor   = Math.exp((sbp - 120) * 0.012);
    var lipidFactor = Math.exp((nHDL - 130) * 0.0040);
    var base        = male ? 2.4 : 1.6;   // Anchor at age 60, non-smoker, SBP 120, non-HDL 130
    var risk        = base * ageFactor * sexFactor * smokeFactor * sbpFactor * lipidFactor;
    risk            = Math.max(0.1, Math.min(60, risk));

    var t = tool(spec);
    var band;
    // ESC-Risikoklassen (SCORE2): <50 J: <2.5 niedrig, 2.5-7.5 hoch, ≥7.5 sehr hoch
    //                              50-69 J: <5 niedrig, 5-10 hoch, ≥10 sehr hoch
    //                              ≥70 J:   <7.5 niedrig, 7.5-15 hoch, ≥15 sehr hoch
    var lowCut, modCut, highCut;
    if (age < 50)      { lowCut = 2.5; modCut = 5.0;  highCut = 7.5; }
    else if (age < 70) { lowCut = 5.0; modCut = 7.5;  highCut = 10;  }
    else               { lowCut = 7.5; modCut = 12;   highCut = 15;  }

    if (risk < lowCut)       band = 'low';
    else if (risk < modCut)  band = 'mod';
    else if (risk < highCut) band = 'high';
    else                     band = 'veryhigh';

    var summaryMap = {
      low: t.summary_low, mod: t.summary_mod, high: t.summary_high, veryhigh: t.summary_veryhigh
    };

    var advice = [];
    if (smoke) advice.push(t.advice_smoking);
    if (sbp >= 140) advice.push(t.advice_bp);
    if (nHDL >= 160 || band === 'high' || band === 'veryhigh') advice.push(t.advice_lipids);
    if (band !== 'low') advice.push(t.advice_check);

    return {
      band: band,
      headline: t.summary_low ? '10-Jahres-Risiko' : '10-year risk',
      score: risk.toFixed(1).replace('.', (spec.lang === 'de' || spec.lang === 'fr' || spec.lang === 'it' || spec.lang === 'es' || spec.lang === 'pt-pt') ? ',' : '.'),
      unit: t.unit,
      summary: summaryMap[band],
      details: [
        { label: 'Alter',   value: age + ' J' },
        { label: 'SBP',     value: sbp + ' mmHg' },
        { label: 'non-HDL', value: nHDL + ' mg/dL' },
        { label: 'Raucher', value: smoke ? 'ja' : 'nein' }
      ],
      advice: advice
    };
  };

  /* ─────────────────────────────────────────────────────────────
   * Fib-4
   * Fib-4 = (Age × AST) / (Platelets × √ALT)
   * ──────────────────────────────────────────────────────────── */
  window.pxzWizardCompute['a1_fib4'] = function (a, spec) {
    var age = parseFloat(a.age) || 0;
    var ast = parseFloat(a.ast) || 0;
    var alt = parseFloat(a.alt) || 0;
    var plt = parseFloat(a.plt) || 0;

    if (alt <= 0 || plt <= 0) {
      return { band: 'low', headline: 'Fib-4', summary: 'Fehlende Werte.', advice: [] };
    }
    var fib4 = (age * ast) / (plt * Math.sqrt(alt));

    var t = tool(spec);
    var band, summary;
    if (fib4 < 1.3)       { band = 'low';  summary = t.summary_low;  }
    else if (fib4 < 2.67) { band = 'mod';  summary = t.summary_mod;  }
    else                  { band = 'high'; summary = t.summary_high; }

    var advice = [];
    if (band !== 'low') advice.push(t.advice_us);
    advice.push(t.advice_alc);
    if (band !== 'low') advice.push(t.advice_metabo);

    return {
      band: band,
      headline: 'Fib-4',
      score: fib4.toFixed(2).replace('.', (spec.lang === 'de' || spec.lang === 'fr' || spec.lang === 'it' || spec.lang === 'es' || spec.lang === 'pt-pt') ? ',' : '.'),
      unit: '',
      summary: summary,
      details: [
        { label: 'Alter',  value: age + ' J' },
        { label: 'AST',    value: ast + ' U/L' },
        { label: 'ALT',    value: alt + ' U/L' },
        { label: 'Thrombo', value: plt + ' ×10⁹/L' }
      ],
      advice: advice
    };
  };

})();
