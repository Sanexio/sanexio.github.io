import {mountAvatarShell} from './explore-shell.js';
import {previewView} from './preview-view.js';
export async function createAvatarView(host,options={}){
 performance.mark('dht-avatar-scripts');
 mountAvatarShell(host);
 let preview;try{preview=await previewView(host,options);}catch(e){host.dataset.previewError=e.message;if(options.signal?.aborted)throw e;}
 // Yield through a paint before importing/compiling the detailed renderer.
 if(preview)await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
 if(options.signal?.aborted){preview?.dispose();throw options.signal.reason;}
 const {createAvatarView:createDetail}=await import('./detail-view.js');
 try{return await createDetail(host,{...options,preview});}catch(e){preview?.dispose();throw e;}
}
