import {
  FONT_IDS,
  ROLE_LABELS,
  ROLE_ORDER,
  fontFamilyStack,
  getFont,
  suggestPairings,
  type FontId,
  type FontRole,
} from '@kc/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { preloadFontsForPicker } from '../fonts/fonts';

/**
 * Font picker for a 144-face library.
 *
 * A flat list of 144 names is unusable, and rendering 144 live previews at once
 * would pull every font in the library over the network - the exact thing the
 * lazy loader exists to avoid. So this searches, groups by category, and only
 * loads previews for the rows currently on screen.
 *
 * When `pairWith` is given, faces that genuinely work against it are promoted
 * to the top. Pairing is the whole aesthetic, and it is far too easy to pick two
 * grotesks that quietly fight each other.
 */

interface Props {
  value: string;
  onChange: (fontId: FontId) => void;
  /** Show faces that pair well with this one first. */
  pairWith?: string;
  onClose?: () => void;
}

export function FontPicker({ value, onChange, pairWith, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<FontRole | 'all' | 'pairs'>(pairWith ? 'pairs' : 'all');
  const listRef = useRef<HTMLDivElement>(null);

  const pairIds = useMemo(
    () => (pairWith ? new Set(suggestPairings(pairWith, 40).map((f) => f.id)) : new Set<string>()),
    [pairWith],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    let ids = FONT_IDS.filter((id) => {
      const font = getFont(id);
      if (q && !font.family.toLowerCase().includes(q) && !font.vibe.toLowerCase().includes(q)) {
        return false;
      }
      if (role === 'pairs') return pairIds.has(id);
      if (role !== 'all' && font.role !== role) return false;
      return true;
    });

    // Best pairings first, then alphabetical within a category.
    if (pairWith && role !== 'pairs') {
      ids = ids.sort((a, b) => Number(pairIds.has(b)) - Number(pairIds.has(a)));
    }
    return ids;
  }, [query, role, pairIds, pairWith]);

  // Only fetch the faces actually shown, and only the first screenful eagerly.
  useEffect(() => {
    preloadFontsForPicker(results.slice(0, 24));
  }, [results]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const ids = entries
          .filter((e) => e.isIntersecting)
          .map((e) => (e.target as HTMLElement).dataset.fontId)
          .filter((id): id is string => Boolean(id));
        if (ids.length > 0) preloadFontsForPicker(ids);
      },
      { root: el, rootMargin: '200px' },
    );

    el.querySelectorAll('[data-font-id]').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [results]);

  const grouped = useMemo(() => {
    const map = new Map<FontRole, FontId[]>();
    for (const id of results) {
      const r = getFont(id).role;
      map.set(r, [...(map.get(r) ?? []), id]);
    }
    return ROLE_ORDER.filter((r) => map.has(r)).map((r) => [r, map.get(r)!] as const);
  }, [results]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 border-b border-ink-800 p-2">
        <input
          autoFocus
          className="field py-1.5"
          placeholder={`Search ${FONT_IDS.length} fonts…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex gap-1 overflow-x-auto pb-1">
          {pairWith && <Chip active={role === 'pairs'} onClick={() => setRole('pairs')}>Pairs well</Chip>}
          <Chip active={role === 'all'} onClick={() => setRole('all')}>All</Chip>
          {ROLE_ORDER.map((r) => (
            <Chip key={r} active={role === r} onClick={() => setRole(r)}>
              {ROLE_LABELS[r]}
            </Chip>
          ))}
        </div>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1">
        {results.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-ink-500">
            Nothing matches “{query}”.
          </p>
        )}

        {grouped.map(([groupRole, ids]) => (
          <section key={groupRole}>
            <h4 className="sticky top-0 z-10 bg-ink-900/95 px-2 py-1 text-[10px] uppercase tracking-wider text-ink-500 backdrop-blur">
              {ROLE_LABELS[groupRole]}
              <span className="ml-1.5 text-ink-700">{ids.length}</span>
            </h4>
            {ids.map((id) => {
              const font = getFont(id);
              return (
                <button
                  key={id}
                  data-font-id={id}
                  onClick={() => {
                    onChange(id);
                    onClose?.();
                  }}
                  title={font.vibe}
                  className={cn(
                    'flex w-full items-baseline justify-between gap-3 rounded px-2 py-2 text-left transition',
                    id === value ? 'bg-accent/15 text-accent-soft' : 'hover:bg-ink-800',
                  )}
                >
                  <span
                    className="min-w-0 flex-1 truncate text-xl leading-tight"
                    style={{ fontFamily: fontFamilyStack(id) }}
                  >
                    {font.family}
                  </span>
                  <span className="shrink-0 text-[10px] text-ink-600">
                    {pairWith && pairIds.has(id) && id !== pairWith ? '★ ' : ''}
                    {font.weights.length}w
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] transition',
        active
          ? 'border-accent bg-accent/15 text-accent-soft'
          : 'border-ink-700 text-ink-400 hover:border-ink-500 hover:text-ink-200',
      )}
    >
      {children}
    </button>
  );
}
