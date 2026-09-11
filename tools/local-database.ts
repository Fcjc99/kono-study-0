import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Database, Result, Statement } from '../server/database.ts'
/** Development only; Sites applies production migrations before Worker deployment. */
export function openLocalDatabase(root:string):Database & {close():void}{
 mkdirSync(resolve(root,'.dev'),{recursive:true})
 const db=new DatabaseSync(resolve(root,'.dev/kono.sqlite'))
 db.exec('PRAGMA journal_mode=WAL')
 db.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)')
 const journal=JSON.parse(readFileSync(resolve(root,'drizzle/meta/_journal.json'),'utf8')) as {entries:{tag:string}[]}
 for(const {tag} of journal.entries)if(!db.prepare('SELECT name FROM local_migrations WHERE name = ?').get(tag)){
  db.exec('BEGIN')
  try{db.exec(readFileSync(resolve(root,'drizzle',tag+'.sql'),'utf8'));db.prepare('INSERT INTO local_migrations (name) VALUES (?)').run(tag);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}
 }
 class LocalStatement implements Statement{
  sql:string;values:SQLInputValue[]=[]
  constructor(sql:string){this.sql=sql}
  bind(...values:unknown[]){this.values=values as SQLInputValue[];return this}
  execute():Result{const statement=db.prepare(this.sql);if(statement.columns().length)return {success:true,results:statement.all(...this.values) as Record<string,unknown>[]};const result=statement.run(...this.values);return {success:true,results:[],meta:{changes:Number(result.changes)}}}
  async all(){return this.execute()}
  async first<T>(){return (db.prepare(this.sql).get(...this.values)??null) as T|null}
  async run(){return this.execute()}
 }
 return {prepare:(sql:string)=>new LocalStatement(sql),async batch(statements:Statement[]){db.exec('BEGIN');try{const results=statements.map(s=>(s as LocalStatement).execute());db.exec('COMMIT');return results}catch(error){db.exec('ROLLBACK');throw error}},close:()=>db.close()}
}
