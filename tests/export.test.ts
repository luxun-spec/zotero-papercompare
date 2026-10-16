import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createComparison,addRow,setCell} from '../src/core/model.ts';
import {toCSV,toMarkdown,exportBackup,importBackup} from '../src/core/export.ts';
const paper={libraryID:1,itemKey:'ABCDEFGH',title:'中文 | "Paper"'};
const c=addRow(createComparison('Review','general','en'),paper,'Run 1');
const table=setCell(c,c.rows[0].id,c.fields[0].id,{value:'=HYPERLINK("x")\nsecond | line',evidence:[{id:'e1',attachmentKey:'PDFABCDE',annotationKey:'ANNABCDE',quote:'quote | a\nb',pageLabel:'4',position:'{}'}]});
test('CSV quotes multiline values and neutralizes formulas including whitespace',()=>{
 const csv=toCSV(table);assert.match(csv,/'=HYPERLINK/);assert.match(csv,/""x""/);assert.match(csv,/\r\n/);
 const t=setCell(c,c.rows[0].id,c.fields[0].id,{value:'  +cmd',evidence:[]});assert.match(toCSV(t),/'  \+cmd/);
});
test('Markdown escapes structural characters and includes evidence links',()=>{
 const md=toMarkdown(table);assert.match(md,/中文 \\\|/);assert.match(md,/<br>/);assert.match(md,/zotero:\/\/open-pdf\/library\/items\/PDFABCDE\?annotation=ANNABCDE/);
 assert.match(md,/quote \\\| a/);
});
test('backup import preserves contents, regenerates IDs and rejects invalid inputs',()=>{
 const state={schemaVersion:1 as const,comparisons:[table]};const restored=importBackup(exportBackup(state),state);
 assert.equal(restored.comparisons.length,2);assert.notEqual(restored.comparisons[1].id,table.id);
 assert.equal(restored.comparisons[1].rows[0].cells[table.fields[0].id].value,table.rows[0].cells[table.fields[0].id].value);
 assert.throws(()=>importBackup('{"schemaVersion":99,"comparisons":[]}',state));assert.equal(state.comparisons.length,1);
});
