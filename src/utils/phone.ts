export const normalizePhone = (v?: string): string => {
  if (!v) return v ?? '';
  const d = v.replace(/[\s\-()]/g, '');
  if (d.startsWith('+91')) return d.slice(3);
  if (d.startsWith('91') && d.length === 12) return d.slice(2);
  if (d.startsWith('0')) return d.slice(1);
  return d;
};

export const isValidPhone = (v: string): boolean => {
  if (!v) return true;
  return /^[6-9]\d{9}$/.test(normalizePhone(v));
};
