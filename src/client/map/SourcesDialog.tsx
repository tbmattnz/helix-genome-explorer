import { useRef } from "react";
import { XIcon, BookOpenIcon, ExternalLinkIcon } from "lucide-react";
import type { Genome } from "../../shared/genome";
import { readSources } from "../../shared/sources";
import { btnSecondary } from "../ui";

/** Sources panel, built only from meta.sources and meta.notes in genome-overview.json. */
export function SourcesDialog({ genome, big }: { genome: Genome; big: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const { sources, notes, problems } = readSources(genome.meta);
  const txt = big ? "text-lg" : "text-sm";
  return (
    <>
        <button onClick={() => dialog.current?.showModal()} ref={trigger} className={btnSecondary} data-testid="sources-button" aria-haspopup="dialog">
          <BookOpenIcon size={18} /> Sources
        </button>
        <dialog ref={dialog} aria-labelledby="sources-heading" aria-describedby="sources-description"
          data-testid="sources-dialog"
          onClose={() => trigger.current?.focus()}
          className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-xl border border-divider bg-surface text-text shadow-2xl backdrop:bg-overlay"
        >
          <div className="flex items-start justify-between gap-4 border-b border-divider px-5 py-4 sm:px-8">
            <div>
              <h2 id="sources-heading" className="text-lg font-semibold text-text">Sources</h2>
              <p id="sources-description" className="text-sm text-text-muted">Where the numbers on this map come from, as listed in genome-overview.json.</p>
            </div>
            <button onClick={() => dialog.current?.close()} className="rounded-md p-2 text-text-muted hover:bg-surface-muted hover:text-text" aria-label="Close sources">
              <XIcon size={20} />
            </button>
          </div>
          <div className={`flex-1 space-y-8 overflow-y-auto px-5 py-6 sm:px-8 ${txt}`}>
            {problems.length ? (
              <ul role="alert" className="space-y-1 rounded-lg border border-danger px-4 py-3 text-danger">
                {problems.map((p) => <li key={p}>{p}</li>)}
              </ul>
            ) : null}
            <section aria-labelledby="src-h">
              <h3 id="src-h" className="mb-3 font-semibold text-text">Data sources</h3>
              {sources.length === 0 ? (
                <p className="text-text-muted">The file lists no sources.</p>
              ) : (
                <ol className="divide-y divide-divider border-y border-divider" data-testid="sources-list">
                  {sources.map((s, i) => (
                    <li key={i} className="py-4">
                      <p className="font-semibold text-text">{s.name}</p>
                      {s.provider ? <p className="text-text-muted">{s.provider}</p> : null}
                      <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[8rem_1fr]">
                        {s.usedFor ? <><dt className="font-medium text-text-muted">Used for</dt><dd className="text-text">{s.usedFor}</dd></> : null}
                        {s.file ? <><dt className="font-medium text-text-muted">File</dt><dd className="break-words text-text">{s.file}</dd></> : null}
                        {s.url ? (
                          <>
                            <dt className="font-medium text-text-muted">Web address</dt>
                            <dd className="break-all">
                              <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded text-accent-strong underline underline-offset-2">
                                {s.url} <ExternalLinkIcon size={14} aria-label="opens in a new tab" />
                              </a>
                            </dd>
                          </>
                        ) : null}
                        {s.terms ? <><dt className="font-medium text-text-muted">Terms</dt><dd className="text-text">{s.terms}</dd></> : null}
                      </dl>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <section aria-labelledby="notes-h">
              <h3 id="notes-h" className="mb-3 font-semibold text-text">Notes on the data</h3>
              {notes.length === 0 ? (
                <p className="text-text-muted">The file has no notes.</p>
              ) : (
                <ul className="list-disc space-y-2 pl-5 text-text" data-testid="notes-list">
                  {notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
            </section>
          </div>
        </dialog>
    </>
  );
}
