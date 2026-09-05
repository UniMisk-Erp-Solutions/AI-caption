import { STORAGE_LIMITS } from '@kc/shared';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, Modal, Spinner } from '../../components/ui';
import { estimateLocalUsage } from '../../db/local';
import { cn } from '../../lib/cn';
import { modeLabel, isLocalMode } from '../../lib/env';
import { formatBytes, formatRelative, formatTime } from '../../lib/format';
import { deleteProject, listProjects, renameProject, type ProjectSummary } from '../../lib/projectRepo';

export function DashboardPage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [usage, setUsage] = useState({ used: 0, quota: 0 });
  const [confirmDelete, setConfirmDelete] = useState<ProjectSummary | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [list, storage] = await Promise.all([listProjects(), estimateLocalUsage()]);
    setProjects(list);
    setUsage(storage);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Object URLs for the thumbnails are created per listing, so release them
  // when the list is replaced or the page unmounts.
  useEffect(
    () => () => {
      projects?.forEach((p) => p.thumbnailUrl && URL.revokeObjectURL(p.thumbnailUrl));
    },
    [projects],
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl leading-none text-ink-100">Projects</h1>
          <p className="mt-2 text-sm text-ink-500">
            <span className="chip mr-2">{modeLabel}</span>
            {usage.used > 0 && `${formatBytes(usage.used)} stored on this device`}
          </p>
        </div>
        <Link className="btn-primary" to="/new">
          New project
        </Link>
      </header>

      {isLocalMode && (
        <p className="mb-6 rounded-lg border border-ink-800 bg-ink-900 px-4 py-3 text-xs leading-relaxed text-ink-400">
          <strong className="text-ink-200">Local mode.</strong> Projects live in
          this browser only and your video never leaves the device. Add Supabase
          and the Worker to your <code className="text-accent">.env</code> for
          accounts, cloud storage and AI transcription.
        </p>
      )}

      {projects === null ? (
        <div className="flex items-center gap-2 py-16 text-sm text-ink-400">
          <Spinner /> Loading projects…
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="Upload a clip and its speech or lyrics become editable kinetic typography — different fonts, sizes and positions on the same frame."
          action={
            <Link className="btn-primary" to="/new">
              Upload a video
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {projects.map((project) => (
            <article
              key={project.id}
              className="group overflow-hidden rounded-lg border border-ink-800 bg-ink-900 transition hover:border-ink-600"
            >
              <Link to={`/project/${project.id}`} className="block">
                <div className="relative aspect-[9/16] overflow-hidden bg-ink-950">
                  {project.thumbnailUrl ? (
                    <img
                      src={project.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-[11px] text-ink-700">
                      no preview
                    </div>
                  )}

                  <div className="absolute bottom-1.5 left-1.5 flex gap-1">
                    <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] tabular-nums text-ink-200">
                      {formatTime(project.durationMs)}
                    </span>
                    {project.dirty && (
                      <span className="rounded bg-amber-900/80 px-1.5 py-0.5 text-[10px] text-amber-100">
                        unsynced
                      </span>
                    )}
                    {project.status === 'processing' && (
                      <span className="rounded bg-accent/80 px-1.5 py-0.5 text-[10px] text-ink-950">
                        processing
                      </span>
                    )}
                  </div>
                </div>
              </Link>

              <div className="p-2.5">
                {renaming === project.id ? (
                  <input
                    autoFocus
                    defaultValue={project.title}
                    className="field py-1 text-xs"
                    onBlur={async (e) => {
                      const title = e.target.value.trim();
                      if (title && title !== project.title) {
                        await renameProject(project.id, title);
                        void refresh();
                      }
                      setRenaming(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                  />
                ) : (
                  <h2
                    className="cursor-text truncate text-sm text-ink-200"
                    onDoubleClick={() => setRenaming(project.id)}
                    title={project.title}
                  >
                    {project.title}
                  </h2>
                )}

                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] text-ink-600">
                    {formatRelative(project.updatedAt)}
                  </span>
                  <button
                    className="text-[10px] text-ink-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                    onClick={() => setConfirmDelete(project)}
                  >
                    delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {projects && projects.length >= STORAGE_LIMITS.maxProjectsPerUser && (
        <p className="mt-6 text-[11px] text-ink-600">
          You have reached the {STORAGE_LIMITS.maxProjectsPerUser}-project limit for
          the beta. Delete one to make room.
        </p>
      )}

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete project"
        width="max-w-sm"
      >
        <p className="text-sm leading-relaxed text-ink-300">
          Delete <strong className="text-ink-100">{confirmDelete?.title}</strong>?
          The source video, captions and any exports go with it. This cannot be
          undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>
            Cancel
          </button>
          <button
            className="btn-danger"
            onClick={async () => {
              if (!confirmDelete) return;
              await deleteProject(confirmDelete.id);
              setConfirmDelete(null);
              void refresh();
            }}
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}

export { cn };
