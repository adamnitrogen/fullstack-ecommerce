export const downloadCSV = (data: Record<string, unknown>[], filename: string) => {
  if (data.length === 0) return;

  // Get headers from the first object
  const headers = Object.keys(data[0]);

  // Create CSV content
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Handle values that contain commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const flattenObject = (obj: Record<string, unknown>, prefix = ''): Record<string, unknown> => {
  return Object.keys(obj).reduce((acc: Record<string, unknown>, key: string) => {
    const pre = prefix.length ? `${prefix}_` : '';
    const value = obj[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(acc, flattenObject(value as Record<string, unknown>, pre + key));
    } else if (Array.isArray(value)) {
      acc[pre + key] = value.join('; ');
    } else {
      acc[pre + key] = value;
    }
    return acc;
  }, {});
};
