
/** On/off switch. The state is shown by the thumb position and the On/Off word, not by colour alone. */
export function ClassDisplayToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="class-display" className="text-sm text-text">Class display</label>
      <button type="button" role="switch"
        id="class-display"
        data-testid="class-display"
        aria-checked={on}
        aria-label="Class display"
        data-state={on ? "checked" : "unchecked"}
        onClick={() => onChange(!on)}
        className="relative h-7 w-12 shrink-0 rounded-full border border-divider-strong bg-surface-muted data-[state=checked]:border-accent-strong data-[state=checked]:bg-accent"
      >
        <span data-state={on ? "checked" : "unchecked"} className="block h-5 w-5 translate-x-0.5 rounded-full border border-divider-strong bg-surface transition-transform data-[state=checked]:translate-x-[1.35rem] data-[state=checked]:border-surface" />
      </button>
      <span className="w-7 text-sm font-medium text-text-muted" aria-hidden="true">{on ? "On" : "Off"}</span>
    </div>
  );
}
