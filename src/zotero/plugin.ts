import {Store} from '../core/storage.ts';
import {createLibraryPort,createFilePort} from './adapter.ts';
import {Controller} from '../ui/controller.ts';
declare const Zotero:any,Services:any,IOUtils:any,PathUtils:any,ChromeUtils:any,Components:any;
let root='';let store:Store;let view:any;let controller:Controller|undefined;
const menus=new Map<any,Element>();
let chromeHandle:any;
let generation=0;let cancelLoad:(()=>void)|undefined;let opening:Promise<any>|undefined;
export async function start(rootURI:string){
 root=rootURI;
 const startup=Components.classes['@mozilla.org/addons/addon-manager-startup;1'].getService(Components.interfaces.amIAddonManagerStartup);
 chromeHandle=startup.registerChrome(Services.io.newURI(root+'manifest.json'),[['content','papercompare','content/']]);
 store=new Store(createFilePort(IOUtils),PathUtils.join(Zotero.DataDirectory.dir,'papercompare.json'));
 for(const w of Zotero.getMainWindows())attach(w);
 // Test-only hook: executes a local script only in the explicitly isolated development profile.
 // It is not present in distributed builds (replaced by esbuild constant).
 if(TEST_BUILD){const script=PathUtils.join(Zotero.Profile.dir,'papercompare-test.js');if(await IOUtils.exists(script)){
   await new Function('api','Zotero','IOUtils','PathUtils',`return (async()=>{${await IOUtils.readUTF8(script)}})()` )({open,store},Zotero,IOUtils,PathUtils);
 }}
}
declare const TEST_BUILD:boolean;
export function attach(win:any){
 if(menus.has(win))return;
 const popup=win.document.getElementById('menu_ToolsPopup');if(!popup)return;
 const item=win.document.createXULElement('menuitem');item.id='papercompare-menu';item.setAttribute('label','PaperCompare');item.addEventListener('command',()=>open().catch((e:any)=>Zotero.logError(e)));popup.append(item);menus.set(win,item);
}
export function detach(win:any){menus.get(win)?.remove();menus.delete(win)}
export function open():Promise<any>{
 if(opening)return opening;
 if(view&&!view.closed&&controller){view.focus();return Promise.resolve({window:view,controller})}
 const token=generation;const task=initializeWindow(token);opening=task;
 task.finally(()=>{if(opening===task)opening=undefined}).catch(()=>{});
 return task;
}
async function initializeWindow(token:number){
 const opened=Services.ww.openWindow(Zotero.getMainWindow(),'chrome://papercompare/content/compare.xhtml','papercompare','chrome,centerscreen,resizable,width=1260,height=850',null);view=opened;
 await new Promise<void>((resolve,reject)=>{
  const loaded=()=>{cancelLoad=undefined;resolve()};
  cancelLoad=()=>{opened.removeEventListener('load',loaded);reject(Error('Window opening cancelled / 窗口加载已取消'))};
  opened.addEventListener('load',loaded,{once:true});
 });
 if(token!==generation||opened.closed)throw Error('Window opening cancelled');
 const link=view.document.createElementNS('http://www.w3.org/1999/xhtml','link');link.rel='stylesheet';link.href=root+'content/compare.css';view.document.head.append(link);
 const language=Zotero.locale||'en';
 const {FilePicker}=ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs');
 controller=new Controller(view,{
  store,language,library:createLibraryPort(Zotero),report:e=>Zotero.logError(e),
  async saveFile(text,name){const fp=new FilePicker();fp.init(view,name,fp.modeSave);fp.defaultString=name;fp.appendFilter(name.split('.').at(-1),'*.'+name.split('.').at(-1));if(await fp.show()===fp.returnCancel)return false;await IOUtils.writeUTF8(fp.file,text,{tmpPath:fp.file+'.tmp',flush:true});return true},
  async openFile(){const fp=new FilePicker();fp.init(view,language.startsWith('zh')?'导入 JSON 备份':'Import JSON backup',fp.modeOpen);fp.appendFilter('JSON','*.json');if(await fp.show()===fp.returnCancel)return null;return IOUtils.readUTF8(fp.file)}
 });
 await controller.init();if(token!==generation||opened.closed)throw Error('Window opening cancelled');return {window:view,controller};
}
export async function stop(){
 generation++;cancelLoad?.();cancelLoad=undefined;
 try{
  await store?.drain();
  if(controller&&!controller.canClose()){
   const path=PathUtils.join(Zotero.DataDirectory.dir,'papercompare-recovery-draft.json');
   await IOUtils.writeUTF8(path,JSON.stringify(controller.state,null,2),{tmpPath:path+'.tmp',flush:true});
  }
 }catch(error){Zotero.logError(error)}
 finally{
  for(const w of menus.keys())detach(w);
  if(controller){controller.dirty=false;controller.busy=false}
  try{if(view&&!view.closed)view.close()}catch(error){Zotero.logError(error)}
  view=null;controller=undefined;
  chromeHandle?.destruct();chromeHandle=null;opening=undefined;
 }
}
