import {createComparison,addRow,setCell,addField,removeField,removeRow,id,emptyState,type State,type Comparison,type Template,type Cell} from '../core/model.ts';
import {exportBackup,importBackup,toCSV,toMarkdown} from '../core/export.ts';
import type {Store} from '../core/storage.ts';
import type {LibraryPort} from '../zotero/adapter.ts';
import {messages,type Messages} from './i18n.ts';
export interface UIHost {store:Store;library:LibraryPort;language:string;saveFile(text:string,name:string):Promise<boolean>;openFile():Promise<string|null>;report(error:unknown):void}
export class Controller {
 state:State=emptyState(); saved:State=emptyState(); dirty=false; blocked=false; busy=false;
 private current='';private row='';private field='';private dialog:HTMLElement|null=null;
 private win:Window;private doc:Document;private host:UIHost;private t:Messages;
 constructor(win:Window,host:UIHost){this.win=win;this.doc=win.document;this.host=host;this.t=messages(host.language)}
 private node<K extends keyof HTMLElementTagNameMap>(tag:K,text='',cls=''):HTMLElementTagNameMap[K]{const e=this.doc.createElementNS('http://www.w3.org/1999/xhtml',tag) as HTMLElementTagNameMap[K];e.textContent=text;if(cls)e.className=cls;return e}
 private button(text:string,action:()=>unknown,cls=''):HTMLButtonElement{const b=this.node('button',text,cls);b.type='button';b.disabled=this.busy;b.addEventListener('click',()=>{if(this.busy)return;Promise.resolve().then(action).catch(e=>this.error(e))});return b}
 private error(e:unknown){this.host.report(e);this.status(`${this.t.error}: ${e instanceof Error?e.message:String(e)}`,true)}
 private status(text:string,error=false){const el=this.doc.getElementById('status');if(el){el.textContent=text;el.className=error?'status error':'status';el.setAttribute('role',error?'alert':'status')}}
 private table():Comparison|undefined{return this.state.comparisons.find(c=>c.id===this.current)}
 private selected(){const c=this.table();const r=c?.rows.find(r=>r.id===this.row);const f=c?.fields.find(f=>f.id===this.field);return {c,r,f}}
 async init(){
  this.doc.documentElement.lang=this.host.language;
  this.win.addEventListener('beforeunload',event=>{if(this.dirty||this.busy){event.preventDefault();event.returnValue='';}});
  try{this.state=await this.host.store.load();this.saved=structuredClone(this.state)}catch(e){this.blocked=true;this.host.report(e)}
  this.current=this.state.comparisons[0]?.id??'';this.render();
 }
 async persist(){
  if(this.blocked)throw Error(this.t.readOnly);
  this.busy=true;this.render();this.status(this.t.saving);
  try{await this.host.store.save(this.state);this.saved=structuredClone(this.state);this.dirty=false;this.busy=false;this.render();this.status(this.t.saved)}
  catch(e){this.dirty=true;this.busy=false;this.render();this.status(this.t.saveFailed+' '+String(e),true);this.host.report(e)}
 }
 private async change(c:Comparison){this.state={...this.state,comparisons:this.state.comparisons.map(x=>x.id===c.id?c:x)};this.dirty=true;await this.persist()}
 private async discardGuard():Promise<boolean>{return !this.dirty||this.win.confirm(this.t.unsaved)}
 private closeDialog(){this.dialog?.remove();this.dialog=null}
 private modal(title:string){
  this.closeDialog();const overlay=this.node('div','','overlay');const box=this.node('section','','dialog');box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label',title);box.tabIndex=-1;
  box.append(this.node('h2',title));overlay.append(box);this.doc.body.append(overlay);this.dialog=overlay;
  overlay.addEventListener('keydown',e=>{if(e.key==='Escape')this.closeDialog();if(e.key==='Tab'){const controls=Array.from(box.querySelectorAll<HTMLElement>('button,input,select,textarea,[tabindex="0"]')).filter(x=>!x.hasAttribute('disabled'));const first=controls[0],last=controls.at(-1);if(e.shiftKey&&this.doc.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&this.doc.activeElement===last){e.preventDefault();first?.focus()}}});
  box.focus();return box;
 }
 private ask(title:string,initial:string,submit:(value:string)=>Promise<unknown>){
  const box=this.modal(title);const input=this.node('input');input.value=initial;input.setAttribute('aria-label',title);const act=this.button(this.t.save,async()=>{if(!input.value.trim())return;this.closeDialog();await submit(input.value.trim())},'primary');
  box.append(input,act,this.button(this.t.cancel,()=>this.closeDialog()));input.addEventListener('keydown',e=>{if(e.key==='Enter')act.click()});input.focus();input.select();
 }
 private newComparison(){
  const box=this.modal(this.t.newTable);const input=this.node('input');input.placeholder=this.t.name;input.setAttribute('aria-label',this.t.name);
  const select=this.node('select');select.setAttribute('aria-label',this.t.template);
  for(const [value,label] of [['ai-infra',this.t.infra],['general',this.t.general],['custom',this.t.custom]]){const option=this.node('option',label);option.value=value;select.append(option)}
  box.append(input,select,this.button(this.t.create,async()=>{if(!input.value.trim())return;const c=createComparison(input.value,select.value as Template,this.host.language);this.state={...this.state,comparisons:[...this.state.comparisons,c]};this.current=c.id;this.row='';this.field='';this.dirty=true;this.closeDialog();await this.persist()},'primary'),this.button(this.t.cancel,()=>this.closeDialog()));input.focus();
 }
 private async addSelected(){const c=this.table();if(!c)return;const papers=await this.host.library.selectedPapers();let next=c;for(const p of papers)if(!next.rows.some(r=>r.paper.libraryID===p.libraryID&&r.paper.itemKey===p.itemKey))next=addRow(next,p,this.t.experiment+' 1');await this.change(next)}
 private async chooseEvidence(){
  const {c,r,f}=this.selected();if(!c||!r||!f)return;
  const evidence=await this.host.library.annotations(r.paper);
  if(this.current!==c.id||this.row!==r.id||this.field!==f.id)return;
  const box=this.modal(this.t.pick);
  if(!evidence.length)box.append(this.node('p',this.t.noHighlights));
  const list=this.node('div','','highlight-list');const cell=r.cells[f.id]??{value:'',evidence:[]};const chosen=new Set<string>();
  for(const e of evidence){const label=this.node('label','','highlight');const check=this.node('input');check.type='checkbox';check.checked=cell.evidence.some(x=>x.id===e.id);check.disabled=check.checked;check.addEventListener('change',()=>check.checked?chosen.add(e.id):chosen.delete(e.id));label.append(check,this.node('span',`${this.t.page} ${e.pageLabel} · ${e.quote}`));list.append(label)}
  box.append(list,this.button(this.t.done,async()=>{
   this.closeDialog();
   const live=this.state.comparisons.find(x=>x.id===c.id);const liveRow=live?.rows.find(x=>x.id===r.id);
   if(!live||!liveRow||!live.fields.some(x=>x.id===f.id))throw Error('This cell no longer exists / 此单元格已不存在');
   const current=liveRow.cells[f.id]??{value:'',evidence:[]};
   await this.change(setCell(live,r.id,f.id,{...current,evidence:[...current.evidence,...evidence.filter(e=>chosen.has(e.id)&&!current.evidence.some(x=>x.id===e.id))]}));
  },'primary'),this.button(this.t.cancel,()=>this.closeDialog()));
 }
 render(){
  const root=this.doc.getElementById('app')!;root.replaceChildren();
  const shell=this.node('div','','shell');const side=this.node('aside');side.append(this.node('h1','PaperCompare'),this.node('p',this.t.footer,'muted'),this.button('+ '+this.t.newTable,()=>this.newComparison(),'primary full'));
  for(const c of this.state.comparisons){const b=this.button(c.name,async()=>{if(!await this.discardGuard())return;if(this.dirty){this.state=structuredClone(this.saved);this.dirty=false}this.current=c.id;this.row='';this.field='';this.render()},'table-link'+(c.id===this.current?' active':''));b.disabled=this.busy||this.blocked;side.append(b)}
  const main=this.node('main');const status=this.node('p',this.blocked?this.t.readOnly:this.dirty?this.t.dirty:this.t.saved,'status');status.id='status';status.setAttribute('aria-live','polite');main.append(status);
  const recovery=this.node('div','','toolbar');recovery.append(this.button(this.t.backup,async()=>{await this.host.saveFile(exportBackup(this.saved),'papercompare-backup.json')}),this.button(this.t.import,async()=>{const text=await this.host.openFile();if(text===null)return;this.state=importBackup(text,this.state);this.current=this.state.comparisons.at(-1)?.id??'';this.dirty=true;await this.persist()}));
  if(this.dirty)recovery.append(this.button(this.t.retry,()=>this.persist()),this.button(this.t.draftBackup,()=>this.host.saveFile(exportBackup(this.state),'papercompare-draft.json')));
  if(this.blocked)recovery.append(this.button(this.t.restore,async()=>{if(!this.win.confirm(this.t.restore+'?'))return;this.state=await this.host.store.restoreBackup();this.saved=structuredClone(this.state);this.blocked=false;this.current=this.state.comparisons[0]?.id??'';this.render()}));
  main.append(recovery);
  if(this.blocked){side.querySelectorAll('button').forEach(b=>b.disabled=true);recovery.querySelectorAll('button').forEach((b,i)=>{if(i<2)b.disabled=true});shell.append(side,main);root.append(shell);return}
  const c=this.table();
  if(!c){main.append(this.node('h2',this.t.empty));shell.append(side,main);root.append(shell);return}
  const heading=this.node('div','','heading');heading.append(this.node('h2',c.name),this.button(this.t.rename,()=>this.ask(this.t.name,c.name,async name=>this.change({...c,name,updatedAt:new Date().toISOString()}))),this.button(this.t.delete,async()=>{if(!this.win.confirm(this.t.confirm))return;this.state={...this.state,comparisons:this.state.comparisons.filter(x=>x.id!==c.id)};this.current=this.state.comparisons[0]?.id??'';this.dirty=true;await this.persist()},'danger'));
  main.append(heading);
  const bar=this.node('div','','toolbar');bar.append(this.button(this.t.addPapers,()=>this.addSelected(),'primary'),this.button(this.t.addField,()=>this.ask(this.t.addField,'',async name=>this.change(addField(c,name)))),this.button(this.t.exportMD,()=>this.host.saveFile(toMarkdown(this.saved.comparisons.find(x=>x.id===c.id)!),'papercompare.md')),this.button(this.t.exportCSV,()=>this.host.saveFile(toCSV(this.saved.comparisons.find(x=>x.id===c.id)!),'papercompare.csv')));
  if(this.dirty)bar.querySelectorAll('button').forEach(b=>b.disabled=true);
  main.append(bar,this.node('p',this.t.hint,'muted'));
  const wrap=this.node('div','','grid-wrap');const table=this.node('table');const head=this.node('thead');const hr=this.node('tr');hr.append(this.node('th',this.t.paper),this.node('th',this.t.experiment));
  for(const f of c.fields){const th=this.node('th');th.append(this.node('span',f.name),this.button('✎',()=>this.ask(this.t.renameField,f.name,async name=>this.change({...c,fields:c.fields.map(x=>x.id===f.id?{...x,name}:x)})),'small'),this.button('×',async()=>{if(!this.win.confirm(this.t.confirm))return;this.field='';await this.change(removeField(c,f.id))},'small'));th.querySelectorAll('button')[0].setAttribute('aria-label',this.t.renameField+': '+f.name);th.querySelectorAll('button')[1].setAttribute('aria-label',this.t.removeField+': '+f.name);hr.append(th)}
  head.append(hr);table.append(head);const body=this.node('tbody');
  for(const r of c.rows){const tr=this.node('tr');const paper=this.node('td','','paper');paper.append(this.node('strong',r.paper.title),this.node('p',`${r.paper.author??''} ${r.paper.year??''}`,'muted'));const experiment=this.node('td');experiment.append(this.node('p',r.name),this.button('+',()=>this.ask(this.t.rowName,r.name+' (2)',async name=>this.change(addRow(c,r.paper,name))),'small'),this.button('✎',()=>this.ask(this.t.renameExperiment,r.name,async name=>this.change({...c,rows:c.rows.map(x=>x.id===r.id?{...x,name}:x)})),'small'),this.button('×',async()=>{if(!this.win.confirm(this.t.confirm))return;this.row='';await this.change(removeRow(c,r.id))},'small'));
   experiment.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-label',[this.t.addExperiment,this.t.renameExperiment,this.t.removeRow][i]));tr.append(paper,experiment);
   for(const f of c.fields){const td=this.node('td');const cell=r.cells[f.id];const b=this.button(cell?.value||this.t.notRecorded,()=>{this.row=r.id;this.field=f.id;this.render()},'cell'+(this.row===r.id&&this.field===f.id?' selected':''));b.setAttribute('aria-label',`${r.name} · ${f.name}: ${cell?.value||this.t.notRecorded}`);td.append(b);if(cell?.evidence.length)td.append(this.node('span',`↗ ${cell.evidence.length}`,'badge'));tr.append(td)}
   body.append(tr);
  }
  table.append(body);wrap.append(table);main.append(wrap);if(!c.rows.length)main.append(this.node('p',this.t.noRows,'empty'));
  const editor=this.node('section','','editor');const {r,f}=this.selected();
  if(r&&f){const cell=r.cells[f.id]??{value:'',evidence:[]};editor.append(this.node('h3',`${r.name} · ${f.name}`));const label=this.node('label',this.t.value);const textarea=this.node('textarea');textarea.value=cell.value;textarea.rows=3;textarea.setAttribute('aria-label',this.t.value);textarea.disabled=this.busy;
   textarea.addEventListener('input',()=>{Object.assign(c,setCell(c,r.id,f.id,{...cell,value:textarea.value}));this.dirty=true;this.status(this.t.dirty);});label.append(textarea);editor.append(label,this.button(this.t.save,()=>this.persist(),'primary'));
   const attach=this.button(this.t.addEvidence,()=>this.chooseEvidence());attach.disabled=this.busy;editor.append(attach,this.node('h4',this.t.evidence),this.node('p',this.t.sourceNote,'muted'));
   for(const e of cell.evidence){const card=this.node('article','','evidence');card.append(this.node('p',`${this.t.page} ${e.pageLabel} · ${r.paper.author??''} ${r.paper.year??''}`,'muted'),this.node('blockquote',e.quote),this.button(this.t.locate,()=>this.host.library.locate(r.paper,e)),this.button(this.t.unlink,async()=>{const latest=this.selected();if(!latest.c)return;const current=latest.c.rows.find(x=>x.id===r.id)!.cells[f.id]??cell;await this.change(setCell(latest.c,r.id,f.id,{...current,evidence:current.evidence.filter(x=>x.id!==e.id)}))},'small'));editor.append(card)}
  }else editor.append(this.node('p',this.t.selectCell));
  main.append(editor);shell.append(side,main);root.append(shell);
 }
 canClose(){return !this.dirty&&!this.busy}
}
