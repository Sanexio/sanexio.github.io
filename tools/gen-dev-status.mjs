#!/usr/bin/env node
// Der frühere Release-Feed passt nicht zur redaktionellen Cortex-Produktpalette.
console.error('Der Release-Import ist stillgelegt. Produkttexte werden in src/data/dev-status.ts gepflegt. Es wurde keine Datei verändert.');
process.exitCode = 1;
