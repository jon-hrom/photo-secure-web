import { useCallback, useEffect, useRef, useState } from 'react';
import { detectPeople } from './index';
import { activeZones, zoneMask, zonesPreview, restoreExcluded, Person } from './people';
import type { BodyGeo } from './detect';
import type { PlasticParams } from './warp';

export interface PeopleState {
  status: 'idle' | 'detecting' | 'ready';
  people: Person[];
  geo: BodyGeo | null;
  img: HTMLImageElement | null;
  selected: Set<number>;
  toggle: (id: number) => void;
  /** Белая маска зон пластики всех выбранных людей — или null, если зон нет */
  buildMask: (w: number, h: number, params: PlasticParams) => HTMLCanvasElement | null;
  /** Вернуть снятым с обработки людям исходные пиксели */
  restore: (resultUrl: string, originalUrl: string) => Promise<string>;
  found: { faces: number; bodies: number } | null;
}

/** Находит людей на фото и хранит, кого обрабатываем. */
export const usePeople = (url: string, params: PlasticParams): PeopleState & { preview: string } => {
  const [status, setStatus] = useState<PeopleState['status']>('idle');
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [preview, setPreview] = useState('');
  const geoRef = useRef<BodyGeo | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    geoRef.current = null;
    imgRef.current = null;
    setPeople([]);
    setSelected(new Set());
    setPreview('');
    if (!url) {
      setStatus('idle');
      return;
    }
    let alive = true;
    setStatus('detecting');
    detectPeople(url)
      .then(({ img, geo, people: found }) => {
        if (!alive) return;
        geoRef.current = geo;
        imgRef.current = img;
        setPeople(found);
        setSelected(new Set(found.map((p) => p.id)));
        setStatus('ready');
      })
      .catch((e) => {
        console.warn('[PLASTIC] people detect failed', e);
        if (alive) setStatus('ready');
      });
    return () => {
      alive = false;
    };
  }, [url]);

  const toggle = useCallback((id: number) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const chosen = people.filter((p) => selected.has(p.id));

  useEffect(() => {
    const img = imgRef.current;
    const geo = geoRef.current;
    if (!img || !geo || !activeZones(params).length || !chosen.length) {
      setPreview('');
      return;
    }
    const t = setTimeout(() => setPreview(zonesPreview(img, geo, chosen, params)), 150);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, people, selected]);

  const buildMask = useCallback(
    (w: number, h: number, p: PlasticParams) => {
      const geo = geoRef.current;
      if (!geo || !activeZones(p).length) return null;
      const list = people.filter((x) => selected.has(x.id));
      if (!list.length) return null;
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const ctx = out.getContext('2d')!;
      for (const person of list) ctx.drawImage(zoneMask(w, h, geo, person, p), 0, 0);
      return out;
    },
    [people, selected],
  );

  const restore = useCallback(
    (resultUrl: string, originalUrl: string) => {
      const geo = geoRef.current;
      const excluded = people.filter((x) => !selected.has(x.id));
      if (!geo || !excluded.length) return Promise.resolve(resultUrl);
      return restoreExcluded(resultUrl, originalUrl, geo, excluded);
    },
    [people, selected],
  );

  const found = status === 'ready' && geoRef.current
    ? { faces: geoRef.current.faces.length, bodies: geoRef.current.poses.length }
    : null;

  return { status, people, geo: geoRef.current, img: imgRef.current, selected, toggle, buildMask, restore, found, preview };
};
