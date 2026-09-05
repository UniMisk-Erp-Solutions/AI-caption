import { PRESET_REGISTRY, UPLOAD_LIMITS, type PresetId } from '@kc/shared';
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Field, SegmentedControl, Select, Spinner } from '../../components/ui';
import { cn } from '../../lib/cn';
import { hasApi } from '../../lib/env';
import { formatBytes, formatTime } from '../../lib/format';
import { newUuid } from '../../lib/id';
import { createProject, uploadSource } from '../../lib/projectRepo';
import { generateThumbnail, probeMedia, type MediaInfo } from '../../media/probe';
import { ProcessingView } from '../processing/ProcessingView';
import { runPipeline, type StepState, INITIAL_STEPS } from '../processing/pipeline';
import { saveState } from '../../lib/projectRepo';

/**
 * Upload and processing.
 *
 * One screen from file to editor. The media is probed in the browser before
 * anything is uploaded, so unsupported files are rejected in a second rather
 * than after a two-minute upload.
 */

type Stage = 'pick' | 'configure' | 'running';

export function UploadPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [media, setMedia] = useState<MediaInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [mode, setMode] = useState<'auto' | 'speech' | 'song'>('auto');
  const [style, setStyle] = useState<PresetId | 'AUTO'>('AUTO');
  const [transcript, setTranscript] = useState('');

  const [steps, setSteps] = useState<StepState[]>(INITIAL_STEPS);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [uploadFraction, setUploadFraction] = useState<number | null>(null);

  /* ---------------------------------------------------------------- */

  const accept = useCallback(async (candidate: File) => {
    setError(null);

    if (candidate.size > UPLOAD_LIMITS.maxSizeBytes) {
      setError(
        `That file is ${formatBytes(candidate.size)}. The limit is ${formatBytes(UPLOAD_LIMITS.maxSizeBytes)}.`,
      );
      return;
    }

    setProbing(true);
    try {
      const info = await probeMedia(candidate);

      if (info.durationMs > UPLOAD_LIMITS.maxDurationMs) {
        setError(
          `That video is ${formatTime(info.durationMs)}. The limit is ${formatTime(UPLOAD_LIMITS.maxDurationMs)}.`,
        );
        return;
      }

      setFile(candidate);
      setMedia(info);
      setStage('configure');
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not read that file: ${err.message}`
          : 'Could not read that file.',
      );
    } finally {
      setProbing(false);
    }
  }, []);

  const start = useCallback(async () => {
    if (!file || !media) return;

    const projectId = newUuid();
    setStage('running');

    try {
      const thumbnail = await generateThumbnail(file, media.durationMs).catch(() => null);

      await createProject({
        id: projectId,
        title: file.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'Untitled',
        file,
        fileName: file.name,
        width: media.width,
        height: media.height,
        fps: media.fps,
        durationMs: media.durationMs,
        thumbnail,
      });

      // The upload runs alongside the AI work rather than blocking it - the
      // pipeline reads the local blob, so there is no reason to wait.
      const uploading = hasApi
        ? uploadSource(projectId, file, file.name, setUploadFraction).catch(() => null)
        : Promise.resolve(null);

      const result = await runPipeline(
        { projectId, file, media, mode, userTranscript: transcript || undefined, style },
        setSteps,
      );

      setWarnings(result.warnings);
      await saveState(projectId, result.state);
      await uploading;

      navigate(`/project/${projectId}`);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Processing failed.');
      setStage('configure');
    }
  }, [file, media, mode, transcript, style, navigate]);

  /* ---------------------------------------------------------------- */

  if (stage === 'running') {
    return <ProcessingView steps={steps} warnings={warnings} uploadFraction={uploadFraction} />;
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="font-display text-3xl text-ink-100">New project</h1>
      <p className="mt-1.5 text-sm text-ink-400">
        Upload a clip and its words become designed kinetic typography.
      </p>

      {error && (
        <p className="mt-5 rounded border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {stage === 'pick' ? (
        <div
          className={cn(
            'mt-6 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-16 text-center transition',
            dragOver ? 'border-accent bg-accent/5' : 'border-ink-700 hover:border-ink-600',
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) void accept(dropped);
          }}
        >
          {probing ? (
            <div className="flex items-center gap-2 text-sm text-ink-300">
              <Spinner /> Reading the file…
            </div>
          ) : (
            <>
              <p className="text-sm text-ink-300">Drop a video here</p>
              <p className="text-[11px] text-ink-600">
                MP4, MOV, WebM · up to {formatTime(UPLOAD_LIMITS.maxDurationMs)} ·{' '}
                {formatBytes(UPLOAD_LIMITS.maxSizeBytes)}
              </p>
              <button className="btn-primary mt-2" onClick={() => inputRef.current?.click()}>
                Choose a file
              </button>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept={UPLOAD_LIMITS.acceptedExtensions.join(',')}
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (picked) void accept(picked);
            }}
          />
        </div>
      ) : (
        media &&
        file && (
          <div className="mt-6 space-y-6">
            <div className="flex items-center justify-between rounded-lg border border-ink-800 bg-ink-900 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink-200">{file.name}</p>
                <p className="mt-0.5 text-[11px] text-ink-500">
                  {media.width}×{media.height} · {formatTime(media.durationMs)} ·{' '}
                  {formatBytes(file.size)}
                  {!media.hasAudio && ' · no audio track'}
                </p>
              </div>
              <button
                className="btn-ghost shrink-0 text-[11px]"
                onClick={() => {
                  setStage('pick');
                  setFile(null);
                  setMedia(null);
                }}
              >
                Change
              </button>
            </div>

            {!media.decodable && (
              <p className="rounded border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-xs leading-relaxed text-amber-200">
                Your browser cannot decode this codec. You can still create the
                project, but preview and export may not work — try re-encoding
                to H.264 MP4.
              </p>
            )}

            <Field
              label="Audio"
              hint="Song mode listens harder through instrumentation and layered vocals."
            >
              <SegmentedControl
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'speech', label: 'Speech' },
                  { value: 'song', label: 'Song / lyrics' },
                ]}
              />
            </Field>

            <Field label="Look" hint="You can change this at any time in the editor, instantly.">
              <Select
                value={style}
                onChange={(v) => setStyle(v as PresetId | 'AUTO')}
                options={[
                  { value: 'AUTO', label: 'Auto — let the AI choose' },
                  ...(Object.keys(PRESET_REGISTRY) as PresetId[]).map((id) => ({
                    value: id,
                    label: PRESET_REGISTRY[id].label,
                  })),
                ]}
              />
            </Field>

            <Field
              label={hasApi ? 'Your own words (optional)' : 'What is said in the video'}
              hint={
                hasApi
                  ? 'If you already know the exact wording, paste it — it becomes the authority and the AI only aligns the timings.'
                  : 'No AI is configured, so paste the words here. Timings are estimated and fully editable afterwards.'
              }
            >
              <textarea
                className="field min-h-[100px] resize-y leading-relaxed"
                placeholder="a holiday in my life as a girl in new york city"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
              />
            </Field>

            {!hasApi && (
              <p className="rounded border border-ink-700 bg-ink-850 px-3 py-2 text-[11px] leading-relaxed text-ink-400">
                Local mode: your video never leaves this browser and captions are
                laid out by the built-in designer. Everything else — editing,
                fonts, animation, MP4 export — works exactly the same.
              </p>
            )}

            <button
              className="btn-primary w-full py-2.5"
              onClick={() => void start()}
              disabled={!hasApi && transcript.trim().length === 0}
            >
              {hasApi ? 'Generate captions' : 'Design captions'}
            </button>
          </div>
        )
      )}
    </div>
  );
}
