import { useEffect, useState } from "react";
import { StartScreen } from "./StartScreen";
import { ClassDisplayToggle } from "./ClassDisplayToggle";

export function App() {
  const [classDisplay, setClassDisplay] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("class-display", classDisplay);
    return () => document.documentElement.classList.remove("class-display");
  }, [classDisplay]);
  return <div className="flex min-h-screen flex-col">
    <header className="border-b border-divider bg-surface">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
        <span className="text-sm font-semibold tracking-[0.3em] text-accent-strong">HELIX</span>
        <ClassDisplayToggle on={classDisplay} onChange={setClassDisplay} />
      </div>
    </header>
    <main className="flex flex-1 flex-col"><StartScreen big={classDisplay} /></main>
    <footer className="border-t border-divider px-5 py-4 text-center text-sm text-text-muted">
      A classroom genome explorer from Teacher's Buddy. Draft teaching examples for educator review. Reference data for learning; not a diagnostic tool.
      {" "}<a className="underline" href="./about.html">Source, reuse and data notes</a>
    </footer>
  </div>;
}
