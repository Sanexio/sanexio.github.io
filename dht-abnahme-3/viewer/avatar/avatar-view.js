import {mountAvatarShell,previewView} from './startup.js';
export async function createAvatarView(host,options={}){
 performance.mark('dht-avatar-scripts');
 if(!options.initialPreview)mountAvatarShell(host);
 let preview;try{preview=await (options.initialPreview || previewView(host,options));}catch(e){host.dataset.previewError=e.message;if(options.signal?.aborted)throw e;}
 // Yield through a paint before importing/compiling the detailed renderer.
 if(preview)await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
 if(options.signal?.aborted){preview?.dispose();throw options.signal.reason;}
 const {createAvatarView:createDetail}=await import('./detail-view.js');
 try{return await createDetail(host,{...options,preview});}catch(e){preview?.dispose();throw e;}
}
