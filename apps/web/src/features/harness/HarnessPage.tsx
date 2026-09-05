import {
  autoDesign,
  editorStateSchema,
  formatScorecard,
  scoreDesign,
  groupIntoScenes,
  getPreset,
  layerText,
  type EditorState,
} from '@kc/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { apiHealth, completeUpload, performUpload, requestDownloadUrl, requestUploadUrl } from '../../lib/api';
import { recordAsset, supabase } from '../../lib/supabase';
import { exportStill, exportVideo } from '../../media/export';
import { probeMedia } from '../../media/probe';
import { extractAudioForTranscription } from '../../media/audio';
import { analyzeScenes } from '../../media/frames';
import { runPipeline, type StepState } from '../processing/pipeline';

/**
 * End-to-end harness.
 *
 * Runs the real pipeline - not a mock of it - against a real clip: probe,
 * extract audio, Gemini transcription, Gemini verification, keyframes, Gemma
 * design, then a WebCodecs export. The finished MP4 is posted back to a local
 * bridge that writes it to disk.
 *
 * It exists because the parts that are most likely to break are precisely the
 * parts that cannot run in Node: canvas text metrics, font loading, WebCodecs.
 * Auto-runs with `?auto=1` so it can be driven headlessly.
 */

const BRIDGE = 'http://localhost:5299';

/**
 * Credentials for the harness's own test account.
 *
 * Read from the environment rather than hardcoded: this is a real login against
 * a real Supabase project, and a password committed to a repository is a
 * password that has to be rotated. Create the user once with the Supabase admin
 * API, then put these in `apps/web/.env.local`.
 */
const TEST_EMAIL = import.meta.env.VITE_HARNESS_EMAIL ?? '';
const TEST_PASSWORD = import.meta.env.VITE_HARNESS_PASSWORD ?? '';

async function signInAsHarnessUser() {
  if (!supabase) throw new Error('Supabase is not configured in this build.');
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error(
      'Set VITE_HARNESS_EMAIL and VITE_HARNESS_PASSWORD in apps/web/.env.local to run the harness.',
    );
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  return { auth: data, client: supabase };
}

type Status = 'idle' | 'running' | 'done' | 'failed';

interface LogLine {
  at: number;
  text: string;
  kind: 'info' | 'ok' | 'warn' | 'fail';
}

