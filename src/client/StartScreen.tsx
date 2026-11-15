import { useEffect, useState } from "react";
import { loadDataFile } from "./overviewLoader";
import { parseGenome, type Genome } from "../shared/genome";
import { GenomeExplorer } from "./map/GenomeExplorer";
import { btnSecondary } from "./ui";

export function StartScreen({ big = false }: { big?: boolean }) {
  const [genome, setGenome] = useState<Genome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(null);
    loadDataFile("genome-overview.json").then(data => {
      const result = parseGenome(data, "genome-overview.json");
      if (!result.ok) throw new Error(result.problems.join(" "));
      if (active) setGenome(result.genome);
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : String(e)); });
    return () => { active = false; };
  }, [attempt]);
  if (genome) return <GenomeExplorer genome={genome} big={big} />;
  return <div className="flex flex-1 items-center justify-center px-5 py-16">
    {error ? <section className="max-w-xl text-center" role="alert">
      <h1 className="text-2xl font-semibold">HELIX could not load</h1>
      <p className="mt-4 text-danger">{error}</p>
      <button className={btnSecondary + " mt-4"} onClick={() => setAttempt(a => a + 1)}>Retry</button>
    </section> : <p role="status">Loading genome overview…</p>}
  </div>;
}
