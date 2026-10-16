import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLibraryPort} from '../src/zotero/adapter.ts';
const parent={id:1,key:'PAPERABC',libraryID:2,deleted:false,isRegularItem:()=>true,getField:(n:string)=>n==='title'?'Paper':'2023',firstCreator:'Doe',getAttachments:()=>[2]};
const attachment={id:2,key:'PDFABCDE',libraryID:2,parentID:1,deleted:false,isRegularItem:()=>false,isAttachment:()=>true,isPDFAttachment:()=>true,getAnnotations:(_trash?:boolean,asIDs?:boolean)=>asIDs?[3]:[annotation],attachmentContentType:'application/pdf',getFilePathAsync:async()=>'/exists.pdf'};
const annotation={id:3,key:'ANNABCDE',libraryID:2,parentID:2,deleted:false,annotationType:'highlight',annotationText:'Evidence text',annotationPageLabel:'7',annotationPosition:'{"pageIndex":6}',isAnnotation:()=>true};
function setup(){const items:any[]=[parent,attachment,annotation]; const calls:any[]=[];return {items,calls,z:{getMainWindow:()=>({ZoteroPane:{getSelectedItems:()=>[attachment]}}),Items:{getAsync:async(id:number)=>items.find(i=>i.id===id),getByLibraryAndKeyAsync:async(l:number,k:string)=>items.find(i=>i.libraryID===l&&i.key===k)},Reader:{open:async(...a:any[])=>calls.push(a)}}}}
test('selected attachments normalize to parent; library IDs scope evidence',async()=>{
 const {z,calls}=setup();const port=createLibraryPort(z);const [paper]=await port.selectedPapers();
 assert.equal(paper.itemKey,'PAPERABC');assert.equal(paper.libraryID,2);
 const [e]=await port.annotations(paper);assert.equal(e.quote,'Evidence text');
 await port.locate(paper,e);assert.equal(calls[0][0],2);assert.deepEqual(calls[0][1],{annotationID:'ANNABCDE'});
 await assert.rejects(port.locate({...paper,libraryID:1},e));
});
test('missing/deleted annotations and unrelated attachments refuse location without changing snapshot',async()=>{
 const {z,items}=setup();const port=createLibraryPort(z);const [paper]=await port.selectedPapers();const [e]=await port.annotations(paper);
 const saved=JSON.stringify(e);items[2]={...annotation,deleted:true};await assert.rejects(port.locate(paper,e));assert.equal(JSON.stringify(e),saved);
 items[2]=annotation;items[1]={...attachment,parentID:999};await assert.rejects(port.locate(paper,e));
});
test('standalone attachment gives actionable error',async()=>{
 const {z,items}=setup();items[1]={...attachment,parentID:false};z.getMainWindow=()=>({ZoteroPane:{getSelectedItems:()=>[items[1]]}});
 await assert.rejects(createLibraryPort(z).selectedPapers(),/parent|父/);
});
