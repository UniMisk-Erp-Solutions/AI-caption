import { estimateTimings, groupIntoScenes, getPreset, autoDesign } from '@kc/shared';
import { useMemo, useState } from 'react';
import { Modal } from '../../components/ui';
import { cn } from '../../lib/cn';
import { formatTime } from '../../lib/format';
import { setSceneHero } from '../../lib/recompose';
import { useEditorStore } from '../../stores/editorStore';

/**
 * The transcript panel.
 *
 * Serves two jobs that both matter:
 *
 *  1. Fixing what the model heard. Editing a word here rewrites it everywhere
 *     it appears on screen, without touching its timing or its styling.
 *  2. Choosing the hero word. Clicking the star on a word promotes it and
 *     recomposes that scene around it - which is by far the fastest way to fix
 *     a design that emphasised the wrong thing.
 */

export function TranscriptPanel() {
  const state = useEditorStore((s) => s.state);
  const timeMs = useEditorStore((s) => s.timeMs);
  const setTime = useEditorStore((s) => s.setTime);
  const updateWord = useEditorStore((s) => s.updateWord);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const heroWordIds = useMemo(() => {
    const ids = new Set<string>();
    for (const scene of state?.design.scenes ?? []) {
      for (const layer of scene.layers) {
        for (const run of layer.runs) {
          if (run.emphasis === 'hero') run.wordIds.forEach((id) => ids.add(id));
        }
      }
    }
    return ids;
  }, [state?.design.scenes]);

  const sceneOfWord = useMemo(() => {
    const map = new Map<string, string>();
    for (const scene of state?.design.scenes ?? []) {
      for (const id of scene.wordIds) map.set(id, scene.id);
    }
    return map;
  }, [state?.design.scenes]);

  if (!state) return null;
  const words = state.transcript.words;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-ink-800 px-4 py-2.5">
        <div>
          <h3 className="label">Transcript</h3>
          <p className="mt-0.5 text-[10px] text-ink-600">
            {state.transcript.contentType} · {state.transcript.language} · {words.length} words
          </p>
        </div>
        <button className="btn-ghost text-[11px]" onClick={() => setPasteOpen(true)}>
          {words.length === 0 ? 'Add words' : 'Replace'}
        </button>
      </header>

      {words.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-ink-400">No transcript yet.</p>
          <p className="max-w-[220px] text-[11px] leading-relaxed text-ink-600">
            Paste what is said in the video and captions will be designed around it.
          </p>
          <button className="btn-primary" onClick={() => setPasteOpen(true)}>
            Paste transcript
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="flex flex-wrap gap-1">
            {words.map((word) => {
              const active = timeMs >= word.startMs && timeMs <= word.endMs;
              const isHero = heroWordIds.has(word.id);
              const estimated = (word.confidence ?? 1) < 0.4;

              if (editingId === word.id) {
                return (
                  <input
                    key={word.id}
                    autoFocus
                    defaultValue={word.text}
                    className="field w-24 px-1.5 py-0.5 text-xs"
                    onBlur={(e) => {
                      const text = e.target.value.trim();
                      if (text && text !== word.text) updateWord(word.id, { text });
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                );
              }

              return (
                <span key={word.id} className="group relative inline-flex">
                  <button
                    onClick={() => setTime(word.startMs + 10)}
                    onDoubleClick={() => setEditingId(word.id)}
                    title={`${formatTime(word.startMs, true)} — double-click to edit`}
                    className={cn(
                      'rounded px-1.5 py-0.5 text-xs transition',
                      active
                        ? 'bg-accent/25 text-accent-soft'
                        : isHero
                          ? 'bg-ink-700 text-ink-100'
                          : 'text-ink-300 hover:bg-ink-800',
                      estimated && 'underline decoration-dotted decoration-ink-600 underline-offset-2',
                    )}
                  >
                    {word.text}
                  </button>

                  {!isHero && (
                    <button
                      title="Make this the hero word for its scene"
                      className="absolute -right-0.5 -top-1.5 hidden h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[8px] text-ink-950 group-hover:flex"
                      onClick={() => {
                        const sceneId = sceneOfWord.get(word.id);
                        const current = useEditorStore.getState().state;
                        if (!sceneId || !current) return;
                        const rebuilt = setSceneHero(current, sceneId, word.id);
                        if (rebuilt) useEditorStore.getState().replaceScene(rebuilt);
                      }}
                    >
                      ★
                    </button>
                  )}
                </span>
              );
            })}
          </div>

          <p className="mt-4 text-[10px] leading-relaxed text-ink-600">
            Click a word to jump to it. Double-click to fix it. Hover and press ★
            to make it the hero of its scene. Dotted words have estimated timings.
          </p>
        </div>
      )}

      <PasteTranscriptModal open={pasteOpen} onClose={() => setPasteOpen(false)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PasteTranscriptModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useEditorStore((s) => s.state);
  const [text, setText] = useState('');

  const apply = () => {
    const current = useEditorStore.getState().state;
    if (!current || text.trim().length === 0) return;

    const words = estimateTimings(text, { durationMs: current.project.durationMs });
    const preset = getPreset(current.design.direction.preset);
    const dims = { width: current.project.width, height: current.project.height };
    const groups = groupIntoScenes(words, { targetWords: preset.sceneWordTarget });
    const scenes = autoDesign(words, current.design.direction, dims, groups);

    // Replacing the transcript necessarily replaces every scene, so this is one
    // of the few places that legitimately discards hand-edited layers.
    useEditorStore.setState((s) =>
      s.state
        ? {
            state: {
              ...s.state,
              transcript: { ...s.state.transcript, words },
              design: { ...s.state.design, scenes },
              revision: s.state.revision + 1,
              updatedAt: Date.now(),
            },
          }
        : s,
    );

    setText('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Paste the transcript">
      <p className="mb-3 text-xs leading-relaxed text-ink-400">
        Type or paste exactly what is said or sung. Timings are estimated from
        the rhythm of the text, then you can nudge any word on the timeline.
      </p>
      <textarea
        className="field min-h-[180px] resize-y leading-relaxed"
        placeholder={'a holiday in my life as a girl in new york city\nand these are the things that helped me grow'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-ink-600">
          {text.trim().split(/\s+/).filter(Boolean).length} words ·{' '}
          {((state?.project.durationMs ?? 0) / 1000).toFixed(1)}s of video
        </span>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={apply} disabled={text.trim().length === 0}>
            Design captions
          </button>
        </div>
      </div>
    </Modal>
  );
}
