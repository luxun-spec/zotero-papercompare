import type {State} from './model.ts';
const fail=():never=>{throw new Error('Invalid PaperCompare backup / 无效的 PaperCompare 备份')};
const object=(v:any):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:any):v is string=>typeof v==='string';
const safeID=(v:any):boolean=>text(v)&&v.length>0&&v.length<=200&&!Object.prototype.hasOwnProperty.call(Object.prototype,v)&&v!=='prototype';
function unique(list:any[]) { const ids=new Set(); for(const v of list){if(!object(v)||!safeID(v.id)||ids.has(v.id))fail();ids.add(v.id)} }
export function validateState(value:unknown):State {
  const v:any=value;
  if(!object(v)||v.schemaVersion!==1||!Array.isArray(v.comparisons))fail();
  unique(v.comparisons);
  for(const c of v.comparisons){
    if(!text(c.name)||!c.name.trim()||!text(c.createdAt)||!text(c.updatedAt)||!Array.isArray(c.fields)||!Array.isArray(c.rows))fail();
    unique(c.fields); unique(c.rows);
    const fields=new Set(c.fields.map((f:any)=>f.id));
    for(const f of c.fields)if(!text(f.name)||!f.name.trim())fail();
    for(const r of c.rows){
      if(!text(r.name)||!r.name.trim()||!object(r.paper)||!Number.isSafeInteger(r.paper.libraryID)||r.paper.libraryID<1||!text(r.paper.itemKey)||!/^[A-Z0-9]{8}$/.test(r.paper.itemKey)||!text(r.paper.title)||!object(r.cells))fail();
      if(r.paper.author!==undefined&&!text(r.paper.author)||r.paper.year!==undefined&&!text(r.paper.year))fail();
      for(const [key,cell]of Object.entries(r.cells) as [string,any][]){
        if(!fields.has(key)||!object(cell)||!text(cell.value)||!Array.isArray(cell.evidence))fail();
        unique(cell.evidence);
        for(const e of cell.evidence)if(!['attachmentKey','annotationKey','quote','pageLabel','position'].every(k=>text(e[k]))||!(/^[A-Z0-9]{8}$/).test(e.attachmentKey)||!(/^[A-Z0-9]{8}$/).test(e.annotationKey))fail();
      }
    }
  }
  // Strip inherited properties and detach external objects before use.
  return JSON.parse(JSON.stringify(v));
}
