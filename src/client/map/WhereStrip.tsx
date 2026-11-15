export type StripItem = { label: string; value: string; testId: string };

/** Where-am-I strip along the bottom: plain labels, live for screen readers. */
export function WhereStrip({ items, big }: { items: StripItem[]; big: boolean }) {
  return (
    <section aria-label="Where am I" className="z-10 border-t sm:sticky sm:bottom-0 border-divider-strong bg-surface" data-testid="where-strip">
      <dl className={`mx-auto grid max-w-screen-2xl grid-cols-2 gap-x-6 gap-y-2 px-5 py-3 sm:grid-cols-3 sm:px-8 lg:grid-cols-5 ${big ? "text-lg" : "text-sm"}`} aria-live="polite">
        {items.map((it) => (
          <div key={it.label} className="min-w-0">
            <dt className={`font-medium uppercase tracking-wider text-text-muted ${big ? "text-sm" : "text-xs"}`}>{it.label}</dt>
            <dd className="truncate tabular-nums text-text" data-testid={it.testId}>{it.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
