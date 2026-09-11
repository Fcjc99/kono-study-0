import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
export const plans=sqliteTable('plans',{
 owner:text('owner').primaryKey(),revision:integer('revision').notNull(),data:text('data'),
 operation:text('operation').notNull(),updatedAt:text('updated_at').notNull(),
})
export const planHistory=sqliteTable('plan_history',{
 owner:text('owner').notNull(),revision:integer('revision').notNull(),data:text('data').notNull(),createdAt:text('created_at').notNull(),
},table=>[primaryKey({columns:[table.owner,table.revision]})])
