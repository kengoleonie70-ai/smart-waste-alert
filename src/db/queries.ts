import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  bins,
  categories,
  departments,
  notifications,
  permissions,
  reportCategories,
  reports,
  rolePermissions,
  roles,
  statusUpdates,
  users,
} from './schema.ts';

export interface AuthUserRecord {
  userId: number;
  uid: string;
  fullname: string;
  email: string;
  phone: string | null;
  roleId: number;
  rolename: string;
  departmentId: number | null;
  permissions: string[];
}

const INITIAL_ADMIN_EMAIL = (
  process.env.ADMIN_EMAIL || 'kengoleonie70@gmail.com'
).toLowerCase();

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  fullname?: string,
): Promise<AuthUserRecord> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const displayName = (fullname || cleanEmail.split('@')[0] || 'Dschang Citizen').slice(0, 100);

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);

    let userRow = existing[0];

    if (!userRow) {
      const allRoles = await db.select().from(roles);
      const citizenRole = allRoles.find((r) => r.rolename === 'Citizen');
      const adminRole = allRoles.find((r) => r.rolename === 'Admin');

      if (!citizenRole || !adminRole) {
        throw new Error('System roles are not initialized.');
      }

      const existingAdmins = await db
        .select({ userId: users.userId })
        .from(users)
        .where(eq(users.roleId, adminRole.roleId))
        .limit(1);

      const shouldBeAdmin =
        cleanEmail === INITIAL_ADMIN_EMAIL || existingAdmins.length === 0;
      const targetRoleId = shouldBeAdmin ? adminRole.roleId : citizenRole.roleId;

      const inserted = await db
        .insert(users)
        .values({
          uid,
          email: cleanEmail,
          fullname: displayName,
          roleId: targetRoleId,
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: {
            email: cleanEmail,
            fullname: displayName,
          },
        })
        .returning();

      userRow = inserted[0];
    }

    const roleRows = await db
      .select()
      .from(roles)
      .where(eq(roles.roleId, userRow.roleId))
      .limit(1);

    const permRows = await db
      .select({ permissionname: permissions.permissionname })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.permissionId))
      .where(eq(rolePermissions.roleId, userRow.roleId));

    return {
      userId: userRow.userId,
      uid: userRow.uid,
      fullname: userRow.fullname,
      email: userRow.email,
      phone: userRow.phone,
      roleId: userRow.roleId,
      rolename: roleRows[0]?.rolename || 'Citizen',
      departmentId: userRow.departmentId,
      permissions: permRows.map((p) => p.permissionname),
    };
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function updateUserProfile(
  userId: number,
  fullname: string,
  phone: string | null,
) {
  try {
    const updated = await db
      .update(users)
      .set({
        fullname: fullname.trim().slice(0, 100),
        phone: phone ? phone.trim().slice(0, 20) : null,
      })
      .where(eq(users.userId, userId))
      .returning();
    return updated[0];
  } catch (error) {
    console.error('Database query failed in updateUserProfile:', error);
    throw new Error('Failed to update user profile.', { cause: error });
  }
}

export async function getReportPhotoById(reportId: number) {
  try {
    const rows = await db
      .select({
        photoData: reports.photoData,
      })
      .from(reports)
      .where(eq(reports.reportId, reportId))
      .limit(1);
    return rows[0]?.photoData || null;
  } catch (error) {
    console.error('Database query failed in getReportPhotoById:', error);
    throw new Error('Failed to load report photo.', { cause: error });
  }
}

