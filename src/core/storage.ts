import {emptyState,type State} from './model.ts';
import {validateState} from './validate.ts';
export interface FilePort {read(path:string):Promise<string>;exists(path:string):Promise<boolean>;writeAtomic(path:string,text:string):Promise<void>}
export class Store {
 private queue:Promise<void>=Promise.resolve();
 private writable=false;
 private files:FilePort; private path:string;
 constructor(files:FilePort,path:string){this.files=files;this.path=path}
 async load():Promise<State>{
   this.writable=false;
   if(!await this.files.exists(this.path)){
     if(await this.files.exists(this.path+'.bak'))throw Error('Backup found; use Restore backup / 发现备份，请显式恢复');
     this.writable=true;return emptyState();
   }
   const state=validateState(JSON.parse(await this.files.read(this.path)));
   this.writable=true;return state;
 }
 save(state:State):Promise<void>{
   // Snapshot synchronously, before waiting for earlier writes.
   let snapshot:string;
   try{snapshot=JSON.stringify(validateState(state),null,2)}catch(e){return Promise.reject(e)}
   const operation=this.queue.then(async()=>{
     if(!this.writable)throw Error('Read-only: load or restore valid data first / 数据只读，请先恢复');
     if(await this.files.exists(this.path)){
       const original=await this.files.read(this.path);
       try{validateState(JSON.parse(original))}catch(e){this.writable=false;throw e}
       await this.files.writeAtomic(this.path+'.bak',original);
     }
     await this.files.writeAtomic(this.path,snapshot);
   });
   this.queue=operation.catch(()=>{});return operation;
 }
 async restoreBackup():Promise<State>{
   await this.queue;
   const state=validateState(JSON.parse(await this.files.read(this.path+'.bak')));
   await this.files.writeAtomic(this.path,JSON.stringify(state,null,2));
   this.writable=true;return state;
 }
 async drain():Promise<void>{await this.queue}
}
