// Area-weighted smoothing of coincident positions within 60 degrees of each
// source normal. Opposite coincident atlas surfaces must never cancel out.
export function smoothHullNormals(geometry,angle=Math.PI/3) {
 const p=geometry.getAttribute('position'),indices=geometry.index;
 if(!geometry.getAttribute('normal'))geometry.computeVertexNormals();
 const normals=geometry.getAttribute('normal'),reference=[];
 const groups=new Map(),adjacency=[];
 for(let i=0;i<p.count;i++){
  reference.push(normals.getX(i),normals.getY(i),normals.getZ(i));
  const key=`${p.getX(i)},${p.getY(i)},${p.getZ(i)}`;
  let faces=groups.get(key);if(!faces){faces=[];groups.set(key,faces);}adjacency.push(faces);
 }
 const count=indices?.count??p.count,at=i=>indices?indices.getX(i):i;
 for(let i=0;i<count;i+=3){
  const a=at(i),b=at(i+1),c=at(i+2),ux=p.getX(b)-p.getX(a),uy=p.getY(b)-p.getY(a),uz=p.getZ(b)-p.getZ(a),vx=p.getX(c)-p.getX(a),vy=p.getY(c)-p.getY(a),vz=p.getZ(c)-p.getZ(a);
  const n=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx],length=Math.hypot(...n);
  if(length){n.push(length);for(const j of [a,b,c])adjacency[j].push(n);}
 }
 const threshold=Math.cos(angle);let fallbacks=0;
 for(let i=0;i<p.count;i++){
  let r=reference.slice(i*3,i*3+3),rl=Math.hypot(...r);if(!rl){r=adjacency[i][0]?.slice(0,3)||[0,1,0];rl=Math.hypot(...r);}
  const sum=[0,0,0];for(const n of adjacency[i])if((r[0]*n[0]+r[1]*n[1]+r[2]*n[2])/(rl*n[3])>=threshold-1e-7)for(let k=0;k<3;k++)sum[k]+=n[k];
  const length=Math.hypot(...sum);if(length)normals.setXYZ(i,sum[0]/length,sum[1]/length,sum[2]/length);else{normals.setXYZ(i,r[0]/rl,r[1]/rl,r[2]/rl);fallbacks++;}
 }
 normals.needsUpdate=true;
 return {vertices:p.count,sharedPositions:groups.size,weighting:'triangle-area',angleDegrees:angle*180/Math.PI,fallbacks};
}
