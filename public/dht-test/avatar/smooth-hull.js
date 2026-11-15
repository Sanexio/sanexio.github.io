// Average normals at exactly coincident positions. Positions/indices stay intact.
// The study envelope has split face vertices; compression preserves those seams.
export function smoothHullNormals(geometry) {
 const positions=geometry.getAttribute('position');
 geometry.computeVertexNormals();
 const normals=geometry.getAttribute('normal'),groups=new Map();
 const key=i=>`${positions.getX(i)},${positions.getY(i)},${positions.getZ(i)}`;
 for(let i=0;i<positions.count;i++){
  const k=key(i),sum=groups.get(k)||[0,0,0];
  sum[0]+=normals.getX(i);sum[1]+=normals.getY(i);sum[2]+=normals.getZ(i);groups.set(k,sum);
 }
 for(let i=0;i<positions.count;i++){
  const n=groups.get(key(i)),length=Math.hypot(...n);
  if(length)normals.setXYZ(i,n[0]/length,n[1]/length,n[2]/length);
 }
 normals.needsUpdate=true;
 return {vertices:positions.count,sharedPositions:groups.size};
}
