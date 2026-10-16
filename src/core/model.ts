export interface PaperRef { libraryID: number; itemKey: string; title: string; author?: string; year?: string }
export interface Evidence { id: string; attachmentKey: string; annotationKey: string; quote: string; pageLabel: string; position: string }
export interface Field { id: string; name: string }
export interface Cell { value: string; evidence: Evidence[] }
export interface ExperimentRow { id: string; paper: PaperRef; name: string; cells: Record<string,Cell> }
export interface Comparison { id: string; name: string; fields: Field[]; rows: ExperimentRow[]; createdAt: string; updatedAt: string }
export interface State { schemaVersion: 1; comparisons: Comparison[] }
export type Template = 'general'|'ai-infra'|'custom';
export const id = () => crypto.randomUUID();
const copy = <T>(v:T):T => JSON.parse(JSON.stringify(v));
export const emptyState = ():State => ({schemaVersion:1,comparisons:[]});
export function createComparison(name:string, template:Template='general', language='en'):Comparison {
  if (!name.trim()) throw new Error('Name is required');
  const zh = language.startsWith('zh');
  const names = template==='custom' ? [] : template==='ai-infra'
    ? (zh ? ['模型','GPU 配置','数值精度','数据集 / 工作负载','输入长度','输出长度','吞吐量','延迟','其他条件'] : ['Model','GPU configuration','Precision','Dataset / workload','Input length','Output length','Throughput','Latency','Other conditions'])
    : (zh ? ['研究问题','方法','数据集','主要结果','局限'] : ['Research question','Method','Dataset','Results','Limitations']);
  const now = new Date().toISOString();
  return {id:id(),name:name.trim(),fields:names.map(name=>({id:id(),name})),rows:[],createdAt:now,updatedAt:now};
}
function update(c:Comparison, change:(next:Comparison)=>void):Comparison {
  const next=copy(c); change(next); next.updatedAt=new Date().toISOString(); return next;
}
export function addRow(c:Comparison,paper:PaperRef,name:string):Comparison {
  if (!name.trim()) throw new Error('Experiment name is required');
  return update(c,n=>{n.rows.push({id:id(),paper:copy(paper),name:name.trim(),cells:{}})});
}
export function setCell(c:Comparison,rowID:string,fieldID:string,cell:Cell):Comparison {
  if(!c.rows.some(r=>r.id===rowID)||!c.fields.some(f=>f.id===fieldID)) throw new Error('Unknown row or field');
  return update(c,n=>{n.rows.find(r=>r.id===rowID)!.cells[fieldID]=copy(cell)});
}
export function addField(c:Comparison,name:string):Comparison {
  if(!name.trim()) throw new Error('Field name is required');
  return update(c,n=>{n.fields.push({id:id(),name:name.trim()})});
}
export function removeField(c:Comparison,fieldID:string):Comparison {
  return update(c,n=>{n.fields=n.fields.filter(f=>f.id!==fieldID); for(const r of n.rows)delete r.cells[fieldID]});
}
export function removeRow(c:Comparison,rowID:string):Comparison {return update(c,n=>{n.rows=n.rows.filter(r=>r.id!==rowID)})}
