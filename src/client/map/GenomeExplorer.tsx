import { useEffect, useMemo, useState } from "react";
import type { Genome, Win } from "../../shared/genome";
import { GENE_TRACK_MAX_BP, densityScale, fmt, genesInView, isBlockWindow, makeWindowBp, mb } from "../../shared/genome";
import { fitWindowFor, genesInWindow, type Gene } from "../../shared/genes";
import { codingLettersInView, makeRegionWindow, regionForGene } from "../../shared/regions";
import { GenomeMap } from "./GenomeMap";
import { ZoomView } from "./ZoomView";
import { MapKeys } from "./MapKeys";
import { WhereStrip, type StripItem } from "./WhereStrip";
import { PatternDefs } from "./Ideogram";
import { SourcesDialog } from "./SourcesDialog";
import { GeneSearch } from "./GeneSearch";
import { RegionList } from "./RegionList";
import { RegionView } from "./RegionView";
import type { RegionPick } from "./RegionGenes";
import { useGenes } from "./useGenes";
import { useRegions } from "./useRegions";
import { useVariants } from "./useVariants";
import { requestGenes } from "./useGenes";
import { requestRegions } from "./useRegions";
import { requestVariants } from "./useVariants";
import { useTours } from "./useTours";
import { TourList } from "./TourList";
import { TourPanel } from "./TourPanel";
import { resolveTarget, targetNeeds, type Avail, type Resolved, type Tour } from "../../shared/tourPlay";

type TourCmd = { key: number; codingStartGene: string | null; variant: string | null; variantOn: boolean };
const avail = <T,>(s: { status: string; error: string | null }, v: T | null): Avail<T> =>
  s.status === "ready" && v ? { status: "ready", value: v } : s.status === "error" ? { status: "error", error: s.error ?? "" } : { status: "loading" };

const pos = (bp: number) => (bp === 0 ? "0" : `${fmt(bp)} (${mb(bp)} million)`);
type RegionState = { id: string; win: Win; from: "map" | "zoom" };