export function HarnessPage() {
  const [status, setStatus] = useState<Status>('idle');
  const [log, setLog] = useState<LogLine[]>([]);
  const [steps, setSteps] = useState<StepState[]>([]);
  const [design, setDesign] = useState<EditorState | null>(null);
  const startedRef = useRef(false);

  const say = useCallback((text: string, kind: LogLine['kind'] = 'info') => {
    setLog((prev) => [...prev, { at: Date.now(), text, kind }]);
    // Mirror to the bridge so a headless run leaves a readable trace.
    void fetch(`${BRIDGE}/log`, { method: 'POST', body: `[${kind}] ${text}` }).catch(() => undefined);
  }, []);

  const run = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStatus('running');
    const t0 = Date.now();

    try {
      /* ---------------------------------------------- preflight ---- */
      const health = await apiHealth();
      say(`worker ok · models: ${JSON.stringify((health as { models?: unknown }).models)}`, 'ok');
      const { auth, client } = await signInAsHarnessUser();
      const userId = auth.user!.id;
      say(`signed in as ${userId}`, 'ok');

      /* ---------------------------------------------- source ------- */
      const response = await fetch(`${BRIDGE}/test.mp4`);
      if (!response.ok) throw new Error('could not fetch test.mp4 from the bridge');
      const file = await response.blob();
      say(`fetched test.mp4 · ${(file.size / 1024 / 1024).toFixed(2)} MB`, 'ok');

      const media = await probeMedia(file);
      say(
        `probed · ${media.width}x${media.height} · ${(media.durationMs / 1000).toFixed(1)}s · ` +
          `${media.videoCodec}/${media.audioCodec ?? 'no audio'} · decodable=${media.decodable}`,
        'ok',
      );

      /* ---------------------------------------------- project ------ */
      const projectId = crypto.randomUUID();
      const { error: insertError } = await client.from('projects').insert({
        id: projectId,
        user_id: userId,
        title: 'Harness run',
        status: 'processing',
        width: media.width,
        height: media.height,
        fps: media.fps,
        duration_ms: media.durationMs,
      });
      if (insertError) throw new Error(`project insert failed: ${insertError.message}`);
      say(`created project ${projectId}`, 'ok');

      /* ---------------------------------------------- audio -------- */
      // Dumped to the bridge so the exact bytes sent to Gemini can be replayed
      // outside the browser when transcription misbehaves.
      const audio = await extractAudioForTranscription(file);
      say(`extracted audio · ${(audio.blob.size / 1024).toFixed(0)} KB @ ${audio.sampleRate} Hz mono`, 'ok');
      await fetch(`${BRIDGE}/result`, {
        method: 'POST',
        headers: { 'X-Result-Name': 'speech.wav' },
        body: audio.blob,
      }).catch(() => undefined);

      /* ---------------------------------------------- pipeline ----- */
      say('running the real pipeline (Gemini transcribe -> verify -> Gemma design)…');
      const result = await runPipeline(
        { projectId, file, media, mode: 'auto' },
        setSteps,
      );

      for (const warning of result.warnings) say(warning, 'warn');
      setDesign(result.state);

      const words = result.state.transcript.words;
      say(
        `transcript · ${words.length} words · ${result.state.transcript.contentType} · ` +
          `"${words.slice(0, 12).map((w) => w.text).join(' ')}…"`,
        'ok',
      );
      say(
        `design · preset ${result.state.design.direction.preset} · ` +
          `${result.state.design.scenes.length} scenes`,
        'ok',
      );

      for (const scene of result.state.design.scenes.slice(0, 6)) {
        const hero = scene.layers
          .flatMap((l) => l.runs)
          .filter((r) => r.emphasis === 'hero')
          .map((r) => `${r.text}(${r.fontId})`)
          .join(', ');
        say(
          `  ${scene.id} [${scene.compositionId}] ` +
            `${scene.layers.map(layerText).join(' / ')}` +
            (hero ? `  hero: ${hero}` : '  (no hero)'),
        );
      }

      /* ---------------------------------------------- export ------- */
      say('exporting MP4 with WebCodecs…');
      const output = await exportVideo(
        file,
        result.state,
        {
          // Keep the source shape rather than forcing 9:16, so the export can be
          // compared frame-for-frame with the preview.
          width: media.width % 2 === 0 ? media.width : media.width - 1,
          height: media.height % 2 === 0 ? media.height : media.height - 1,
          fps: 30,
          bitrate: 6_000_000,
          includeAudio: true,
        },
        (progress) => {
          if (progress.frame && progress.frame % 60 === 0) {
            say(`  rendering ${progress.frame}/${progress.totalFrames}`);
          }
        },
      );
      say(`rendered ${(output.blob.size / 1024 / 1024).toFixed(2)} MB`, 'ok');

      const written = await fetch(`${BRIDGE}/result`, {
        method: 'POST',
        headers: { 'X-Result-Name': 'result.mp4' },
        body: output.blob,
      });
      if (!written.ok) throw new Error(`bridge refused the result: ${await written.text()}`);
      say(`wrote ${await written.text()}`, 'ok');

      /* ---------------------------------------------- stills ------- */
      // Cache the design and a still per scene, so the output can be inspected
      // (and the renderer re-checked) without spending another AI call.
      await fetch(`${BRIDGE}/result`, {
        method: 'POST',
        headers: { 'X-Result-Name': 'design.json' },
        body: new Blob([JSON.stringify(result.state, null, 2)], { type: 'application/json' }),
      }).catch(() => undefined);

      let index = 0;
      for (const scene of result.state.design.scenes) {
        index++;
        // Sample late in the scene so every line has finished entering.
        const at = scene.startMs + (scene.endMs - scene.startMs) * 0.85;
        const png = await exportStill(file, result.state, at, media.width, media.height);
        await fetch(`${BRIDGE}/result`, {
          method: 'POST',
          headers: { 'X-Result-Name': `still-${index}.png` },
          body: png,
        }).catch(() => undefined);
        say(`  still-${index}.png at ${(at / 1000).toFixed(1)}s`);
      }

      say(`DONE in ${((Date.now() - t0) / 1000).toFixed(1)}s`, 'ok');
      setStatus('done');
    } catch (error) {
      say(error instanceof Error ? error.message : String(error), 'fail');
      say('FAILED', 'fail');
      setStatus('failed');
    }
  }, [say]);

  /**
   * Storage round trip, isolated from the AI so it can be re-run freely.
   *
   * Covers the whole chain that only exists in production: signed ticket ->
   * upload -> album filing -> asset row -> ownership check -> read token ->
   * streaming proxy. Bytes are compared at the end, because "HTTP 200" is not
   * the same as "the file came back intact".
   */
  const runStorage = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStatus('running');

    try {
      const health = (await apiHealth()) as { storage?: Record<string, unknown> };
      say(`storage: ${JSON.stringify(health.storage)}`, 'ok');
      const { auth, client } = await signInAsHarnessUser();
      say(`signed in as ${auth.user!.id}`, 'ok');

      const file = await (await fetch(`${BRIDGE}/test.mp4`)).blob();
      const media = await probeMedia(file);

      const projectId = crypto.randomUUID();
      const { error: insertError } = await client.from('projects').insert({
        id: projectId,
        user_id: auth.user!.id,
        title: 'Storage test',
        status: 'ready',
        width: media.width,
        height: media.height,
        fps: media.fps,
        duration_ms: media.durationMs,
      });
      if (insertError) throw new Error(`project insert failed: ${insertError.message}`);
      say(`project ${projectId}`, 'ok');

      const ticket = await requestUploadUrl({
        projectId,
        mimeType: 'video/mp4',
        size: file.size,
        kind: 'source_video',
        fileName: 'harness-source.mp4',
      });
      say(`ticket · ${ticket.provider} · ${ticket.method} · assignsId=${ticket.objectKey === null}`, 'ok');

      const objectKey = await performUpload(ticket, file, 'harness-source.mp4', (f) => {
        if (f === 1) say('  upload complete');
      });
      say(`uploaded · objectKey ${objectKey}`, 'ok');

      if (!ticket.objectKey) await completeUpload({ projectId, kind: 'source_video', objectKey });
      await recordAsset({
        projectId,
        kind: 'source_video',
        provider: ticket.provider,
        objectKey,
        mimeType: 'video/mp4',
        sizeBytes: file.size,
      });
      say('recorded asset row', 'ok');

      const { url } = await requestDownloadUrl(objectKey);
      say(`read url · ${url.slice(0, 72)}…`, 'ok');

      const back = await fetch(url);
      if (!back.ok) throw new Error(`read failed: HTTP ${back.status}`);
      const roundTripped = await back.blob();

      if (roundTripped.size !== file.size) {
        throw new Error(`size mismatch: sent ${file.size}, got ${roundTripped.size}`);
      }
      say(`round trip verified · ${roundTripped.size} bytes identical`, 'ok');

      // A Range request is what makes a proxied video seekable rather than a
      // full download before playback.
      const ranged = await fetch(url, { headers: { Range: 'bytes=0-1023' } });
      say(
        `range request · HTTP ${ranged.status} · ${(await ranged.blob()).size} bytes` +
          (ranged.status === 206 ? ' (seekable)' : ' (no partial support)'),
        ranged.status === 206 ? 'ok' : 'warn',
      );

      say('STORAGE OK', 'ok');
      say('DONE', 'ok');
      setStatus('done');
    } catch (error) {
      say(error instanceof Error ? error.message : String(error), 'fail');
      say('FAILED', 'fail');
      setStatus('failed');
    }
  }, [say]);

  /**
   * Score an existing design against freshly measured frames.
   *
   * Separate from the full run so placement quality can be re-measured without
   * spending an AI call - which is what makes a before/after comparison honest
   * rather than a re-roll of a non-deterministic pipeline.
   */
  const runScore = useCallback(
    async (designUrl = `${BRIDGE}/design.json`) => {
      if (startedRef.current) return;
      startedRef.current = true;
      setStatus('running');

      try {
        const file = await (await fetch(`${BRIDGE}/test.mp4`)).blob();
        const state = editorStateSchema.parse(await (await fetch(designUrl)).json());
        say(`scoring ${designUrl.split('/').pop()} · ${state.design.scenes.length} scenes`, 'ok');

        const maps = await analyzeScenes(file, state.design.scenes);
        say(`measured ${maps.size} scenes from real pixels`, 'ok');

        for (const scene of state.design.scenes) {
          const map = maps.get(scene.id);
          if (!map) continue;
          say(
            `  ${scene.id} shot=${map.shot} faces=${map.faces.length}` +
              (map.faces[0]
                ? ` at [${map.faces[0].x.toFixed(2)},${map.faces[0].y.toFixed(2)},${map.faces[0].width.toFixed(2)},${map.faces[0].height.toFixed(2)}]`
                : '') +
              (map.subject
                ? ` subject [${map.subject.x.toFixed(2)},${map.subject.y.toFixed(2)},${map.subject.width.toFixed(2)},${map.subject.height.toFixed(2)}]`
                : ''),
          );
        }

        const card = scoreDesign({ state, frameMaps: maps });
        for (const line of formatScorecard(card).split('\n')) say(line, 'info');
        say(`SCORE ${(card.overall * 100).toFixed(0)}% · ${card.passed}/${card.total}`, 'ok');
        say('DONE', 'ok');
        setStatus('done');
      } catch (error) {
        say(error instanceof Error ? error.message : String(error), 'fail');
        say('FAILED', 'fail');
        setStatus('failed');
      }
    },
    [say],
  );

  /**
   * Controlled A/B of the layout engine.
   *
   * Takes one existing transcript and lays it out twice - once blind, once with
   * the measured frames - then scores both. Because the words, timings and art
   * direction are identical and no model is involved, any difference is caused
   * by the placement engine and nothing else.
   *
   * This exists because comparing two full pipeline runs is meaningless:
   * transcription is non-deterministic, so the transcript changes underneath
   * the comparison and the numbers move for reasons unrelated to the change.
   */
  const runRelayout = useCallback(
    async (designUrl = `${BRIDGE}/design-before.json`) => {
      if (startedRef.current) return;
      startedRef.current = true;
      setStatus('running');

      try {
        const file = await (await fetch(`${BRIDGE}/test.mp4`)).blob();
        const source = editorStateSchema.parse(await (await fetch(designUrl)).json());
        const { width, height } = source.project;
        const dims = { width, height };
        const words = source.transcript.words;
        const direction = source.design.direction;

        say(`A/B on ${words.length} words · preset ${direction.preset}`, 'ok');

        const preset = getPreset(direction.preset);
        const groups = groupIntoScenes(words, { targetWords: preset.sceneWordTarget });

        const maps = await analyzeScenes(file, groups);
        say(`measured ${maps.size} scenes`, 'ok');
        for (const [id, map] of maps) {
          say(`  ${id} shot=${map.shot} faces=${map.faces.length}`);
        }

        const variants: Array<[string, ReturnType<typeof autoDesign>]> = [
          ['BLIND (no frame measurement)', autoDesign(words, direction, dims, groups)],
          ['MEASURED (2-D solver)', autoDesign(words, direction, dims, groups, maps)],
        ];

        for (const [label, scenes] of variants) {
          const state = { ...source, design: { direction, scenes } };
          const card = scoreDesign({ state, frameMaps: maps });
          say(`--- ${label} ---`, 'ok');
          for (const line of formatScorecard(card).split('\n')) say(line, 'info');
        }

        // Render the measured variant so the improvement can be looked at, not
        // only read off a scorecard.
        const finalState = { ...source, design: { direction, scenes: variants[1][1] } };
        await fetch(`${BRIDGE}/result`, {
          method: 'POST',
          headers: { 'X-Result-Name': 'design.json' },
          body: new Blob([JSON.stringify(finalState, null, 2)], { type: 'application/json' }),
        }).catch(() => undefined);

        let n = 0;
        for (const scene of finalState.design.scenes) {
          n++;
          const at = scene.startMs + (scene.endMs - scene.startMs) * 0.85;
          for (const [tag, state] of [
            ['blind', { ...source, design: { direction, scenes: variants[0][1] } }],
            ['measured', finalState],
          ] as const) {
            const png = await exportStill(file, state, at, width, height);
            await fetch(`${BRIDGE}/result`, {
              method: 'POST',
              headers: { 'X-Result-Name': `ab-${n}-${tag}.png` },
              body: png,
            }).catch(() => undefined);
          }
          say(`  ab-${n}-blind.png / ab-${n}-measured.png at ${(at / 1000).toFixed(1)}s`);
        }

        say('exporting the measured variant…');
        const output = await exportVideo(
          file,
          finalState,
          {
            width: width % 2 === 0 ? width : width - 1,
            height: height % 2 === 0 ? height : height - 1,
            fps: 30,
            bitrate: 6_000_000,
            includeAudio: true,
          },
          () => undefined,
        );
        await fetch(`${BRIDGE}/result`, {
          method: 'POST',
          headers: { 'X-Result-Name': 'result.mp4' },
          body: output.blob,
        }).catch(() => undefined);
        say(`wrote result.mp4 · ${(output.blob.size / 1024 / 1024).toFixed(2)} MB`, 'ok');

        say('DONE', 'ok');
        setStatus('done');
      } catch (error) {
        say(error instanceof Error ? error.message : String(error), 'fail');
        say('FAILED', 'fail');
        setStatus('failed');
      }
    },
    [say],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('relayout') === '1') void runRelayout(params.get('design') ?? undefined);
    else if (params.get('score') === '1') void runScore(params.get('design') ?? undefined);
    else if (params.get('storage') === '1') void runStorage();
    else if (params.get('auto') === '1') void run();
  }, [run, runStorage, runScore, runRelayout]);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink-100">End-to-end harness</h1>
          <p className="mt-1 text-sm text-ink-400">
            Real clip, real Gemini, real Gemma, real WebCodecs export.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={() => void runRelayout()} disabled={status === 'running'}>
            A/B layout
          </button>
          <button className="btn-outline" onClick={() => void runScore()} disabled={status === 'running'}>
            Score design
          </button>
          <button className="btn-outline" onClick={() => void runStorage()} disabled={status === 'running'}>
            Storage only
          </button>
          <button className="btn-primary" onClick={() => void run()} disabled={status === 'running'}>
            {status === 'running' ? 'Running…' : 'Full run'}
          </button>
        </div>
      </header>

      <div
        id="harness-status"
        data-status={status}
        className={cn(
          'mb-4 rounded border px-3 py-2 text-sm',
          status === 'done'
            ? 'border-emerald-800 bg-emerald-950/30 text-emerald-200'
            : status === 'failed'
              ? 'border-red-900 bg-red-950/30 text-red-200'
              : 'border-ink-700 bg-ink-900 text-ink-300',
        )}
      >
        status: {status}
      </div>

      {steps.length > 0 && (
        <ol className="mb-4 space-y-0.5">
          {steps.map((step) => (
            <li key={step.id} className="flex gap-2 text-[11px]">
              <span
                className={cn(
                  'w-16 shrink-0',
                  step.status === 'done'
                    ? 'text-emerald-400'
                    : step.status === 'failed'
                      ? 'text-red-400'
                      : step.status === 'skipped'
                        ? 'text-ink-600'
                        : 'text-ink-400',
                )}
              >
                {step.status}
              </span>
              <span className="text-ink-300">{step.label}</span>
              <span className="text-ink-600">{step.detail}</span>
            </li>
          ))}
        </ol>
      )}

      <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded border border-ink-800 bg-ink-950 p-3 text-[11px] leading-relaxed">
        {log.map((line, i) => (
          <div
            key={i}
            className={cn(
              line.kind === 'ok'
                ? 'text-emerald-300'
                : line.kind === 'fail'
                  ? 'text-red-300'
                  : line.kind === 'warn'
                    ? 'text-amber-300'
                    : 'text-ink-400',
            )}
          >
            {line.text}
          </div>
        ))}
      </pre>

      {design && (
        <p className="mt-3 text-[11px] text-ink-600">
          {design.design.scenes.length} scenes · {design.transcript.words.length} words ·{' '}
          {design.design.direction.preset}
        </p>
      )}
    </div>
  );
}
