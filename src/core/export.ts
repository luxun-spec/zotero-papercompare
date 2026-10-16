import {id,type Comparison,type State,type PaperRef,type Evidence} from './model.ts';
import {validateState} from './validate.ts';
const md=(v:string)=>v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\/g,'\\\\').replace(/\|/g,'\\|').replace(/\[/g,'\\[').replace(/\]/g,'\\]').replace(/\*/g,'\\*').replace(/_/g,'\\_').replace(/`/g,'\\`').replace(/\r?\n/g,'<br>');
export function evidenceLink(paper:PaperRef,e:Evidence):string {
 // Personal libraries have a stable URI namespace. Group library IDs are local,
 // not group IDs, so do not generate an incorrect cross-machine group URI.
 return paper.libraryID===1 ? `zotero://open-pdf/library/items/${e.attachmentKey}?annotation=${e.annotationKey}` : '';
}
export function toCSV(c:Comparison):string{
 const quote=(s:string)=>{
   const safe=/^[\s\u0000-\u001f]*[=+@-]/.test(s)||/^[\t\r\n]/.test(s) ? "'"+s : s;
   return '"'+safe.replace(/"/g,'""')+'"';
 };
 const rows=[['Paper','Experiment',...c.fields.map(f=>f.name)],...c.rows.map(r=>[r.paper.title,r.name,...c.fields.map(f=>r.cells[f.id]?.value??'')])];
 return '\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n');
}
export function toMarkdown(c:Comparison):string{
 const lines=[`# ${md(c.name)}`,'','| Paper | Experiment | '+c.fields.map(f=>md(f.name)).join(' | ')+' |','| --- | --- | '+c.fields.map(()=>'---').join(' | ')+' |'];
 for(const r of c.rows)lines.push('| '+[r.paper.title,r.name,...c.fields.map(f=>r.cells[f.id]?.value??'')].map(md).join(' | ')+' |');
 lines.push('','## Evidence','');
 for(const r of c.rows)for(const f of c.fields)for(const e of r.cells[f.id]?.evidence??[]){
   const link=evidenceLink(r.paper,e); const label=`${md(r.paper.title)} — ${md(r.name)} / ${md(f.name)} · p. ${md(e.pageLabel)}`;
   lines.push(`- ${link?`[${label}](${link})`:label}: ${md(e.quote)}`);
 }
 return lines.join('\n');
}
export const exportBackup=(s:State):string=>JSON.stringify(validateState(s),null,2);
export function importBackup(text:string,existing:State):State{
 const incoming=validateState(JSON.parse(text));
 const comparisons=incoming.comparisons.map(c=>({...c,id:id(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),rows:c.rows.map(r=>({...r,id:id()}))}));
 return validateState({...existing,comparisons:[...existing.comparisons,...comparisons]});
}
