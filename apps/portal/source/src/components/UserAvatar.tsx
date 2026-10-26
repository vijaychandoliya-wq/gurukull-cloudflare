import React, { useEffect, useMemo, useState } from 'react';
import Avvvatars from 'avvvatars-react';
import { apiClient } from '../services/api';

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : value.slice(0, 2)).toUpperCase();
}

export const UserAvatar: React.FC<{
  name?: string | null;
  src?: string | null;
  size?: number;
  alt?: string;
}> = ({ name, src, size = 40, alt }) => {
  const value = name?.trim() || 'Gurukull user';
  if (src) return <img src={src} width={size} height={size} alt={alt || value} style={{ display: 'block', objectFit: 'cover', borderRadius: '50%' }} />;
  return <span role="img" aria-label={alt || value} style={{ display: 'inline-flex', width: size, height: size, flex: `0 0 ${size}px` }}><Avvvatars value={value} displayValue={initials(value)} size={size} style="character" radius={size} border /></span>;
};

export const AuthenticatedAvatar: React.FC<{
  name?: string | null;
  src?: string | null;
  size?: number;
  alt?: string;
}> = ({ name, src, size = 40, alt }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const fallback = useMemo(() => <UserAvatar name={name} size={size} alt={alt} />, [name, size, alt]);

  useEffect(() => {
    let cancelled = false;
    if (!src || src.startsWith('blob:') || src.startsWith('data:')) {
      setObjectUrl(src || null);
      return () => { cancelled = true; };
    }
    (async () => {
      try {
        const response = await apiClient.get(src, { responseType: 'blob' });
        if (!cancelled) setObjectUrl(URL.createObjectURL(response.data));
      } catch {
        if (!cancelled) setObjectUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [src]);

  useEffect(() => () => { if (objectUrl?.startsWith('blob:')) URL.revokeObjectURL(objectUrl); }, [objectUrl]);
  return objectUrl ? <UserAvatar name={name} src={objectUrl} size={size} alt={alt} /> : fallback;
};
