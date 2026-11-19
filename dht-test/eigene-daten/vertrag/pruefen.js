/** JSON-Schema-2020-12 subset used by datensatz-v1, plus documented domain invariants.
 * No coercion, repair, inference, IO or dependencies during validation. */
export function schemaFehler(value, schema, path = '$') {
  const errors = [], fail = text => errors.push(`${path}: ${text}`);
  const valid = sub => schemaFehler(value, sub, path).length === 0;
  if (schema.type) {
    const ok = schema.type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
      : schema.type === 'array' ? Array.isArray(value)
      : schema.type === 'integer' ? Number.isSafeInteger(value)
      : schema.type === 'number' ? typeof value === 'number' && Number.isFinite(value)
      : typeof value === schema.type;
    if (!ok) return [`${path}: Typ ${schema.type} erforderlich`];
  }
  if ('const' in schema && value !== schema.const) fail('Konstante stimmt nicht');
  if (schema.enum && !schema.enum.includes(value)) fail('Wert nicht zugelassen');
  if (typeof value === 'string') {
    if (schema.minLength && value.length < schema.minLength) fail('Text fehlt');
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail('Textformat stimmt nicht');
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) fail('Untergrenze');
    if (schema.maximum !== undefined && value > schema.maximum) fail('Obergrenze');
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required || []) if (!(key in value)) fail(`${key} fehlt`);
    for (const [key, val] of Object.entries(value)) {
      if (schema.properties?.[key]) errors.push(...schemaFehler(val, schema.properties[key], `${path}.${key}`));
      else if (schema.additionalProperties === false) fail(`${key} nicht zugelassen`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.uniqueItems && new Set(value.map(v => JSON.stringify(v))).size !== value.length) fail('Doppelte Einträge');
    if (schema.items) value.forEach((v, i) => errors.push(...schemaFehler(v, schema.items, `${path}[${i}]`)));
  }
  if (schema.allOf) for (const sub of schema.allOf) errors.push(...schemaFehler(value, sub, path));
  if (schema.anyOf && !schema.anyOf.some(valid)) fail('Keine Alternative erfüllt');
  if (schema.oneOf && schema.oneOf.filter(valid).length !== 1) fail('Genau eine Alternative erforderlich');
  if (schema.not && valid(schema.not)) fail('Ausgeschlossene Kombination');
  if (schema.if) {
    const branch = valid(schema.if) ? schema.then : schema.else;
    if (branch) errors.push(...schemaFehler(value, branch, path));
  }
  return errors;
}
export function pruefen(d, schema, mapping) {
  const errors = schemaFehler(d, schema);
  if (errors.length) return errors;
  const iso = d.zeit.iso;
  if (iso) {
    const [year, month, day] = iso.split('T')[0].split('-').map(Number);
    if (year < 1 || month < 1 || month > 12 || (day !== undefined && (day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate())) || (d.zeit.genauigkeit === 'zeitpunkt' && !Number.isFinite(Date.parse(iso)))) errors.push('zeit: ungültiges Kalenderdatum');
  }
  if (d.vergleich && d.vergleich.unten !== undefined && d.vergleich.oben !== undefined && d.vergleich.unten > d.vergleich.oben) errors.push('vergleich: Grenzen vertauscht');
  if (d.vergleich && !['unten','oben','text'].some(k => k in d.vergleich)) errors.push('vergleich: Inhalt fehlt');
  const organs = d.art === 'messwert' ? mapping.eintraege.find(e => e.loinc.code === d.loinc.code && e.loinc.system === d.loinc.system)?.organe || [] : [];
  if (d.organe.some(id => !organs.includes(id))) errors.push('organe: keine native Bindung');
  return errors;
}
export function datum(zeit, now = new Date()) {
  if (zeit.iso) return new Date(zeit.iso.length === 7 ? zeit.iso + '-01T12:00:00Z' : zeit.iso.length === 10 ? zeit.iso + 'T12:00:00Z' : zeit.iso);
  const date = new Date(now); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - zeit.tageVorHeute); return date;
}
export function organIds(d, mapping) {
  // Unknown codes stay in Weitere Messwerte even if a caller supplies organ IDs.
  return mapping.eintraege.find(e => e.loinc.code === d.loinc?.code && e.loinc.system === d.loinc?.system)?.organe || [];
}
if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  const {readFile, readdir} = await import('node:fs/promises');
  const assert = (await import('node:assert/strict')).default;
  const root = new URL('./', import.meta.url), read = async name => JSON.parse(await readFile(new URL(name, root), 'utf8'));
  const schema = await read('datensatz-v1.schema.json'), mapping = await read('loinc-organ-v1.json');
  const cases = (await readdir(new URL('faelle/', root))).filter(f => f.endsWith('.json')).sort();
  for (const file of cases) { const c = await read('faelle/' + file), errors = pruefen(c.datensatz, schema, mapping); assert.equal(errors.length === 0, c.gueltig, `${c.id}: ${errors}`); }
  const data = await read('beispielperson-v1.json');
  assert.equal(new Set(data.datensaetze.map(d => d.id)).size, data.datensaetze.length);
  for (const d of data.datensaetze) assert.deepEqual(pruefen(d, schema, mapping), [], d.id);
  assert.deepEqual(organIds({loinc:{code:'unbekannt',system:'http://loinc.org'},organe:['erfunden']}, mapping), []);
  console.log(JSON.stringify({konformitaetsfaelle:cases,datensaetze:data.datensaetze.length,fehler:0}));
}
