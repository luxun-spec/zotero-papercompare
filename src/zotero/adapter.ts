import type {PaperRef,Evidence} from '../core/model.ts';
import type {FilePort} from '../core/storage.ts';
export interface LibraryPort {selectedPapers():Promise<PaperRef[]>;annotations(paper:PaperRef):Promise<Evidence[]>;locate(paper:PaperRef,evidence:Evidence):Promise<void>}
export function createLibraryPort(z:any):LibraryPort{
 return {
  async selectedPapers(){
   const selected=z.getMainWindow()?.ZoteroPane?.getSelectedItems()??[];const result:PaperRef[]=[];
   for(let item of selected){
    if(!item.isRegularItem()){
     if(!item.parentID)throw Error('Attach this PDF to a parent paper first / 请先将此 PDF 关联到父文献条目');
     item=await z.Items.getAsync(item.parentID);
    }
    if(!item||item.deleted||!item.isRegularItem())continue;
    if(result.some(p=>p.libraryID===item.libraryID&&p.itemKey===item.key))continue;
    result.push({libraryID:item.libraryID,itemKey:item.key,title:item.getField('title')||item.key,author:item.firstCreator||'',year:(item.getField('date')||'').slice(0,4)});
   }
   if(!result.length)throw Error('Select papers in the Zotero library first / 请先在 Zotero 文库中选中文献');
   return result;
  },
  async annotations(paper){
   // Zotero 10: getAnnotations(false,true) explicitly requests IDs (default is objects).
   const item=await z.Items.getByLibraryAndKeyAsync(paper.libraryID,paper.itemKey);
   if(!item||item.deleted)throw Error('Paper is missing / 原文献已不存在');
   const evidence:Evidence[]=[];
   for(const attachmentID of item.getAttachments()){
    const a=await z.Items.getAsync(attachmentID);
    if(!a||a.deleted||a.attachmentContentType!=='application/pdf')continue;
    for(const annotationID of a.getAnnotations(false,true)){
     const n=await z.Items.getAsync(annotationID);
     if(!n||n.deleted||n.annotationType!=='highlight'||!n.annotationText)continue;
     evidence.push({id:`${a.key}-${n.key}`,attachmentKey:a.key,annotationKey:n.key,quote:n.annotationText,pageLabel:n.annotationPageLabel||'',position:n.annotationPosition||''});
    }
   }
   return evidence;
  },
  async locate(paper,e){
   const a=await z.Items.getByLibraryAndKeyAsync(paper.libraryID,e.attachmentKey);
   const n=await z.Items.getByLibraryAndKeyAsync(paper.libraryID,e.annotationKey);
   const parent=await z.Items.getByLibraryAndKeyAsync(paper.libraryID,paper.itemKey);
   if(!a||a.deleted||!n||n.deleted||!parent||parent.deleted||a.parentID!==parent.id||n.parentID!==a.id||!a.isPDFAttachment()||!n.isAnnotation()||!await a.getFilePathAsync())throw Error('Source PDF or annotation is unavailable; the saved quote is preserved / 原 PDF 或批注已失效，摘录快照仍保留');
   // reader.js open(itemID, location, options); location.annotationID is the key.
   await z.Reader.open(a.id,{annotationID:n.key});
  }
 };
}
export function createFilePort(io:any):FilePort {
 return {read:p=>io.readUTF8(p),exists:p=>io.exists(p),writeAtomic:async(p,t)=>{await io.writeUTF8(p,t,{tmpPath:p+'.tmp',flush:true})}};
}
