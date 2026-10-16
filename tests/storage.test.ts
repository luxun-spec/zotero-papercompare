import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Store, type FilePort} from '../src/core/storage.ts';
import {emptyState,createComparison} from '../src/core/model.ts';
function setup(){
 const files=new Map<string,string>();
 const port:FilePort & {fail:boolean}={fail:false,read:async p=>{if(!files.has(p))throw Error('missing');return files.get(p)!},exists:async p=>files.has(p),writeAtomic:async(p,t)=>{if(port.fail)throw Error('disk full');files.set(p,t)}};
 return {files,port,store:new Store(port,'state.json')};
}
test('failed save preserves original, queue recovers, backup is previous valid state',async()=>{
 const {files,port,store}=setup();await store.load();await store.save(emptyState());
 const original=files.get('state.json');const next={schemaVersion:1 as const,comparisons:[createComparison('Review')]};
 port.fail=true;await assert.rejects(store.save(next));assert.equal(files.get('state.json'),original);
 port.fail=false;await store.save(next);assert.equal(files.get('state.json.bak'),original);
 assert.deepEqual(JSON.parse(files.get('state.json')!),next);
});
test('corrupt state is read-only until explicit valid backup restore',async()=>{
 const {files,store}=setup();files.set('state.json','broken');files.set('state.json.bak',JSON.stringify(emptyState()));
 await assert.rejects(store.load());await assert.rejects(store.save(emptyState()));
 assert.equal(files.get('state.json'),'broken');assert.deepEqual(await store.restoreBackup(),emptyState());
 await store.save(emptyState());
});
test('orphaned backup requires explicit recovery; invalid backup cannot overwrite state',async()=>{
 const {files,store}=setup();files.set('state.json.bak','broken');await assert.rejects(store.load());
 await assert.rejects(store.restoreBackup());assert.equal(files.has('state.json'),false);
});
test('queued snapshots are detached from caller edits and written in order',async()=>{
 const {files,store}=setup();await store.load();const a=emptyState();const b={schemaVersion:1 as const,comparisons:[createComparison('Last')]};
 const one=store.save(a);a.comparisons.push(createComparison('Unexpected'));const two=store.save(b);
 await Promise.all([one,two]);assert.equal(JSON.parse(files.get('state.json.bak')!).comparisons.length,0);
 assert.equal(JSON.parse(files.get('state.json')!).comparisons[0].name,'Last');
});
