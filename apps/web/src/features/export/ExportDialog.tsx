import { EXPORT_PRESETS, type ExportPresetId } from '@kc/shared';
import { useEffect, useRef, useState } from 'react';
import { Field, Modal, Select, Spinner, Toggle } from '../../components/ui';
import { saveLocalExport } from '../../db/local';
import { formatBytes, formatTime } from '../../lib/format';
import { newId } from '../../lib/id';
import { hasApi } from '../../lib/env';
import { completeUpload, performUpload, requestUploadUrl } from '../../lib/api';
import { recordAsset, recordRemoteExport } from '../../lib/supabase';
import {
  checkExportSupport,
  exportVideo,
  ExportUnsupportedError,
  type ExportProgress,
} from '../../media/export';
import { useEditorStore } from '../../stores/editorStore';

/**
 * Export.
 *
 * Renders locally, then optionally pushes the finished MP4 to R2. The order
 * matters: the file is handed to the user first and uploaded second, so a
 * failed upload never costs them the render they just waited for.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  source: Blob | null;
}

export function ExportDialog({ open, onClose, projectId, source }: Props) {
  const state = useEditorStore((s) => s.state);
  const [presetId, setPresetId] = useState<ExportPresetId>('1080x1920');
  const [includeAudio, setIncludeAudio] = useState(true);
  const [uploadToCloud, setUploadToCloud] = useState(hasApi);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<{ url: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [support, setSupport] = useState<{ ok: boolean; reason?: string } | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) void checkExportSupport().then(setSupport);
  }, [open]);

  // Revoking on unmount rather than on close keeps the download link alive
  // while the dialog animates away.
  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  // Default to the project's own shape rather than always 9:16.
  useEffect(() => {
    if (!state) return;
    const { width, height } = state.project;
    if (width > height) setPresetId('1920x1080');
    else if (width === height) setPresetId('1080x1080');
    else setPresetId('1080x1920');
  }, [state]);

  if (!state) return null;

  const preset = EXPORT_PRESETS[presetId];
  const busy = progress !== null && progress.phase !== 'done';

  const run = async () => {
    if (!source) {
      setError('The source video is not available on this device.');
      return;
    }
    setError(null);
    setResult(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const output = await exportVideo(
        source,
        state,
        {
          width: preset.width,
          height: preset.height,
          fps: preset.fps,
          bitrate: preset.bitrate,
          includeAudio,
        },
        setProgress,
        controller.signal,
      );

      const url = URL.createObjectURL(output.blob);
      setResult({ url, size: output.blob.size });

      // Keep a local copy regardless of whether the cloud upload works.
      await saveLocalExport({
        id: newId('exp'),
        projectId,
        blob: output.blob,
        width: output.width,
        height: output.height,
        fps: output.fps,
        sizeBytes: output.blob.size,
        createdAt: Date.now(),
      });

      if (uploadToCloud && hasApi) {
        try {
          const fileName = `kinetic-${projectId.slice(0, 8)}-${Date.now()}.mp4`;
          const ticket = await requestUploadUrl({
            projectId,
            mimeType: 'video/mp4',
            size: output.blob.size,
            kind: 'export',
            fileName,
          });

          const objectKey = await performUpload(ticket, output.blob, fileName);
          if (!ticket.objectKey) {
            await completeUpload({ projectId, kind: 'export', objectKey }).catch(() => undefined);
          }

          await recordAsset({
            projectId,
            kind: 'export',
            provider: ticket.provider,
            objectKey,
            mimeType: 'video/mp4',
            sizeBytes: output.blob.size,
            durationMs: output.durationMs,
          });
          await recordRemoteExport({
            projectId,
            objectKey,
            width: output.width,
            height: output.height,
            fps: output.fps,
            sizeBytes: output.blob.size,
          });
        } catch {
          setError('The file is ready to download, but uploading it to the cloud failed.');
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setProgress(null);
        return;
      }
      setError(
        err instanceof ExportUnsupportedError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Export failed.',
      );
      setProgress(null);
    } finally {
      abortRef.current = null;
    }
  };

  return (
    <Modal open={open} onClose={busy ? () => undefined : onClose} title="Export video">
      {support && !support.ok && (
        <p className="mb-4 rounded border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-xs leading-relaxed text-amber-200">
          {support.reason}
        </p>
      )}

      <div className="space-y-4">
        <Field label="Resolution">
          <Select
            value={presetId}
            onChange={(v) => setPresetId(v as ExportPresetId)}
            options={(Object.keys(EXPORT_PRESETS) as ExportPresetId[]).map((id) => ({
              value: id,
              label: `${id.replace('x', ' × ')} · ${EXPORT_PRESETS[id].fps}fps`,
            }))}
          />
        </Field>

        <Toggle label="Include original audio" checked={includeAudio} onChange={setIncludeAudio} />
        {hasApi && (
          <Toggle label="Also save to the cloud" checked={uploadToCloud} onChange={setUploadToCloud} />
        )}

        <div className="rounded border border-ink-800 bg-ink-850/50 px-3 py-2 text-[11px] leading-relaxed text-ink-500">
          {formatTime(state.project.durationMs)} · about{' '}
          {Math.ceil((state.project.durationMs / 1000) * preset.fps)} frames. Rendering
          happens in this tab — keep it open and in the foreground.
        </div>

        {progress && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-ink-400">
              <span className="capitalize">{phaseLabel(progress)}</span>
              <span className="tabular-nums">{Math.round(progress.progress * 100)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${progress.progress * 100}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="rounded border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs leading-relaxed text-red-200">
            {error}
          </p>
        )}

        {result && (
          <div className="rounded border border-ink-700 bg-ink-850 px-3 py-3">
            <p className="mb-2 text-xs text-ink-300">
              Done — {formatBytes(result.size)}
            </p>
            <div className="flex gap-2">
              <a
                className="btn-primary flex-1"
                href={result.url}
                download={`kinetic-${projectId.slice(0, 8)}.mp4`}
              >
                Download MP4
              </a>
              <a className="btn-outline" href={result.url} target="_blank" rel="noreferrer">
                Open
              </a>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          {busy ? (
            <button className="btn-outline" onClick={() => abortRef.current?.abort()}>
              Cancel render
            </button>
          ) : (
            <>
              <button className="btn-ghost" onClick={onClose}>
                Close
              </button>
              <button
                className="btn-primary"
                onClick={() => void run()}
                disabled={!source || (support ? !support.ok : false)}
              >
                {result ? 'Render again' : 'Render'}
                {busy && <Spinner />}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

function phaseLabel(progress: ExportProgress): string {
  switch (progress.phase) {
    case 'preparing':
      return 'Preparing';
    case 'rendering':
      return progress.totalFrames
        ? `Rendering frame ${progress.frame} of ${progress.totalFrames}`
        : 'Rendering';
    case 'audio':
      return 'Adding audio';
    case 'finalizing':
      return 'Writing MP4';
    default:
      return 'Done';
  }
}
