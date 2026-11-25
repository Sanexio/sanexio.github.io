import {atlas} from './katalog.js';

const path = key => 'nerven/' + key;
export const nerveEntries = atlas.entries.map(e => ({
  id:'nerven:' + e.key, kind:'nerve', names:{de:e.de, la:e.la},
  geometry:[path(e.key)], aliases:[e.system, ...e.aliases],
}));
const brain = nerveEntries.filter(e => e.aliases.includes('Gehirn'));
export const brainEntry = {
  id:'nerven:gehirn', kind:'nerve', names:{de:'Gehirn', la:'Encephalon · ZNS'},
  geometry:brain.flatMap(e=>e.geometry), aliases:['Zentralnervensystem'],
};
export function atlasSurfaces({download,digest,parse}) {
  const tier = matchMedia('(max-width:760px)').matches || navigator.connection?.saveData ? 'mobil' : 'detail';
  const loads = new Map();
  async function verify(bytes,spec){
    if(bytes.byteLength!==spec.bytes || await digest(bytes)!==spec.sha256)throw Error('Atlasoberfläche beschädigt');
  }
  async function mobileIndices(){
    if(!loads.has('indizes')){
      const spec=atlas.indexPack;
      const task=download(spec.file,'Organoberflächen',spec.bytes,true).then(async bytes=>{
        await verify(bytes,spec);
        const raw=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
        if(raw.byteLength!==spec.decodedBytes)throw Error('Indexumfang abweichend');
        return raw;
      }).catch(error=>{loads.delete('indizes');throw error;});
      loads.set('indizes',task);
    }
    return loads.get('indizes');
  }
  async function pack(kind, quiet) {
    if(!loads.has(kind)){
      const spec = atlas.packs[kind][tier];
      const task = download(spec.file, 'Atlasoberflächen', spec.bytes, quiet).then(bytes => {
        return verify(bytes,spec).then(()=>({bytes,segments:spec.segments}));
      }).catch(error=>{loads.delete(kind);throw error;});
      loads.set(kind,task);
    }
    return loads.get(kind);
  }
  async function surface(kind, key, quiet) {
    const {bytes,segments} = await pack(kind,quiet);
    const {offset,length,triangles} = segments[key];
    const {scene} = await parse(bytes.slice(offset,offset+length));
    return {group:scene,triangles};
  }
  return {
    tier,
    organ(hash){const key=atlas.organs[hash];return key?surface('organe',key,true):null;},
    async refineIndices(group,hash){
      const spec=atlas.indexLevels[hash];
      if(!spec)return;
      const meshes=[];
      group.traverse(o=>{if(o.isMesh)meshes.push(o);});
      if(meshes.length!==1)throw Error('Organbindung abweichend');
      const geometry=meshes[0].geometry,index=geometry.index;
      if(index.count!==spec.baseTriangles*3)throw Error('Organtopologie abweichend');
      let next;
      if(tier==='mobil'){
        const raw=await mobileIndices();
        next=new Uint32Array(raw,spec.mobil.offset,spec.mobil.length/4);
      }else{
        const omit=new Set(spec.removed);
        next=index.array.filter((_,i)=>!omit.has(Math.floor(i/3)));
      }
      geometry.setIndex(new index.constructor(next,1));
      return next.length/3;
    },
    async nerves(attach) {
      for(const entry of atlas.entries){
        const {group,triangles} = await surface('nerven',entry.key,false);
        attach({group,triangles,file:path(entry.key),kind:'nerve',name:entry.de},entry);
      }
    },
  };
}
