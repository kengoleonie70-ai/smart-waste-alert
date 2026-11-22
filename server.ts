import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  confirmExistingReport,
  createBinRecord,
  createCitizenReport,
  createDepartmentRecord,
  findPotentialDuplicates,
  getAdminOperationsData,
  getPublicOverviewData,
  getReportPhotoById,
  getUserReportsAndNotifications,
  markNotificationAsRead,
  trackReportByReference,
  updateBinRecord,
  updateReportAdmin,
  updateUserProfile,
  updateUserRoleAndDepartment,
} from './src/db/queries.ts';
import {
  AuthRequest,
  requireAdmin,
  requireAuth,
  requireStaffOrAdmin,
} from './src/middleware/auth.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_STATUSES = ['Pending', 'In Progress', 'Resolved'] as const;
const ALLOWED_PRIORITIES = ['Normal', 'High', 'Urgent'] as const;
const ALLOWED_REPORT_TYPES = ['Complaint', 'Collection Point Request'] as const;
const ALLOWED_CHANNELS = ['In-App', 'Email', 'SMS'] as const;
const ALLOWED_BIN_STATUSES = ['Empty', 'Half Full', 'Full', 'Overflowing', 'Damaged'] as const;
const ALLOWED_BIN_TYPES = ['General', 'Recyclable', 'Organic', 'Market'] as const;

function isValidPhotoDataUri(data: unknown): data is string {
  if (typeof data !== 'string') return false;
  return /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data) && data.length <= 1_400_000;
}

