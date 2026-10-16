import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {Controller} from '../src/ui/controller.ts';
import {Store} from '../src/core/storage.ts';
import {createComparison,addRow,setCell} from '../src/core/model.ts';
const pause=()=>new Promise(resolve=>setTimeout(resolve,15));
test('UI creates a table, records experiments and evidence, exports and reloads',async()=>{
 const {window:w,document:d}=parseHTML('<html><body><div id="app"></div></body></html>');
 (w as any).confirm=()=>true;
 const files=new Map<string,string>();
 const store=new Store({read:async p=>files.get(p)!,exists:async p=>files.has(p),writeAtomic:async(p,t)=>{files.set(p,t)}},'state');
 const exports:Record<string,string>={};const errors:unknown[]=[];
 const paper={libraryID:1,itemKey:'ABCDEFGH',title:'Synthetic Paper'};
 const evidence=[{id:'e1',attachmentKey:'PDFABCDE',annotationKey:'ANNABCDE',quote:'GPU 40GB',pageLabel:'1',position:'{}'},{id:'e2',attachmentKey:'PDFABCDE',annotationKey:'ANOTHERX',quote:'100 tokens/s',pageLabel:'2',position:'{}'}];
 const c=new Controller(w as any,{store,language:'zh-CN',library:{selectedPapers:async()=>[paper],annotations:async()=>evidence,locate:async()=>{}},saveFile:async(text,name)=>{exports[name]=text;return true},openFile:async()=>exports['papercompare-backup.json'],report:e=>errors.push(e)});
 await c.init();
 async function click(text:string){const b=Array.from(d.querySelectorAll('button')).find(b=>b.textContent===text);assert.ok(b,`Missing button ${text}`);b.click();await pause()}
 await click('+ 新建对比表');(d.querySelector('.dialog input') as any).value='Compare';d.querySelector('.dialog option')!.setAttribute('selected','');await click('创建');
 await click('加入文库中选中的论文');
 const cell=d.querySelector('button[aria-label="实验 1 · GPU 配置: 尚未记录"]');assert.ok(cell);(cell as any).click();await pause();
 const input=d.querySelector('textarea')!;input.value='40 GB';input.dispatchEvent(new w.Event('input',{bubbles:true}));
 await click('关联 PDF 高亮批注');
 for(const box of d.querySelectorAll('.dialog input[type="checkbox"]') as any){box.checked=true;box.dispatchEvent(new w.Event('change',{bubbles:true}))}
 await click('完成');
 let table=c.state.comparisons[0];assert.equal(table.rows[0].cells[table.fields[1].id].value,'40 GB');assert.equal(table.rows[0].cells[table.fields[1].id].evidence.length,2);
 await click('Markdown');await click('CSV');await click('JSON 备份');assert.match(exports['papercompare.md'],/40 GB/);
 await click('导入 JSON');assert.equal(c.state.comparisons.length,2);
 const reloaded=await store.load();assert.equal(reloaded.comparisons[0].rows[0].cells[table.fields[1].id].evidence.length,2);
 assert.deepEqual(errors,[]);
});
test('evidence selection preserves text edited while annotations were loading',async()=>{
 const {window:w,document:d}=parseHTML('<html><body><div id="app"></div></body></html>');(w as any).confirm=()=>true;
 const paper={libraryID:1,itemKey:'ABCDEFGH',title:'Paper'};
 let table=addRow(createComparison('Test','general','en'),paper,'Run');
 table=setCell(table,table.rows[0].id,table.fields[0].id,{value:'OLD',evidence:[]});
 let file=JSON.stringify({schemaVersion:1,comparisons:[table]});const store=new Store({exists:async()=>true,read:async()=>file,writeAtomic:async(_p,t)=>{file=t}},'state');
 let resolve!:(v:any[])=>void;const loading=new Promise<any[]>(r=>resolve=r);
 const c=new Controller(w as any,{store,language:'en',library:{selectedPapers:async()=>[],annotations:()=>loading,locate:async()=>{}},saveFile:async()=>true,openFile:async()=>null,report:()=>{}});await c.init();
 const click=async(text:string)=>{Array.from(d.querySelectorAll('button')).find(b=>b.textContent===text)!.click();await pause()};
 (d.querySelector('button[aria-label="Run · Research question: OLD"]') as any).click();await pause();await click('Add PDF highlights');
 const text=d.querySelector('textarea')!;text.value='NEW';text.dispatchEvent(new w.Event('input',{bubbles:true}));
 resolve([{id:'e1',attachmentKey:'PDFABCDE',annotationKey:'ANNABCDE',quote:'quote',pageLabel:'1',position:'{}'}]);await pause();
 const checkbox=d.querySelector('.dialog input') as any;checkbox.checked=true;checkbox.dispatchEvent(new w.Event('change',{bubbles:true}));await click('Done');
 assert.equal(c.state.comparisons[0].rows[0].cells[table.fields[0].id].value,'NEW');
});
