# Local anatomy viewer dependencies

three.js and its loaders/controls are copied from the approved local
`Assets-3D-Anatomie/zoom-kette/vendor/three` distribution. MIT license:
`three/LICENSE`. Only bare `three` imports in examples were replaced with
relative paths to the vendored build. No CDN or runtime package lookup.

MeshoptDecoder 0.22 comes from the existing local Nierenwerte-Probelauf
distribution (MIT, Arseny Kapoulkine). The actual decoder is tested against
every shipped meshopt buffer, including models exported by newer encoders.
See `three/examples/jsm/libs/MESHOPT-LICENSE.txt`.

Draco's WebAssembly decoder and wrapper come from the same approved three.js
distribution. Draco is licensed under Apache 2.0; see
`three/examples/jsm/libs/draco/LICENSE.txt`. It is loaded only for Carotis.

Model sources, attribution, license links and modification notices are
displayed beside every organ. Their source records are in `/anatomy/licenses/`.
The supplied mobile GLBs, posters and OG images are copied without changes.
