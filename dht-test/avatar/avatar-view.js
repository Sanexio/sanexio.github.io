import {mountAvatarShell} from './explore-shell.js';
import {previewView} from './preview-view.js';
export async function createAvatarView(host,options={}){
 mountAvatarShell(host);
 let preview;try{preview=await previewView(host,options);}catch(e){host.dataset.previewError=e.message;if(options.signal?.aborted)throw e;}
 const {createAvatarView:createDetail}=await import('./detail-view.js');
 try{return await createDetail(host,{...options,preview});}catch(e){preview?.dispose();throw e;}
}
