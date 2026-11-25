// The source atlas also contains named parts that have no searchable register entry.
export function bindMuscleParts(manifest, catalog) {
  const assets = new Map(manifest.assets.map(asset => [asset.file, asset]));
  const parts = new Map();
  for (const part of catalog.segments) {
    const asset = assets.get(part.file);
    if (asset?.kind !== 'muscle' || asset.sha256 !== part.sha256) continue;
    const side = {L:' links', R:' rechts', M:''}[part.side];
    const entry = {id:part.id, kind:'muscle', side:part.side,
      names:{de:part.de + side, la:part.la, en:asset.name}, geometry:[part.file]};
    parts.set(part.id, entry);
  }
  let groups = 0;
  for (const entry of manifest.entries) {
    if (entry.kind !== 'muscle') continue;
    entry.referenceWithoutSide = Boolean(catalog.unsidedReferences?.[entry.id]);
    entry.referenceModel = catalog.references?.[entry.id] || catalog.unsidedReferences?.[entry.id];
    if (entry.geometry.length) {
      entry.searchRegion = catalog.regions[entry.geometry.find(file => catalog.regions[file])] || '';
      continue;
    }
    const [, , number, side] = entry.id.split(':');
    // A register entry without a side can also represent both named halves of the same TA2 structure.
    const ids = side === 'M'
      ? ['L', 'R'].map(half => `atlas:muskel:${number}:${half}`)
      : (catalog.groups[number] || []).map(part => `atlas:muskel:${part}:${side}`);
    const children = ids.map(id => parts.get(id));
    if (children.length && children.every(Boolean)) {
      entry.geometry = children.map(child => child.geometry[0]);
      entry.atlasGroup = true;
      if (side !== 'M') entry.names = {...entry.names, de:entry.names.de + (side === 'L' ? ' links' : ' rechts')};
      groups++;
    }
  }
  manifest.entries.push(...parts.values());
  return {parts:parts.size, groups};
}