export function GenomeExplorer({ genome, big = false }: { genome: Genome; big?: boolean }) {
  const scale = useMemo(() => densityScale(genome), [genome]);
  const list = genome.chromosomes;
  const bin = genome.binSizeBp;
  const [open, setOpen] = useState<number | null>(null);
  const [win, setWin] = useState<Win | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [returnTo, setReturnTo] = useState<number | null>(null);
  const [selected, setSelected] = useState<Gene | null>(null);
  const [cardFocus, setCardFocus] = useState(0);
  const [regionsOpen, setRegionsOpen] = useState(false);
  const [rv, setRv] = useState<RegionState | null>(null);
  const [rPick, setRPick] = useState<RegionPick>(null);
  const [refocus, setRefocus] = useState<string | null>(null);
  const [vPick, setVPick] = useState<string | null>(null);
  // Guided tour: the tour, its step, and a key per opened step (Back/Next reapply their step's target).
  const [toursOpen, setToursOpen] = useState(false);
  const [tour, setTour] = useState<{ t: Tour; step: number } | null>(null);
  const [stepKey, setStepKey] = useState(0);
  const [appliedKey, setAppliedKey] = useState(-1);
  const [notice, setNotice] = useState<string | null>(null);
  const [cmd, setCmd] = useState<TourCmd | null>(null);
  const toursState = useTours(toursOpen);

  const span = open !== null && win ? win.endBp - win.startBp : Infinity;
  const trackOn = rv === null && open !== null && !!win && span <= GENE_TRACK_MAX_BP;
  const genesState = useGenes(trackOn);
  const regionsState = useRegions(regionsOpen || !!selected || !!rv);
  const variantsState = useVariants(!!rv);
  const region = rv && regionsState.set ? regionsState.set.byId[rv.id] ?? null : null;
  const selectedRegion = selected ? regionForGene(regionsState.set, selected.name, selected.chr) : null;
  const openName = open !== null ? list[open].name : null;
  const inView = useMemo(
    () => (trackOn && genesState.index && win && openName ? genesInWindow(genesState.index.byChr[openName], win) : []),
    [trackOn, genesState.index, win, openName],
  );

  const openChr = (i: number) => {
    setOpen(i);
    setWin(makeWindowBp(list[i], bin, 0, Infinity));
    setSelected(null);
    setCardFocus(0);
  };
  const pick = (g: Gene) => {
    const i = list.findIndex((x) => x.name === g.chr);
    if (i < 0) return;
    const f = fitWindowFor(g);
    setOpen(i);
    setWin(makeWindowBp(list[i], bin, f.startBp, f.widthBp));
    setSelected(g);
    setCardFocus((k) => k + 1);
  };
  const back = () => {
    setReturnTo(open);
    setOpen(null);
    setWin(null);
    setSelected(null);
    setCardFocus(0);
  };
  const openRegion = (id: string) => {
    const r = regionsState.set?.byId[id];
    if (!r) return;
    setRv({ id, win: makeRegionWindow(r, r.startBp, r.endBp - r.startBp), from: open === null ? "map" : "zoom" });
    setRPick(null);
    setVPick(null);
  };
  const closeRegion = () => {
    if (!rv) return;
    setRefocus(rv.from === "map" ? `region-${rv.id}` : selected ? "open-region" : null);
    setRv(null);
    setRPick(null);
    setVPick(null);
  };
  // Closing the variant card returns focus to its marker (or its list row when the marker is out of view).
  const closeVariant = () => {
    const id = vPick;
    setVPick(null);
    if (id) requestAnimationFrame(() => {
      const el = (document.querySelector(`[data-testid="vm-${id}"]`) ?? document.querySelector(`[data-testid="vl-${id}"]`)) as HTMLElement | null;
      el?.focus();
    });
  };

  // Guided tour: open a step's target through the same functions the controls use.
  const showResolved = (r: Resolved, key: number) => {
    const leaveRegion = () => { setRv(null); setRPick(null); setVPick(null); };
    setCmd(null);
    if (r.view === "map") { leaveRegion(); setOpen(null); setWin(null); setSelected(null); setCardFocus(0); }
    else if (r.view === "chromosome") { leaveRegion(); openChr(r.index); }
    else if (r.view === "gene") { leaveRegion(); pick(r.gene); }
    else if (r.view === "region") { openRegion(r.region); setCmd({ key, codingStartGene: r.codingStartGene, variant: null, variantOn: false }); }
    else if (r.view === "variant") { openRegion(r.region); setVPick(r.variant); setCmd({ key, codingStartGene: null, variant: r.variant, variantOn: r.on }); }
  };
  const target = tour ? tour.t.steps[tour.step].target : null;
  useEffect(() => {
    if (!tour || !target || appliedKey === stepKey) return;
    const n = targetNeeds(target);
    if (n.genes) requestGenes();
    if (n.regions) requestRegions();
    if (n.variants) requestVariants();
    const r = resolveTarget(target, {
      chromosomes: list.map((x) => x.name),
      genes: avail(genesState, genesState.index),
      regions: avail(regionsState, regionsState.set),
      variants: avail(variantsState, variantsState.set),
    });
    if (r.view === "wait") return;
    setAppliedKey(stepKey);
    setNotice(r.view === "notice" ? r.text : null);
    if (r.view !== "notice") showResolved(r, stepKey);
  });
  const startTour = (t: Tour) => { setTour({ t, step: 0 }); setNotice(null); setStepKey((k) => k + 1); };
  const goStep = (i: number) => { if (!tour) return; setTour({ t: tour.t, step: i }); setNotice(null); setStepKey((k) => k + 1); };
  const endTour = () => {
    const id = tour?.t.id;
    setTour(null); setNotice(null); setCmd(null);
    requestAnimationFrame(() => {
      const el = (document.querySelector(`[data-testid="tour-start-${id}"]`) ?? document.querySelector('[data-testid="tours-toggle"]') ?? document.querySelector('[data-testid="region-back"]') ?? document.querySelector('[data-testid="explorer"] button')) as HTMLElement | null;
      el?.focus();
    });
  };

  // Put focus back on the control that opened the region view.
  useEffect(() => {
    if (!refocus || rv) return;
    const t = requestAnimationFrame(() => {
      (document.querySelector(`[data-testid="${refocus}"]`) as HTMLElement | null)?.focus();
      setRefocus(null);
    });
    return () => cancelAnimationFrame(t);
  }, [refocus, rv]);

  // Escape closes the open card first, then goes back one step (dialogs close themselves first).
  useEffect(() => {
    if (open === null && !rv) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector('dialog[open], [role="dialog"]')) return;
      e.preventDefault();
      if (rv) { if (vPick) closeVariant(); else if (rPick) setRPick(null); else closeRegion(); }
      else if (selected) setSelected(null);
      else back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const c = open !== null ? list[open] : hover !== null ? list[hover] : null;
  const w = open !== null && win ? win : c ? { startBp: 0, endBp: c.lengthBp } : null;
  const totalLen = genome.totals.lengthBp ?? list.reduce((s, x) => s + x.lengthBp, 0);
  const totalGenes = genome.totals.proteinCodingGenes ?? list.reduce((s, x) => s + x.proteinCodingGenes, 0);

  let genesValue = "";
  let genesSource: "overview" | "genes" | "none" = "overview";
  if (c && w) {
    if (open === null) genesValue = fmt(c.proteinCodingGenes);
    else if (trackOn) {
      if (genesState.status === "ready") { genesValue = fmt(inView.length); genesSource = "genes"; }
      else if (genesState.status === "error") {
        if (isBlockWindow(c, bin, w)) genesValue = fmt(genesInView(c, bin, w));
        else { genesValue = "Not available"; genesSource = "none"; }
      } else { genesValue = "Loading genes"; genesSource = "none"; }
    } else genesValue = fmt(genesInView(c, bin, w));
  }

  let items: StripItem[];
  if (region && rv) {
    const lettersIn = rv.win.endBp - rv.win.startBp;
    const coding = codingLettersInView(region, rv.win);
    const pct = lettersIn ? Math.round((coding / lettersIn) * 1000) / 10 : 0;
    items = [
      { label: "Chromosome", value: region.chromosome, testId: "where-chr" },
      { label: "Start position", value: fmt(rv.win.startBp), testId: "where-start" },
      { label: "End position", value: fmt(rv.win.endBp), testId: "where-end" },
      { label: "Letters in view", value: fmt(lettersIn), testId: "where-letters" },
      { label: "Coding letters in view", value: `${fmt(coding)} (${pct}%)`, testId: "where-coding" },
    ];
  } else if (c && w) {
    items = [
      { label: "Chromosome", value: c.name, testId: "where-chr" },
      { label: "Start position", value: pos(w.startBp), testId: "where-start" },
      { label: "End position", value: pos(w.endBp), testId: "where-end" },
      { label: "Letters in view", value: fmt(w.endBp - w.startBp), testId: "where-letters" },
      { label: "Protein-coding genes in view", value: genesValue, testId: "where-genes" },
    ];
  } else {
    items = [
      { label: "Chromosome", value: `All ${list.length} (${list[0]?.name} to ${list[list.length - 1]?.name})`, testId: "where-chr" },
      { label: "Start position", value: `Start of chromosome ${list[0]?.name}`, testId: "where-start" },
      { label: "End position", value: `End of chromosome ${list[list.length - 1]?.name}`, testId: "where-end" },
      { label: "Letters in view", value: fmt(totalLen), testId: "where-letters" },
      { label: "Protein-coding genes in view", value: fmt(totalGenes), testId: "where-genes" },
    ];
  }


  // Close an open gene card when the view widens past the gene-track limit (the genes are no longer drawn).
  const tooWide = open !== null && !!win && win.endBp - win.startBp > GENE_TRACK_MAX_BP;
  useEffect(() => { if (tooWide) { setSelected(null); setCardFocus(0); } }, [tooWide]);

  const onMap = !rv && (open === null || !win);
  const title = !onMap ? (
    <div className="mb-4 flex justify-end"><SourcesDialog genome={genome} big={big} /></div>
  ) : (
    <header className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <h1 className={`font-light text-text ${big ? "text-4xl" : "text-2xl sm:text-3xl"}`} data-testid="overview-title">{genome.title}</h1>
      <p className={`tabular-nums text-text-muted ${big ? "text-lg" : "text-sm"}`} data-testid="overview-count">
        {list.length} chromosome{list.length === 1 ? "" : "s"}{genome.assembly ? `, ${genome.assembly}` : ""}
      </p>
      <div className="ml-auto"><SourcesDialog genome={genome} big={big} /></div>
    </header>
  );

  let body;
  if (rv) {
    body = region ? (
      <RegionView
        region={region} win={rv.win} big={big}
        backLabel={rv.from === "map" ? "Back to map" : `Back to chromosome ${list[open ?? 0]?.name}`}
        onWin={(nw) => setRv({ ...rv, win: nw })} onBack={closeRegion} pick={rPick} onPick={setRPick}
        variantsState={variantsState} vPick={vPick} onVPick={setVPick} onCloseVariant={closeVariant}
        command={cmd}
      />
    ) : regionsState.status === "error" ? (
      <p role="alert" className="text-danger">The region cannot be shown: {regionsState.error}</p>
    ) : (
      <p role="status" className="animate-pulse text-text-muted">Loading the region</p>
    );
  } else if (open === null || !win) {
    body = (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <p className={`max-w-xl text-text-muted ${big ? "text-lg" : "text-sm"}`}>Each chromosome is drawn to scale with its bands. The bars beside it show where its genes are. Select a chromosome to zoom in, or find a gene by name.</p>
          <GeneSearch genes={genesState} onPick={pick} big={big} />
        </div>
        <GenomeMap genome={genome} scale={scale} big={big} focusIndex={returnTo} onOpen={openChr} onHover={setHover} />
        <RegionList big={big} open={regionsOpen} onToggle={() => setRegionsOpen((o) => !o)} onOpen={openRegion} />
        <TourList big={big} open={toursOpen} onToggle={() => setToursOpen((o) => !o)} active={tour?.t.id ?? null}
          onStart={(id) => { const t = toursState.set?.byId[id]; if (t) startTour(t); }} />
        <MapKeys genome={genome} scale={scale} big={big} />
      </div>
    );
  } else {
    body = (
      <div className="space-y-8">
        <ZoomView
          genome={genome} c={list[open]} scale={scale} win={win} big={big} onWin={setWin} onBack={back}
          genesState={genesState} inView={inView} selected={selected}
          onSelect={(g) => { setSelected(g); if (!g) setCardFocus(0); }} cardFocus={cardFocus}
          selectedRegion={selectedRegion} onOpenRegion={openRegion}
        />
        <MapKeys genome={genome} scale={scale} big={big} />
      </div>
    );
  }

  return (
    <div className={`flex w-full flex-1 flex-col self-stretch ${tour ? "tour-on" : ""}`} data-testid="explorer">
      <PatternDefs />
      {tour ? (
        <TourPanel tour={tour.t} step={tour.step} notice={notice} waiting={appliedKey !== stepKey} big={big} focusKey={stepKey}
          onBack={() => goStep(Math.max(0, tour.step - 1))}
          onNext={() => (tour.step >= tour.t.steps.length - 1 ? endTour() : goStep(tour.step + 1))}
          onEnd={endTour} />
      ) : null}
      <div className="explorer-content mx-auto w-full max-w-screen-2xl flex-1 px-5 py-6 sm:px-8">
        {title}
        {body}
      </div>
      <WhereStrip items={items} big={big} />
    </div>
  );
}