async function hydrateReports(reportRows: (typeof reports.$inferSelect)[], includeCitizenContact: boolean) {
  if (reportRows.length === 0) return [];

  const reportIds = reportRows.map((r) => r.reportId);

  const [rcRows, catRows, deptRows, binRows, userRows, updateRows] = await Promise.all([
    db.select().from(reportCategories).where(inArray(reportCategories.reportId, reportIds)),
    db.select().from(categories),
    db.select().from(departments),
    db.select().from(bins),
    db.select({
      userId: users.userId,
      fullname: users.fullname,
      email: users.email,
      phone: users.phone,
    }).from(users),
    db
      .select()
      .from(statusUpdates)
      .where(inArray(statusUpdates.reportId, reportIds))
      .orderBy(desc(statusUpdates.timestamp)),
  ]);

  const catMap = Object.fromEntries(catRows.map((c) => [c.categoryId, c]));
  const deptMap = Object.fromEntries(deptRows.map((d) => [d.departmentId, d]));
  const binMap = Object.fromEntries(binRows.map((b) => [b.binId, b]));
  const userMap = Object.fromEntries(userRows.map((u) => [u.userId, u]));

  return reportRows.map((r) => {
    const cats = rcRows
      .filter((rc) => rc.reportId === r.reportId)
      .map((rc) => catMap[rc.categoryId])
      .filter(Boolean);

    const timeline = updateRows
      .filter((u) => u.reportId === r.reportId)
      .map((u) => ({
        statusupdateId: u.statusupdateId,
        oldstatus: u.oldstatus,
        newstatus: u.newstatus,
        note: u.note,
        timestamp: u.timestamp,
        updatedByName: userMap[u.updateBy]?.fullname || 'Municipal Staff',
      }));

    const resolvedPhotoUrl = r.photoData
      ? `/api/reports/${r.reportId}/photo`
      : r.photoUrl || null;

    const citizen = userMap[r.citizenId];

    return {
      reportId: r.reportId,
      referenceCode: r.referenceCode,
      title: r.title,
      description: r.description,
      neighborhood: r.neighborhood,
      photoUrl: resolvedPhotoUrl,
      latitude: r.latitude,
      longitude: r.longitude,
      dateSubmitted: r.dateSubmitted,
      status: r.status,
      reportType: r.reportType,
      priority: r.priority,
      citizenId: r.citizenId,
      citizenName: citizen?.fullname || 'Dschang Resident',
      ...(includeCitizenContact
        ? {
            citizenEmail: citizen?.email || null,
            citizenPhone: citizen?.phone || null,
          }
        : {}),
      departmentId: r.departmentId,
      departmentName: r.departmentId ? deptMap[r.departmentId]?.name || null : null,
      assignedWorker: r.assignedWorker,
      binId: r.binId,
      binCode: r.binId ? binMap[r.binId]?.code || null : null,
      duplicateOfReportId: r.duplicateOfReportId,
      upvotes: r.upvotes,
      preferredChannel: r.preferredChannel,
      categories: cats.map((c) => ({ categoryId: c.categoryId, name: c.name })),
      timeline,
    };
  });
}

export async function getPublicOverviewData() {
  try {
    const [reportRows, binRows, catRows, deptRows] = await Promise.all([
      db.select().from(reports).orderBy(desc(reports.dateSubmitted)),
      db.select().from(bins).orderBy(bins.code),
      db.select().from(categories).orderBy(categories.categoryId),
      db.select().from(departments).orderBy(departments.departmentId),
    ]);

    const hydratedReports = await hydrateReports(reportRows, false);
    const analytics = computeAnalytics(hydratedReports);

    return {
      reports: hydratedReports,
      bins: binRows,
      categories: catRows,
      departments: deptRows,
      analytics,
    };
  } catch (error) {
    console.error('Database query failed in getPublicOverviewData:', error);
    throw new Error('Failed to load municipal waste overview.', { cause: error });
  }
}

export function computeAnalytics(
  hydratedReports: Awaited<ReturnType<typeof hydrateReports>>,
) {
  const totalReports = hydratedReports.length;
  const pendingCount = hydratedReports.filter((r) => r.status === 'Pending').length;
  const inProgressCount = hydratedReports.filter((r) => r.status === 'In Progress').length;
  const resolvedCount = hydratedReports.filter((r) => r.status === 'Resolved').length;
  const collectionRequestsCount = hydratedReports.filter(
    (r) => r.reportType === 'Collection Point Request',
  ).length;
  const duplicateCount = hydratedReports.filter((r) => r.duplicateOfReportId !== null).length;

  const neighborhoodMap: Record<
    string,
    { neighborhood: string; total: number; pending: number; inProgress: number; resolved: number }
  > = {};

  const categoryMap: Record<string, { name: string; count: number }> = {};

  const hourBuckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    count: 0,
  }));

  for (const r of hydratedReports) {
    const hood = r.neighborhood || 'Unspecified';
    if (!neighborhoodMap[hood]) {
      neighborhoodMap[hood] = {
        neighborhood: hood,
        total: 0,
        pending: 0,
        inProgress: 0,
        resolved: 0,
      };
    }
    neighborhoodMap[hood].total += 1;
    if (r.status === 'Pending') neighborhoodMap[hood].pending += 1;
    if (r.status === 'In Progress') neighborhoodMap[hood].inProgress += 1;
    if (r.status === 'Resolved') neighborhoodMap[hood].resolved += 1;

    for (const c of r.categories) {
      if (!categoryMap[c.name]) {
        categoryMap[c.name] = { name: c.name, count: 0 };
      }
      categoryMap[c.name].count += 1;
    }

    const dt = new Date(r.dateSubmitted);
    const hr = Number.isNaN(dt.getTime()) ? 10 : dt.getHours();
    hourBuckets[hr].count += 1;
  }

  const byNeighborhood = Object.values(neighborhoodMap).sort((a, b) => b.total - a.total);
  const byCategory = Object.values(categoryMap).sort((a, b) => b.count - a.count);

  const peakHour = [...hourBuckets].sort((a, b) => b.count - a.count)[0];

  return {
    totals: {
      totalReports,
      pendingCount,
      inProgressCount,
      resolvedCount,
      collectionRequestsCount,
      duplicateCount,
      resolutionRatePct:
        totalReports > 0 ? Math.round((resolvedCount / totalReports) * 100) : 0,
    },
    byNeighborhood,
    byCategory,
    byHour: hourBuckets,
    peakReportingWindow: peakHour
      ? `${peakHour.label} – ${String((peakHour.hour + 1) % 24).padStart(2, '0')}:00`
      : '08:00 – 09:00',
  };
}

