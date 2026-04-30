import { useEffect } from 'react';

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Bloomsday Natives` : 'Bloomsday Natives';
    return () => { document.title = 'Bloomsday Natives'; };
  }, [title]);
}