function parseFiniteCoord(val: unknown, min: number, max: number): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  return num;
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', municipality: 'Dschang' });
  });

  app.get('/api/public/overview', async (_req, res) => {
    try {
      const data = await getPublicOverviewData();
      res.json(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load public data.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/reports/:id/photo', async (req, res) => {
    const reportId = Number(req.params.id);
    if (!Number.isInteger(reportId) || reportId <= 0) {
      return res.status(400).json({ error: 'Invalid report identifier.' });
    }
    try {
      const dataUri = await getReportPhotoById(reportId);
      if (!dataUri) {
        return res.status(404).json({ error: 'Photo not found.' });
      }
      const match = dataUri.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/);
      if (!match) {
        return res.status(415).json({ error: 'Unsupported media format.' });
      }
      const mimeType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
      const buffer = Buffer.from(match[2], 'base64');
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buffer);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to fetch photo.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/reports/track/:referenceCode', async (req, res) => {
    const code = String(req.params.referenceCode || '').trim();
    if (!code || code.length > 30) {
      return res.status(400).json({ error: 'Valid reference code required.' });
    }
    try {
      const report = await trackReportByReference(code);
      if (!report) {
        return res.status(404).json({ error: `No report found with code ${code.toUpperCase()}.` });
      }
      res.json({ report });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to track report.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/reports/check-duplicate', async (req, res) => {
    try {
      const neighborhood = String(req.body?.neighborhood || '').trim();
      if (!neighborhood) {
        return res.json({ duplicates: [] });
      }
      const latitude = parseFiniteCoord(req.body?.latitude, -90, 90);
      const longitude = parseFiniteCoord(req.body?.longitude, -180, 180);
      const categoryId = req.body?.categoryId ? Number(req.body.categoryId) : null;

      const duplicates = await findPotentialDuplicates({
        latitude,
        longitude,
        neighborhood,
        categoryId: Number.isInteger(categoryId) ? categoryId : null,
      });
      res.json({ duplicates });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Duplicate check failed.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/me', requireAuth, async (req: AuthRequest, res) => {
    res.json({ user: req.authUser });
  });

  app.patch('/api/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const fullname = String(req.body?.fullname || req.authUser!.fullname).trim();
      const phone = req.body?.phone ? String(req.body.phone).trim() : null;
      if (fullname.length < 2) {
        return res.status(400).json({ error: 'Full name must be at least 2 characters.' });
      }
      const updated = await updateUserProfile(req.authUser!.userId, fullname, phone);
      res.json({ user: { ...req.authUser, fullname: updated.fullname, phone: updated.phone } });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update profile.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/my-reports', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getUserReportsAndNotifications(req.authUser!.userId);
      res.json(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch reports.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/reports', requireAuth, async (req: AuthRequest, res) => {
    try {
      const title = String(req.body?.title || '').trim();
      const description = String(req.body?.description || '').trim();
      const neighborhood = String(req.body?.neighborhood || '').trim();
      const categoryId = Number(req.body?.categoryId);
      const reportType = String(req.body?.reportType || 'Complaint');
      const priority = String(req.body?.priority || 'Normal');
      const preferredChannel = String(req.body?.preferredChannel || 'In-App');
      const latitude = parseFiniteCoord(req.body?.latitude, -90, 90);
      const longitude = parseFiniteCoord(req.body?.longitude, -180, 180);
      const binId = req.body?.binId ? Number(req.body.binId) : null;
      const duplicateOfReportId = req.body?.duplicateOfReportId
        ? Number(req.body.duplicateOfReportId)
        : null;
      const rawPhoto = req.body?.photoData;

      if (title.length < 4 || description.length < 8 || !neighborhood) {
        return res.status(400).json({
          error: 'Please provide a clear title, description, and Dschang neighborhood.',
        });
      }
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return res.status(400).json({ error: 'Please select a valid waste category.' });
      }
      if (!ALLOWED_REPORT_TYPES.includes(reportType as (typeof ALLOWED_REPORT_TYPES)[number])) {
        return res.status(400).json({ error: 'Invalid report type.' });
      }
      if (!ALLOWED_PRIORITIES.includes(priority as (typeof ALLOWED_PRIORITIES)[number])) {
        return res.status(400).json({ error: 'Invalid priority level.' });
      }
      if (!ALLOWED_CHANNELS.includes(preferredChannel as (typeof ALLOWED_CHANNELS)[number])) {
        return res.status(400).json({ error: 'Invalid notification channel.' });
      }
      if (rawPhoto && !isValidPhotoDataUri(rawPhoto)) {
        return res.status(400).json({
          error: 'Uploaded photo must be a JPEG, PNG, or WebP image under 1MB.',
        });
      }

      const report = await createCitizenReport({
        citizenId: req.authUser!.userId,
        title,
        description,
        neighborhood,
        latitude,
        longitude,
        reportType,
        priority,
        categoryId,
        binId: binId && Number.isInteger(binId) ? binId : null,
        photoData: rawPhoto || null,
        preferredChannel,
        duplicateOfReportId:
          duplicateOfReportId && Number.isInteger(duplicateOfReportId)
            ? duplicateOfReportId
            : null,
      });

      res.status(201).json({ report });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to submit report.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/reports/:id/confirm', requireAuth, async (req: AuthRequest, res) => {
    const reportId = Number(req.params.id);
    if (!Number.isInteger(reportId) || reportId <= 0) {
      return res.status(400).json({ error: 'Invalid report identifier.' });
    }
    try {
      const updated = await confirmExistingReport(reportId);
      if (!updated) {
        return res.status(404).json({ error: 'Report not found.' });
      }
      res.json({ reportId: updated.reportId, upvotes: updated.upvotes });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to confirm report.';
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
    const notificationId = Number(req.params.id);
    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      return res.status(400).json({ error: 'Invalid notification identifier.' });
    }
    try {
      const updated = await markNotificationAsRead(notificationId, req.authUser!.userId);
      if (!updated) {
        return res.status(404).json({ error: 'Notification not found.' });
      }
      res.json({ notification: updated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update notification.';
      res.status(500).json({ error: message });
    }
  });

  // Municipal Staff & Admin Routes
  app.get(
    '/api/admin/overview',
    requireAuth,
    requireStaffOrAdmin,
    async (_req: AuthRequest, res) => {
      try {
        const data = await getAdminOperationsData();
        res.json(data);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Failed to load municipal operations.';
        res.status(500).json({ error: message });
      }
    },
  );

  app.patch(
    '/api/admin/reports/:id',
    requireAuth,
    requireStaffOrAdmin,
    async (req: AuthRequest, res) => {
      const reportId = Number(req.params.id);
      if (!Number.isInteger(reportId) || reportId <= 0) {
        return res.status(400).json({ error: 'Invalid report identifier.' });
      }
      try {
        const status = String(req.body?.status || '');
        const priority = String(req.body?.priority || 'Normal');
        const departmentId = req.body?.departmentId ? Number(req.body.departmentId) : null;
        const assignedWorker = req.body?.assignedWorker
          ? String(req.body.assignedWorker)
          : null;
        const note = req.body?.note ? String(req.body.note) : null;

        if (!ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
          return res.status(400).json({ error: 'Invalid report status.' });
        }
        if (!ALLOWED_PRIORITIES.includes(priority as (typeof ALLOWED_PRIORITIES)[number])) {
          return res.status(400).json({ error: 'Invalid priority.' });
        }

        const updated = await updateReportAdmin({
          reportId,
          status,
          departmentId: departmentId && Number.isInteger(departmentId) ? departmentId : null,
          assignedWorker,
          priority,
          note,
          adminUserId: req.authUser!.userId,
        });

        if (!updated) {
          return res.status(404).json({ error: 'Report not found.' });
        }
        res.json({ report: updated });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update report.';
        res.status(500).json({ error: message });
      }
    },
  );

  app.post(
    '/api/admin/bins',
    requireAuth,
    requireStaffOrAdmin,
    async (req: AuthRequest, res) => {
      try {
        const code = String(req.body?.code || '').trim();
        const neighborhood = String(req.body?.neighborhood || '').trim();
        const latitude = parseFiniteCoord(req.body?.latitude, -90, 90);
        const longitude = parseFiniteCoord(req.body?.longitude, -180, 180);
        const type = String(req.body?.type || 'General');
        const status = String(req.body?.status || 'Empty');
        const capacityPct = Number(req.body?.capacityPct ?? 0);

        if (!code || !neighborhood || latitude === null || longitude === null) {
          return res.status(400).json({
            error: 'Bin code, neighborhood, and valid coordinates are required.',
          });
        }
        if (!ALLOWED_BIN_TYPES.includes(type as (typeof ALLOWED_BIN_TYPES)[number])) {
          return res.status(400).json({ error: 'Invalid bin type.' });
        }
        if (!ALLOWED_BIN_STATUSES.includes(status as (typeof ALLOWED_BIN_STATUSES)[number])) {
          return res.status(400).json({ error: 'Invalid bin status.' });
        }

        const created = await createBinRecord({
          code,
          neighborhood,
          latitude,
          longitude,
          type,
          status,
          capacityPct: Number.isFinite(capacityPct) ? capacityPct : 0,
        });
        res.status(201).json({ bin: created });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create bin.';
        res.status(500).json({ error: message });
      }
    },
  );

  app.patch(
    '/api/admin/bins/:id',
    requireAuth,
    requireStaffOrAdmin,
    async (req: AuthRequest, res) => {
      const binId = Number(req.params.id);
      if (!Number.isInteger(binId) || binId <= 0) {
        return res.status(400).json({ error: 'Invalid bin identifier.' });
      }
      try {
        const status = String(req.body?.status || '');
        const capacityPct = Number(req.body?.capacityPct ?? 0);
        if (!ALLOWED_BIN_STATUSES.includes(status as (typeof ALLOWED_BIN_STATUSES)[number])) {
          return res.status(400).json({ error: 'Invalid bin status.' });
        }
        const updated = await updateBinRecord(
          binId,
          status,
          Number.isFinite(capacityPct) ? capacityPct : 0,
        );
        if (!updated) {
          return res.status(404).json({ error: 'Bin not found.' });
        }
        res.json({ bin: updated });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update bin.';
        res.status(500).json({ error: message });
      }
    },
  );

  app.patch(
    '/api/admin/users/:id/role',
    requireAuth,
    requireAdmin,
    async (req: AuthRequest, res) => {
      const targetUserId = Number(req.params.id);
      const roleId = Number(req.body?.roleId);
      const departmentId = req.body?.departmentId ? Number(req.body.departmentId) : null;
      if (!Number.isInteger(targetUserId) || !Number.isInteger(roleId)) {
        return res.status(400).json({ error: 'Invalid user or role identifier.' });
      }
      try {
        const updated = await updateUserRoleAndDepartment(
          targetUserId,
          roleId,
          departmentId && Number.isInteger(departmentId) ? departmentId : null,
        );
        if (!updated) {
          return res.status(404).json({ error: 'User not found.' });
        }
        res.json({ user: updated });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update role.';
        res.status(500).json({ error: message });
      }
    },
  );

  app.post(
    '/api/admin/departments',
    requireAuth,
    requireAdmin,
    async (req: AuthRequest, res) => {
      try {
        const name = String(req.body?.name || '').trim();
        const description = req.body?.description ? String(req.body.description) : null;
        const contactEmail = req.body?.contactEmail ? String(req.body.contactEmail) : null;
        if (name.length < 3) {
          return res.status(400).json({ error: 'Department name is required.' });
        }
        const created = await createDepartmentRecord({ name, description, contactEmail });
        res.status(201).json({ department: created });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create department.';
        res.status(500).json({ error: message });
      }
    },
  );

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Smart Waste Alert server listening on port ${port}`);
  });
}

startServer();