export async function findPotentialDuplicates(params: {
  latitude?: number | null;
  longitude?: number | null;
  neighborhood: string;
  categoryId?: number | null;
}) {
  try {
    const activeReports = await db
      .select()
      .from(reports)
      .where(inArray(reports.status, ['Pending', 'In Progress']))
      .orderBy(desc(reports.dateSubmitted));

    const hydrated = await hydrateReports(activeReports, false);

    const matches = hydrated
      .map((r) => {
        let distanceMeters: number | null = null;
        if (
          params.latitude != null &&
          params.longitude != null &&
          r.latitude != null &&
          r.longitude != null
        ) {
          distanceMeters = Math.round(
            haversineMeters(params.latitude, params.longitude, r.latitude, r.longitude),
          );
        }

        const sameNeighborhood =
          r.neighborhood.toLowerCase() === params.neighborhood.trim().toLowerCase();
        const sameCategory = params.categoryId
          ? r.categories.some((c) => c.categoryId === params.categoryId)
          : false;

        const isNearby = distanceMeters !== null && distanceMeters <= 200;
        const isAreaMatch = sameNeighborhood && sameCategory;

        if (isNearby || isAreaMatch) {
          return {
            reportId: r.reportId,
            referenceCode: r.referenceCode,
            title: r.title,
            neighborhood: r.neighborhood,
            status: r.status,
            dateSubmitted: r.dateSubmitted,
            upvotes: r.upvotes,
            distanceMeters,
            categories: r.categories,
          };
        }
        return null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .slice(0, 4);

    return matches;
  } catch (error) {
    console.error('Database query failed in findPotentialDuplicates:', error);
    throw new Error('Failed to check for duplicate reports.', { cause: error });
  }
}

export async function trackReportByReference(referenceCode: string) {
  try {
    const rows = await db
      .select()
      .from(reports)
      .where(eq(reports.referenceCode, referenceCode.trim().toUpperCase()))
      .limit(1);

    if (rows.length === 0) return null;
    const hydrated = await hydrateReports(rows, false);
    return hydrated[0] || null;
  } catch (error) {
    console.error('Database query failed in trackReportByReference:', error);
    throw new Error('Failed to track report.', { cause: error });
  }
}

export async function createCitizenReport(input: {
  citizenId: number;
  title: string;
  description: string;
  neighborhood: string;
  latitude: number | null;
  longitude: number | null;
  reportType: string;
  priority: string;
  categoryId: number;
  binId: number | null;
  photoData: string | null;
  preferredChannel: string;
  duplicateOfReportId: number | null;
}) {
  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reports);

    const nextNum = (count || 0) + 1;
    const randomSuffix = Math.floor(10 + Math.random() * 89);
    const referenceCode = `DSG-2026-${String(nextNum).padStart(3, '0')}${nextNum > 999 ? '' : ''}-${randomSuffix}`.slice(
      0,
      30,
    );
    const cleanRef = `DSG-2026-${String(nextNum).padStart(3, '0')}`;

    let finalRef = cleanRef;
    const existingRef = await db
      .select({ reportId: reports.reportId })
      .from(reports)
      .where(eq(reports.referenceCode, cleanRef))
      .limit(1);
    if (existingRef.length > 0) {
      finalRef = referenceCode;
    }

    const inserted = await db
      .insert(reports)
      .values({
        referenceCode: finalRef,
        title: input.title.trim().slice(0, 150),
        description: input.description.trim(),
        neighborhood: input.neighborhood.trim().slice(0, 80),
        latitude: input.latitude,
        longitude: input.longitude,
        status: 'Pending',
        reportType: input.reportType,
        priority: input.priority,
        citizenId: input.citizenId,
        binId: input.binId,
        photoData: input.photoData,
        preferredChannel: input.preferredChannel,
        duplicateOfReportId: input.duplicateOfReportId,
      })
      .returning();

    const created = inserted[0];

    await db
      .insert(reportCategories)
      .values({
        reportId: created.reportId,
        categoryId: input.categoryId,
      })
      .onConflictDoNothing();

    await db.insert(notifications).values({
      reportId: created.reportId,
      recipientId: input.citizenId,
      message: `Report ${created.referenceCode} received for ${created.neighborhood}. Municipal sanitation staff will review it shortly.`,
      channel: input.preferredChannel,
    });

    const hydrated = await hydrateReports([created], false);
    return hydrated[0];
  } catch (error) {
    console.error('Database query failed in createCitizenReport:', error);
    throw new Error('Failed to submit waste report.', { cause: error });
  }
}

