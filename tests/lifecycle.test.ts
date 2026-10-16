import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const bundled=buildSync({entryPoints:['src/zotero/plugin.ts'],bundle:true,write:false,format:'iife',globalName:'api',define:{TEST_BUILD:'false'},target:'es2022'}).outputFiles[0].text;
function setup(load:boolean){
 const {window:w,document:d}=parseHTML('<html><head></head><body><div id="app"></div></body></html>');
 const {document:mainDocument}=parseHTML('<html><body><div id="menu_ToolsPopup"></div></body></html>');(mainDocument as any).createXULElement=(tag:string)=>mainDocument.createElement(tag);
 let closed=false,destructed=false;const errors:unknown[]=[];
 const fake:any={document:d,addEventListener:(name:string,cb:()=>void)=>{if(name==='load'&&load)queueMicrotask(cb)},removeEventListener:()=>{},closed:false,close:()=>{closed=true;fake.closed=true},confirm:()=>true};
 const sandbox:any={crypto,structuredClone,console,TEST_BUILD:false,Components:{classes:{'@mozilla.org/addons/addon-manager-startup;1':{getService:()=>({registerChrome:()=>({destruct:()=>{destructed=true}})})}},interfaces:{amIAddonManagerStartup:{}}},Services:{io:{newURI:(s:string)=>s},ww:{openWindow:()=>fake}},Zotero:{getMainWindows:()=>[{document:mainDocument}],getMainWindow:()=>({document:mainDocument}),DataDirectory:{dir:'/test'},locale:'en',logError:(e:unknown)=>errors.push(e)},IOUtils:{exists:async()=>false,readUTF8:async()=>'',writeUTF8:async()=>{throw Error('disk full')}},PathUtils:{join:(...s:string[])=>s.join('/')},ChromeUtils:{importESModule:()=>({FilePicker:class{}})}};
 vm.createContext(sandbox);vm.runInContext(bundled,sandbox);
 return {api:sandbox.api,document:mainDocument,errors,isClosed:()=>closed,isDestructed:()=>destructed};
}
test('disable during window loading cancels open and clears menu/window/resources',async()=>{
 const env=setup(false);await env.api.start('file:///test/');const opening=env.api.open().catch(()=>null);await env.api.stop();
 assert.equal(env.isClosed(),true);assert.equal(env.isDestructed(),true);assert.equal(env.document.getElementById('papercompare-menu'),null);await opening;
});
test('recovery write failure still cleans up and reports the failed draft',async()=>{
 const env=setup(true);await env.api.start('file:///test/');const {controller}=await env.api.open();controller.dirty=true;
 await env.api.stop();assert.equal(env.isClosed(),true);assert.equal(env.isDestructed(),true);assert.equal(env.errors.length,1);
});
