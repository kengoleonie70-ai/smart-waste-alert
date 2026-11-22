import { ReportItem } from '../types.ts';

export const DSCHANG_CENTER = { lat: 5.4439, lng: 10.0533 };

export const DSCHANG_NEIGHBORHOODS: {
  name: string;
  lat: number;
  lng: number;
}[] = [
  { name: 'Marché A', lat: 5.4446, lng: 10.0531 },
  { name: 'Marché B', lat: 5.4472, lng: 10.0558 },
  { name: 'Campus Université de Dschang', lat: 5.4488, lng: 10.0496 },
  { name: 'Foto', lat: 5.4525, lng: 10.0462 },
  { name: 'Foreke', lat: 5.4378, lng: 10.0585 },
  { name: 'Tsinkop', lat: 5.4412, lng: 10.0488 },
  { name: 'Keleng', lat: 5.4541, lng: 10.0604 },
  { name: 'Paid-Ground', lat: 5.4425, lng: 10.0564 },
  { name: 'Canne à Sucre', lat: 5.4459, lng: 10.0448 },
  { name: 'Tsinbing', lat: 5.4396, lng: 10.0521 },
];

export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatExactDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported image format.'));
      img.onload = () => {
        const maxDim = 960;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function exportReportsToCsv(reportList: ReportItem[]) {
  const headers = [
    'Reference Code',
    'Title',
    'Type',
    'Category',
    'Neighborhood',
    'Status',
    'Priority',
    'Department',
    'Assigned Worker',
    'Latitude',
    'Longitude',
    'Confirmations',
    'Submitted At',
  ];

  const escape = (val: unknown) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = reportList.map((r) => [
    r.referenceCode,
    r.title,
    r.reportType,
    r.categories.map((c) => c.name).join(' / '),
    r.neighborhood,
    r.status,
    r.priority,
    r.departmentName || 'Unassigned',
    r.assignedWorker || 'Unassigned',
    r.latitude ?? '',
    r.longitude ?? '',
    r.upvotes,
    r.dateSubmitted,
  ]);

  const csvContent = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `dschang-waste-reports-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
