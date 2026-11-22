import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

export const roles = pgTable('roles', {
  roleId: serial('role_id').primaryKey(),
  rolename: varchar('rolename', { length: 50 }).notNull().unique(),
});

export const permissions = pgTable('permissions', {
  permissionId: serial('permission_id').primaryKey(),
  permissionname: varchar('permissionname', { length: 100 }).notNull().unique(),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: integer('role_id')
      .references(() => roles.roleId, { onDelete: 'cascade' })
      .notNull(),
    permissionId: integer('permission_id')
      .references(() => permissions.permissionId, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export const departments = pgTable('departments', {
  departmentId: serial('department_id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  contactEmail: varchar('contact_email', { length: 100 }),
});

export const users = pgTable('users', {
  userId: serial('user_id').primaryKey(),
  uid: text('uid').notNull().unique(),
  fullname: varchar('fullname', { length: 100 }).notNull(),
  email: varchar('email', { length: 100 }).notNull().unique(),
  phone: varchar('phone', { length: 20 }),
  roleId: integer('role_id')
    .references(() => roles.roleId)
    .notNull(),
  departmentId: integer('department_id').references(() => departments.departmentId),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const bins = pgTable('bins', {
  binId: serial('bin_id').primaryKey(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  neighborhood: varchar('neighborhood', { length: 80 }).notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  status: varchar('status', { length: 30 }).notNull(),
  capacityPct: integer('capacity_pct').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  categoryId: serial('category_id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  description: text('description'),
});

export const reports = pgTable('reports', {
  reportId: serial('report_id').primaryKey(),
  referenceCode: varchar('reference_code', { length: 30 }).notNull().unique(),
  title: varchar('title', { length: 150 }).notNull(),
  description: text('description').notNull(),
  neighborhood: varchar('neighborhood', { length: 80 }).notNull(),
  photoUrl: text('photo_url'),
  photoData: text('photo_data'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  dateSubmitted: timestamp('date_submitted').defaultNow().notNull(),
  status: varchar('status', { length: 30 }).default('Pending').notNull(),
  reportType: varchar('report_type', { length: 40 }).default('Complaint').notNull(),
  priority: varchar('priority', { length: 20 }).default('Normal').notNull(),
  citizenId: integer('citizen_id')
    .references(() => users.userId)
    .notNull(),
  departmentId: integer('department_id').references(() => departments.departmentId),
  assignedWorker: varchar('assigned_worker', { length: 100 }),
  binId: integer('bin_id').references(() => bins.binId),
  duplicateOfReportId: integer('duplicate_of_report_id'),
  upvotes: integer('upvotes').default(1).notNull(),
  preferredChannel: varchar('preferred_channel', { length: 30 }).default('In-App').notNull(),
});

export const reportCategories = pgTable(
  'report_categories',
  {
    reportId: integer('report_id')
      .references(() => reports.reportId, { onDelete: 'cascade' })
      .notNull(),
    categoryId: integer('category_id')
      .references(() => categories.categoryId, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.reportId, t.categoryId] })],
);

export const statusUpdates = pgTable('status_updates', {
  statusupdateId: serial('statusupdate_id').primaryKey(),
  reportId: integer('report_id')
    .references(() => reports.reportId, { onDelete: 'cascade' })
    .notNull(),
  oldstatus: varchar('oldstatus', { length: 30 }).notNull(),
  newstatus: varchar('newstatus', { length: 30 }).notNull(),
  note: text('note'),
  updateBy: integer('update_by')
    .references(() => users.userId)
    .notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  notificationId: serial('notification_id').primaryKey(),
  reportId: integer('report_id')
    .references(() => reports.reportId, { onDelete: 'cascade' })
    .notNull(),
  recipientId: integer('recipient_id')
    .references(() => users.userId, { onDelete: 'cascade' })
    .notNull(),
  message: text('message').notNull(),
  channel: varchar('channel', { length: 30 }).notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  datesend: timestamp('datesend').defaultNow().notNull(),
});

// Relations
export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
  rolePermissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.roleId],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.permissionId],
  }),
}));

export const departmentsRelations = relations(departments, ({ many }) => ({
  users: many(users),
  reports: many(reports),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.roleId],
  }),
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.departmentId],
  }),
  reports: many(reports),
  statusUpdates: many(statusUpdates),
  notifications: many(notifications),
}));

export const reportsRelations = relations(reports, ({ one, many }) => ({
  citizen: one(users, {
    fields: [reports.citizenId],
    references: [users.userId],
  }),
  department: one(departments, {
    fields: [reports.departmentId],
    references: [departments.departmentId],
  }),
  bin: one(bins, {
    fields: [reports.binId],
    references: [bins.binId],
  }),
  reportCategories: many(reportCategories),
  statusUpdates: many(statusUpdates),
  notifications: many(notifications),
}));

export const reportCategoriesRelations = relations(reportCategories, ({ one }) => ({
  report: one(reports, {
    fields: [reportCategories.reportId],
    references: [reports.reportId],
  }),
  category: one(categories, {
    fields: [reportCategories.categoryId],
    references: [categories.categoryId],
  }),
}));

export const statusUpdatesRelations = relations(statusUpdates, ({ one }) => ({
  report: one(reports, {
    fields: [statusUpdates.reportId],
    references: [reports.reportId],
  }),
  updater: one(users, {
    fields: [statusUpdates.updateBy],
    references: [users.userId],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  report: one(reports, {
    fields: [notifications.reportId],
    references: [reports.reportId],
  }),
  recipient: one(users, {
    fields: [notifications.recipientId],
    references: [users.userId],
  }),
}));
