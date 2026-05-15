
export const getAssetPath = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  
  const base = import.meta.env.BASE_URL || '/';
  // Remove leading slash from path and trailing slash from base to join them
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  
  return `${cleanBase}${cleanPath}`;
};