export async function confirmExistingReport(reportId: number) {
  try {
    const updated = await db
      .update(reports)
      .set({
        upvotes: sql`${reports.upvotes} + 1`,
      })
      .where(eq(reports.reportId, reportId))
      .returning();
    return updated[0] || null;
  } catch (error) {
    console.error('Database query failed in confirmExistingReport:', error);
    throw new Error('Failed to confirm report.', { cause: error });
  }
}

export async function getUserReportsAndNotifications(userId: number) {
  try {
    const [myReportRows, myNotifs] = await Promise.all([
      db
        .select()
        .from(reports)
        .where(eq(reports.citizenId, userId))
        .orderBy(desc(reports.dateSubmitted)),
      db
        .select({
          notificationId: notifications.notificationId,
          reportId: notifications.reportId,
          message: notifications.message,
          channel: notifications.channel,
          isRead: notifications.isRead,
          datesend: notifications.datesend,
          referenceCode: reports.referenceCode,
        })
        .from(notifications)
        .innerJoin(reports, eq(notifications.reportId, reports.reportId))
        .where(eq(notifications.recipientId, userId))
        .orderBy(desc(notifications.datesend)),
    ]);

    const hydratedReports = await hydrateReports(myReportRows, false);
    return {
      reports: hydratedReports,
      notifications: myNotifs,
    };
  } catch (error) {
    console.error('Database query failed in getUserReportsAndNotifications:', error);
    throw new Error('Failed to load your reports and notifications.', { cause: error });
  }
}

export async function markNotificationAsRead(notificationId: number, userId: number) {
  try {
    const updated = await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.notificationId, notificationId),
          eq(notifications.recipientId, userId),
        ),
      )
      .returning();
    return updated[0] || null;
  } catch (error) {
    console.error('Database query failed in markNotificationAsRead:', error);
    throw new Error('Failed to update notification.', { cause: error });
  }
}

export async function getAdminOperationsData() {
  try {
    const [
      reportRows,
      binRows,
      deptRows,
      userRows,
      roleRows,
      permRows,
      rolePermRows,
    ] = await Promise.all([
      db.select().from(reports).orderBy(desc(reports.dateSubmitted)),
      db.select().from(bins).orderBy(bins.code),
      db.select().from(departments).orderBy(departments.departmentId),
      db.select().from(users).orderBy(users.userId),
      db.select().from(roles).orderBy(roles.roleId),
      db.select().from(permissions).orderBy(permissions.permissionId),
      db.select().from(rolePermissions),
    ]);

    const hydratedReports = await hydrateReports(reportRows, true);
    const roleMap = Object.fromEntries(roleRows.map((r) => [r.roleId, r.rolename]));
    const deptMap = Object.fromEntries(deptRows.map((d) => [d.departmentId, d.name]));

    const sanitizedUsers = userRows.map((u) => ({
      userId: u.userId,
      fullname: u.fullname,
      email: u.email,
      phone: u.phone,
      roleId: u.roleId,
      rolename: roleMap[u.roleId] || 'Citizen',
      departmentId: u.departmentId,
      departmentName: u.departmentId ? deptMap[u.departmentId] || null : null,
      createdAt: u.createdAt,
    }));

    return {
      reports: hydratedReports,
      bins: binRows,
      departments: deptRows,
      users: sanitizedUsers,
      roles: roleRows,
      permissions: permRows,
      rolePermissions: rolePermRows,
    };
  } catch (error) {
    console.error('Database query failed in getAdminOperationsData:', error);
    throw new Error('Failed to load administrative operations data.', { cause: error });
  }
}

