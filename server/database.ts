export type Result={results:Record<string,unknown>[];success:boolean;meta?:{changes?:number}}
export interface Statement {bind(...values:unknown[]):Statement;all():Promise<Result>;first<T>():Promise<T|null>;run():Promise<Result>}
export interface Database {prepare(sql:string):Statement;batch(statements:Statement[]):Promise<Result[]>}
export type PlanRow={revision:number;data:string|null;operation:string}
export const readPlan=(db:Database,owner:string)=>db.prepare('SELECT revision, data, operation FROM plans WHERE owner = ?').bind(owner).first<PlanRow>()
export async function writePlan(db:Database,owner:string,revision:number,data:string,operation:string){
 const now=new Date().toISOString()
 const results=await db.batch([
  db.prepare(`INSERT INTO plans (owner, revision, data, operation, updated_at)
    SELECT ?, 1, ?, ?, ? WHERE ? = 0 OR EXISTS (SELECT 1 FROM plans WHERE owner = ?)
    ON CONFLICT(owner) DO UPDATE SET revision = plans.revision + 1, data = excluded.data, operation = excluded.operation, updated_at = excluded.updated_at
    WHERE plans.revision = ? RETURNING revision`).bind(owner,data,operation,now,revision,owner,revision),
  db.prepare(`INSERT OR IGNORE INTO plan_history (owner, revision, data, created_at)
    SELECT owner, revision, data, updated_at FROM plans WHERE owner = ? AND operation = ? AND revision = ?`).bind(owner,operation,revision+1),
  db.prepare('DELETE FROM plan_history WHERE owner = ? AND revision < (SELECT revision - 19 FROM plans WHERE owner = ?)').bind(owner,owner),
 ])
 return results[0].results[0]?.revision as number|undefined
}
export async function deletePlan(db:Database,owner:string,revision:number){
 const operation=crypto.randomUUID()
 const results=await db.batch([
  db.prepare('UPDATE plans SET data = NULL, revision = revision + 1, operation = ?, updated_at = ? WHERE owner = ? AND revision = ? RETURNING revision').bind(operation,new Date().toISOString(),owner,revision),
  db.prepare('DELETE FROM plan_history WHERE owner = ? AND EXISTS (SELECT 1 FROM plans WHERE owner = ? AND operation = ?)').bind(owner,owner,operation),
 ])
 return results[0].results[0]?.revision as number|undefined
}
