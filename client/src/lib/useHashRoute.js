import { useEffect, useState } from 'react';
const read = () => window.location.hash.replace(/^#\/?/, '').split('?')[0];
export function useHashRoute() {
  const [route, setRoute] = useState(read());
  useEffect(() => { const f = () => { setRoute(read()); window.scrollTo(0, 0); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return route;
}