export async function updateReportAdmin(params: {
  reportId: number;
  status: string;
  departmentId: number | null;
  assignedWorker: string | null;
  priority: string;
  note: string | null;
  adminUserId: number;
}) {
  try {
    const existing = await db
      .select()
      .from(reports)
      .where(eq(reports.reportId, params.reportId))
      .limit(1);

    if (existing.length === 0) {
      return null;
    }

    const current = existing[0];
    const oldStatus = current.status;

    const updatedRows = await db
      .update(reports)
      .set({
        status: params.status,
        departmentId: params.departmentId,
        assignedWorker: params.assignedWorker ? params.assignedWorker.trim().slice(0, 100) : null,
        priority: params.priority,
      })
      .where(eq(reports.reportId, params.reportId))
      .returning();

    const updated = updatedRows[0];

    if (oldStatus !== params.status || (params.note && params.note.trim().length > 0)) {
      await db.insert(statusUpdates).values({
        reportId: params.reportId,
        oldstatus: oldStatus,
        newstatus: params.status,
        note: params.note?.trim() || `Status updated from ${oldStatus} to ${params.status}.`,
        updateBy: params.adminUserId,
      });

      const workerSnippet = params.assignedWorker
        ? ` Assigned to ${params.assignedWorker}.`
        : '';

      await db.insert(notifications).values({
        reportId: params.reportId,
        recipientId: current.citizenId,
        message: `Report ${current.referenceCode} (${current.neighborhood}) is now ${params.status}.${workerSnippet}${params.note ? ` Note: ${params.note.trim()}` : ''}`,
        channel: current.preferredChannel || 'In-App',
      });
    }

    const hydrated = await hydrateReports([updated], true);
    return hydrated[0];
  } catch (error) {
    console.error('Database query failed in updateReportAdmin:', error);
    throw new Error('Failed to update report.', { cause: error });
  }
}

export async function createBinRecord(input: {
  code: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  type: string;
  status: string;
  capacityPct: number;
}) {
  try {
    const inserted = await db
      .insert(bins)
      .values({
        code: input.code.trim().toUpperCase().slice(0, 30),
        neighborhood: input.neighborhood.trim().slice(0, 80),
        latitude: input.latitude,
        longitude: input.longitude,
        type: input.type,
        status: input.status,
        capacityPct: Math.max(0, Math.min(100, Math.round(input.capacityPct))),
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createBinRecord:', error);
    throw new Error('Failed to register public dustbin.', { cause: error });
  }
}

export async function updateBinRecord(
  binId: number,
  status: string,
  capacityPct: number,
) {
  try {
    const updated = await db
      .update(bins)
      .set({
        status,
        capacityPct: Math.max(0, Math.min(100, Math.round(capacityPct))),
        updatedAt: new Date(),
      })
      .where(eq(bins.binId, binId))
      .returning();
    return updated[0] || null;
  } catch (error) {
    console.error('Database query failed in updateBinRecord:', error);
    throw new Error('Failed to update bin status.', { cause: error });
  }
}

export async function updateUserRoleAndDepartment(
  targetUserId: number,
  roleId: number,
  departmentId: number | null,
) {
  try {
    const updated = await db
      .update(users)
      .set({
        roleId,
        departmentId,
      })
      .where(eq(users.userId, targetUserId))
      .returning();
    return updated[0] || null;
  } catch (error) {
    console.error('Database query failed in updateUserRoleAndDepartment:', error);
    throw new Error('Failed to update user role.', { cause: error });
  }
}

export async function createDepartmentRecord(input: {
  name: string;
  description: string | null;
  contactEmail: string | null;
}) {
  try {
    const inserted = await db
      .insert(departments)
      .values({
        name: input.name.trim().slice(0, 100),
        description: input.description?.trim() || null,
        contactEmail: input.contactEmail?.trim() || null,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createDepartmentRecord:', error);
    throw new Error('Failed to create municipal department.', { cause: error });
  }
}
