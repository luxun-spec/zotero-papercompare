// Development-only integration workflow. Uses synthetic papers in an isolated profile.
const report=PathUtils.join(Zotero.DataDirectory.dir,'integration-result.json');
const write=v=>IOUtils.writeUTF8(report,JSON.stringify(v,null,2));
try {
 await write({stage:'seed-start'});
 const main=Zotero.getMainWindow();await Zotero.uiReadyPromise;
 const papers=[];const pdfPath=PathUtils.join(PathUtils.parent(Zotero.Profile.dir),'synthetic.pdf');
 for(let i=0;i<2;i++){
  let p;for(const candidate of await Zotero.Items.getAll(Zotero.Libraries.userLibraryID,true,false)){if(!candidate.isRegularItem())continue;await candidate.loadAllData();if(candidate.getField('title')===`Synthetic System ${i+1}`){p=candidate;break}}
  if(!p){p=new Zotero.Item('conferencePaper');p.setField('title',`Synthetic System ${i+1}`);p.setField('date','2026');p.setCreators([{firstName:'Test',lastName:'Researcher',creatorType:'author'}]);await p.saveTx()}
  if(!p.getAttachments().length){const attachment=await Zotero.Attachments.importFromFile({file:pdfPath,parentItemID:p.id});for(let j=0;j<2;j++)await Zotero.Annotations.saveFromJSON(attachment,{key:Zotero.DataObjectUtilities.generateKey(),type:'highlight',text:j?'Throughput: 100 tokens/s.':'GPU: A100 40GB.',comment:'',color:'#ffd400',pageLabel:'1',sortIndex:`00000|00000${j}|00000`,position:{pageIndex:0,rects:[[72+j*100,760,170+j*100,775]]}})}
  papers.push(p);
 }
 await main.ZoteroPane.selectItems(papers.map(p=>p.id));await write({stage:'selected'});
 const {window:w,controller:c}=await api.open();const d=w.document;
 const pause=ms=>new Promise(r=>main.setTimeout(r,ms));
 const wait=async(pred,label)=>{for(let i=0;i<100;i++){if(await pred())return;await pause(100)}throw Error('Timeout: '+label)};
 const click=async text=>{const b=Array.from(d.querySelectorAll('button')).find(x=>x.textContent===text&&!x.disabled);if(!b)throw Error('Missing button '+text);b.click();await pause(150)};
 const fill=(input,value)=>{input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}))};
 const saved=()=>wait(()=>!c.busy&&!c.dirty,'save');
 // On subsequent starts verify persistence and do not duplicate the demo.
 const existing=c.state.comparisons.find(x=>x.name==='Integration demonstration'&&x.rows.length===3&&x.rows[0].cells[x.fields[1].id]?.evidence.length===2);
 if(existing){c.current=existing.id;c.row=existing.rows[0].id;c.field=existing.fields[1].id;c.render();if(existing.rows.length!==3||existing.rows[0].cells[existing.fields[1].id].evidence.length!==2)throw Error('Restart state mismatch');await write({stage:'restart-passed',rows:3,evidence:2});
 const lifecycle=PathUtils.join(Zotero.Profile.dir,'lifecycle-done.json');
 if(!await IOUtils.exists(lifecycle)){
  await IOUtils.writeUTF8(lifecycle,JSON.stringify({stage:'pending'}));
  const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
  const addon=await AddonManager.getAddonByID('papercompare@local.research');
  await addon.disable();
  if(main.document.getElementById('papercompare-menu'))throw Error('Menu survived disable');
  if(!w.closed)throw Error('Window survived disable');
  await addon.enable();await wait(()=>main.document.getElementById('papercompare-menu'),'reenable menu');
  const count=main.document.querySelectorAll('#papercompare-menu').length;if(count!==1)throw Error('Duplicate menu');
  await IOUtils.writeUTF8(lifecycle,JSON.stringify({stage:'lifecycle-passed',menuCount:count,windowClosed:true}));
 }
 return}
 await click('+ 新建对比表');await wait(()=>d.querySelector('.dialog input'),'new dialog');fill(d.querySelector('.dialog input'),'Integration demonstration');await click('创建');await saved();
 await click('加入文库中选中的论文');await wait(()=>c.state.comparisons.at(-1).rows.length===2,'two papers');await saved();
 await click('+');await wait(()=>d.querySelector('.dialog input'),'experiment dialog');fill(d.querySelector('.dialog input'),'Long context');await click('保存');await saved();
 let table=c.state.comparisons.at(-1);const row=table.rows[0];const field=table.fields[1];
 const cellButton=Array.from(d.querySelectorAll('button')).find(x=>x.getAttribute('aria-label')===`${row.name} · ${field.name}: 尚未记录`);cellButton.click();await pause(200);
 fill(d.querySelector('textarea'),'A100 40GB × 1');await click('保存');await saved();
 await click('关联 PDF 高亮批注');await wait(()=>d.querySelector('.dialog'),'evidence dialog');
 await write({stage:'evidence-dialog',text:d.querySelector('.dialog').textContent});
 const checks=Array.from(d.querySelectorAll('.dialog input[type="checkbox"]'));if(checks.length<2)throw Error('Expected two highlights');checks[0].click();checks[1].click();await click('完成');await saved();
 table=c.state.comparisons.at(-1);if(table.rows[0].cells[field.id].evidence.length!==2)throw Error('Evidence association failed');
 await click('定位原文');await wait(()=>Zotero.Reader._readers.length>0,'PDF open');
 const outputs={};c.host.saveFile=async(text,name)=>{outputs[name]=text;return true};await click('Markdown');await wait(()=>outputs['papercompare.md'],'Markdown export');await click('CSV');await wait(()=>outputs['papercompare.csv'],'CSV export');await click('JSON 备份');await wait(()=>outputs['papercompare-backup.json'],'backup export');
 c.host.openFile=async()=>outputs['papercompare-backup.json'];const before=c.state.comparisons.length;await click('导入 JSON');await wait(()=>c.state.comparisons.length===before*2,'JSON import');await saved();
 c.current=table.id;c.row=row.id;c.field=field.id;c.render();
 await write({stage:'integration-passed',rows:table.rows.length,evidence:2,readerCount:Zotero.Reader._readers.length,exports:Object.keys(outputs),tablesAfterImport:c.state.comparisons.length});
 for(const [name,text]of Object.entries(outputs))await IOUtils.writeUTF8(PathUtils.join(Zotero.DataDirectory.dir,name),text);
} catch(e){await write({error:String(e),stack:e.stack});throw e}
