import { useEffect, useMemo, useState } from 'react';
import { validatePoemMetadata, type PoemMetadata } from '../lib/validation';

export type PoemMeta = { filename: string; tags: string[] };
export type PoemsJson = { poems: PoemMeta[]; lastUpdated?: string };

export function usePoems() {
  const [data, setData] = useState<PoemsJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function run() {
      setLoading(true);
      try {
        const base = new URL(import.meta.env.BASE_URL, window.location.origin);
        const poemsUrl = new URL('poems/poems.json', base).toString();
        const res = await fetch(poemsUrl, { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`Failed to fetch poems.json (${res.status})`);
        const json = await res.json();
        
        // Validate the structure of poems.json
        if (!json || typeof json !== 'object' || !('poems' in json)) {
          throw new Error('Invalid poems.json format: missing poems array');
        }
        
        if (!validatePoemMetadata(json.poems)) {
          throw new Error('Invalid poems.json format: invalid poem metadata');
        }
        
        if (alive) { 
          setData({ 
            poems: json.poems as PoemMetadata[],
            lastUpdated: json.lastUpdated 
          }); 
          setError(null); 
        }
      } catch (e) {
        if (alive) setError((e instanceof Error ? e.message : String(e)) || 'Unknown error fetching poems.json');
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => { alive = false; };
  }, []);

  const poems = useMemo(() => {
    if (!data?.poems) return [];
    // Sort poems alphabetically by filename (case-insensitive)
    return [...data.poems].sort((a, b) => {
      const nameA = a.filename.replace('.md', '').toLowerCase();
      const nameB = b.filename.replace('.md', '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [data]);

  const tags = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of poems) for (const t of (p.tags || [])) counts[t] = (counts[t] || 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8) // Limit to top 8 tags
      .map(([tag, count]) => ({ tag, count }));
  }, [poems]);

  const lastUpdated = useMemo(() => data?.lastUpdated || null, [data]);

  return { poems, tags, loading, error, lastUpdated };
}