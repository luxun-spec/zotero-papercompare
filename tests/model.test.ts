import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createComparison, addRow, setCell, addField, removeField } from '../src/core/model.ts';
import { validateState } from '../src/core/validate.ts';

const paper = {libraryID: 1, itemKey: 'ABCDEFGH', title: 'Synthetic Paper'};
test('experiments remain independent and edits are immutable', () => {
  const a = createComparison('Inference', 'ai-infra', 'en');
  const b = addRow(addRow(a, paper, 'short'), paper, 'long');
  const c = setCell(b, b.rows[0].id, b.fields[0].id, {value: 'OPT-13B', evidence: []});
  assert.equal(c.rows[1].cells[b.fields[0].id]?.value ?? '', '');
  assert.equal(a.rows.length, 0);
  assert.equal(b.rows[0].cells[b.fields[0].id], undefined);
  assert.throws(() => setCell(b, 'missing', b.fields[0].id, {value:'', evidence:[]}));
});
test('same-name fields use unique IDs and removal clears cells', () => {
  let c = addField(addField(createComparison('Review','general','en'), 'GPU'), 'GPU');
  assert.notEqual(c.fields.at(-1)!.id, c.fields.at(-2)!.id);
  c = addRow(c,paper,'test');
  const field = c.fields[0].id;
  c = setCell(c,c.rows[0].id,field,{value:'value',evidence:[]});
  assert.equal(removeField(c,field).rows[0].cells[field],undefined);
});
test('backup validation rejects incompatible or malformed content', () => {
  const c = addRow(createComparison('Review','general','en'),paper,'experiment');
  assert.deepEqual(validateState({schemaVersion:1,comparisons:[c]}).comparisons,[c]);
  assert.throws(() => validateState({schemaVersion:99,comparisons:[]}));
  assert.throws(() => validateState({schemaVersion:1,comparisons:[{...c,rows:[{...c.rows[0],cells:{bad:{value:'',evidence:[]}}}]}]}));
  assert.throws(() => validateState({schemaVersion:1,comparisons:[c,c]}));
  assert.throws(() => validateState({schemaVersion:1,comparisons:[{...c,fields:[{id:'__proto__',name:'bad'}]}]}));
  for(const name of ['toString','valueOf','hasOwnProperty','__defineGetter__'])assert.throws(()=>validateState({schemaVersion:1,comparisons:[{...c,fields:[{id:name,name:'bad'}]}]}));
});
