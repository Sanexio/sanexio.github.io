/** CPU first paint from the same local hull; WebGL is initialized after this image. */
export async function previewView(host,{signal}={}){
 const canvas=document.createElement('canvas');canvas.id='avatar-canvas';canvas.setAttribute('aria-label','Körper wird vorbereitet');canvas.tabIndex=0;
 const viewport=host.querySelector('.avatar-viewport')||document.createElement('div');viewport.classList.add('avatar-viewport');viewport.prepend(canvas);if(!viewport.parentElement)host.append(viewport);
 viewport.style.background='radial-gradient(ellipse at 45% 26%, #426b80 0%, #294d66 57%, #183649 100%)';
 const response=await fetch(new URL('assets/male-preview.bin',import.meta.url),{signal});if(!response.ok)throw Error('Startfigur fehlt');const data=await response.arrayBuffer(),header=new Uint32Array(data,0,2),count=header[0],faces=header[1];
 const p=new Float32Array(data,8,count*3),n=new Float32Array(data,8+count*12,count*3),indices=new Uint16Array(data,8+count*24,faces);
 performance.mark('dht-preview-geometry');
 const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Startbild nicht verfügbar');
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<p.length;i++){const k=i%3;min[k]=Math.min(min[k],p[i]);max[k]=Math.max(max[k],p[i]);}
 const center=min.map((v,k)=>(v+max[k])/2);let angle=0,stopped=false;
 function draw(){
  if(stopped)return;
  const ratio=Math.min(.75,640/Math.max(viewport.clientWidth,viewport.clientHeight)),w=Math.max(1,Math.round(viewport.clientWidth*ratio)),h=Math.max(1,Math.round(viewport.clientHeight*ratio));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}else ctx.clearRect(0,0,w,h);
  const aspect=w/h,distance=Math.max(max[1]-min[1],(max[0]-min[0])/aspect,max[2]-min[2])*3.27085/2*1.12,s=Math.sin(angle),c=Math.cos(angle),vertices=[];
  for(let i=0;i<count;i++){const x=p[i*3]-center[0],y=p[i*3+1]-center[1],z=p[i*3+2]-center[2],depth=distance-(-s*x+c*z);vertices.push([(c*x+s*z)*3.27085/aspect/depth*w/2+w/2,h/2-y*3.27085/depth*h/2,depth]);}
  const image=ctx.createImageData(w,h),pixels=image.data,depths=new Float32Array(w*h);depths.fill(Infinity);
  for(let i=0;i<faces;i+=3){const ids=[indices[i],indices[i+1],indices[i+2]],a=vertices[ids[0]],b=vertices[ids[1]],d=vertices[ids[2]];
   let nx=0,ny=0,nz=0;for(const id of ids){nx+=n[id*3];ny+=n[id*3+1];nz+=n[id*3+2];}const length=Math.hypot(nx,ny,nz)||1,light=.72+.28*Math.max((-.371*(c*nx+s*nz)+.557*ny+.743*(-s*nx+c*nz))/length,0);
   const area=(b[0]-a[0])*(d[1]-a[1])-(b[1]-a[1])*(d[0]-a[0]);if(Math.abs(area)<.001)continue;
   const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],d[0]))),x1=Math.min(w-1,Math.ceil(Math.max(a[0],b[0],d[0]))),y0=Math.max(0,Math.floor(Math.min(a[1],b[1],d[1]))),y1=Math.min(h-1,Math.ceil(Math.max(a[1],b[1],d[1])));
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const u=((b[0]-x-.5)*(d[1]-y-.5)-(b[1]-y-.5)*(d[0]-x-.5))/area,v=((d[0]-x-.5)*(a[1]-y-.5)-(d[1]-y-.5)*(a[0]-x-.5))/area,t=1-u-v;if(u<0||v<0||t<0)continue;
    const depth=u*a[2]+v*b[2]+t*d[2],j=y*w+x;if(depth>=depths[j])continue;depths[j]=depth;
    pixels[j*4]=37*light;pixels[j*4+1]=142*light;pixels[j*4+2]=198*light;pixels[j*4+3]=230;
   }
  }
  ctx.putImageData(image,0,0);
 }
 performance.mark('dht-preview-built');const started=performance.now();draw();const lowPower=performance.now()-started>250;
 const resize=new ResizeObserver(draw);resize.observe(viewport);host.dataset.preview='true';performance.mark('dht-figure-visible');
 let frame;const start=performance.now();if(!matchMedia('(prefers-reduced-motion: reduce)').matches){const tick=t=>{if(stopped)return;angle=Math.sin(Math.min(1,(t-start)/2200)*Math.PI/2)*.18;draw();if(t-start<2200)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);}
 return {viewport,canvas,lowPower,geometry:{positions:p,normals:n,indices},get angle(){return angle;},freeze(){cancelAnimationFrame(frame);},dispose(){stopped=true;cancelAnimationFrame(frame);resize.disconnect();canvas.remove();}};
}
