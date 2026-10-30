import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const feeds = sqliteTable('feeds', {id:text('id').primaryKey(),owner:text('owner').notNull(),url:text('url').notNull(),title:text('title').notNull(),checked:text('checked'),success:text('success'),error:text('error')});
export const articles = sqliteTable('articles',{id:text('id').primaryKey(),owner:text('owner').notNull(),feed:text('feed').notNull(),title:text('title').notNull(),url:text('url').notNull(),summary:text('summary').notNull(),image:text('image'),imageChecked:integer('image_checked'),published:text('published'),added:text('added').notNull(),read:integer('read').notNull().default(0),saved:integer('saved').notNull().default(0),version:integer('version').notNull().default(0)});

export const imageRuns=sqliteTable('image_runs',{owner:text('owner').primaryKey(),nextAllowed:integer('next_allowed').notNull()});
