export interface CategoryItem {
  categoryId: number;
  name: string;
  description: string | null;
}

export interface DepartmentItem {
  departmentId: number;
  name: string;
  description: string | null;
  contactEmail: string | null;
}

export interface BinItem {
  binId: number;
  code: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  type: 'General' | 'Recyclable' | 'Organic' | 'Market' | string;
  status: 'Empty' | 'Half Full' | 'Full' | 'Overflowing' | 'Damaged' | string;
  capacityPct: number;
  updatedAt: string;
}

export interface StatusUpdateItem {
  statusupdateId: number;
  oldstatus: string;
  newstatus: string;
  note: string | null;
  timestamp: string;
  updatedByName: string;
}

export interface ReportItem {
  reportId: number;
  referenceCode: string;
  title: string;
  description: string;
  neighborhood: string;
  photoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  dateSubmitted: string;
  status: 'Pending' | 'In Progress' | 'Resolved' | string;
  reportType: 'Complaint' | 'Collection Point Request' | string;
  priority: 'Normal' | 'High' | 'Urgent' | string;
  citizenId: number;
  citizenName: string;
  citizenEmail?: string | null;
  citizenPhone?: string | null;
  departmentId: number | null;
  departmentName: string | null;
  assignedWorker: string | null;
  binId: number | null;
  binCode: string | null;
  duplicateOfReportId: number | null;
  upvotes: number;
  preferredChannel: string;
  categories: { categoryId: number; name: string }[];
  timeline: StatusUpdateItem[];
}

export interface AnalyticsSummary {
  totals: {
    totalReports: number;
    pendingCount: number;
    inProgressCount: number;
    resolvedCount: number;
    collectionRequestsCount: number;
    duplicateCount: number;
    resolutionRatePct: number;
  };
  byNeighborhood: {
    neighborhood: string;
    total: number;
    pending: number;
    inProgress: number;
    resolved: number;
  }[];
  byCategory: {
    name: string;
    count: number;
  }[];
  byHour: {
    hour: number;
    label: string;
    count: number;
  }[];
  peakReportingWindow: string;
}

export interface DuplicateMatch {
  reportId: number;
  referenceCode: string;
  title: string;
  neighborhood: string;
  status: string;
  dateSubmitted: string;
  upvotes: number;
  distanceMeters: number | null;
  categories: { categoryId: number; name: string }[];
}

export interface NotificationItem {
  notificationId: number;
  reportId: number;
  message: string;
  channel: string;
  isRead: boolean;
  datesend: string;
  referenceCode: string;
}

export interface AuthUser {
  userId: number;
  uid: string;
  fullname: string;
  email: string;
  phone: string | null;
  roleId: number;
  rolename: 'Citizen' | 'Staff' | 'Admin' | string;
  departmentId: number | null;
  permissions: string[];
}

export interface AdminUserItem {
  userId: number;
  fullname: string;
  email: string;
  phone: string | null;
  roleId: number;
  rolename: string;
  departmentId: number | null;
  departmentName: string | null;
  createdAt: string;
}

export interface RoleItem {
  roleId: number;
  rolename: string;
}

export interface PermissionItem {
  permissionId: number;
  permissionname: string;
}

export interface RolePermissionItem {
  roleId: number;
  permissionId: number;
}
