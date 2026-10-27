import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type {
  ResourceType,
  Lifecycle,
} from "../../../../packages/contracts/index.js";
export const resources = sqliteTable("resources", {
  id: text("id").primaryKey(),
  type: text("type").$type<ResourceType>().notNull(),
  name: text("name").notNull(),
  purpose: text("purpose").notNull().default(""),
  lifecycle: text("lifecycle").$type<Lifecycle>().notNull().default("active"),
  notes: text("notes").notNull().default(""),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
  management_url: text("management_url").notNull().default(""),
  details: text("details", { mode: "json" })
    .$type<Record<string, unknown>>()
    .notNull(),
  revision: integer("revision").notNull().default(1),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  deleted_at: text("deleted_at"),
});
