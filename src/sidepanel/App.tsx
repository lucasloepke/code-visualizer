import { useCallback, useEffect, useRef, useState } from "react";
import type { TestCase } from "../shared/types";
import type { TraceRun } from "../shared/trace";
import { MAX_TRACE_STEPS } from "../shared/trace";
import { executeAll } from "./pyodide/execute";
import { ensurePyodide } from "./pyodide/runner";
import { scrapeActiveTab } from "./scrape-client";
import { SAMPLES } from "./samples";
import { Controls } from "./components/Controls";
import { TestCaseTabs } from "./components/TestCaseTabs";
import { Stage } from "./components/Stage";
import { CodePanel } from "./components/CodePanel";
import { LocalsPanel } from "./components/LocalsPanel";
import { ReloadIcon } from "./components/ReloadIcon";

type PyStatus = "idle" | "loading" | "ready" | "error";

export function App() {
  const [code, setCode] = useState<string>(SAMPLES[0].code);
  const [signature, setSignature] = useState<string>(SAMPLES[0].signature);
  const [testCases, setTestCases] = useState<TestCase[]>(SAMPLES[0].testCases);

  const [pyStatus, setPyStatus] = useState<PyStatus>("idle");
  const [running, setRunning] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [canTest, setCanTest] = useState(true);

  const [menuOpen, setMenuOpen] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [runs, setRuns] = useState<TraceRun[] | null>(null);
  const [activeRun, setActiveRun] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(3);

  // Warm up Pyodide in the background as soon as the panel opens.
  useEffect(() => {
    setPyStatus("loading");
    ensurePyodide()
      .then(() => setPyStatus("ready"))
      .catch((err) => {
        setPyStatus("error");
        setMessage(`Pyodide failed to load: ${String(err)}`);
      });
  }, []);

  const currentRun = runs ? runs[activeRun] : null;
  const steps = currentRun?.steps ?? [];
  const currentStep = steps[stepIndex] ?? null;

  // Autoplay ticker (setInterval driving currentStepIndex).
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setStepIndex((i) => {
        if (i >= steps.length - 1) {
          setPlaying(false);
          return i;
        }
        const next = i + 1;
        // Freeze autoplay on an exception step.
        if (steps[next]?.event === "exception") {
          setPlaying(false);
        }
        return next;
      });
    }, Math.max(50, 1000 / speed));
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [playing, speed, steps]);

  const runWith = useCallback(
    async (input: { code: string; signature: string; testCases: TestCase[] }) => {
      setRunning(true);
      setMessage(null);
      setPlaying(false);
      try {
        await ensurePyodide();
        setPyStatus("ready");
        const result = await executeAll(input);
        setRuns(result);
        setActiveRun(0);
        setStepIndex(0);
      } catch (err) {
        setMessage(`Run failed: ${String(err)}`);
      } finally {
        setRunning(false);
      }
    },
    [],
  );

  const runAll = useCallback(
    () => {
      if (!canTest) {
        setMessage("Navigate to questions tab to begin code visualization.");
        return;
      }
      void runWith({ code, signature, testCases });
    },
    [runWith, code, signature, testCases, canTest],
  );

  const [showScrapeProgress, setShowScrapeProgress] = useState(false);

  const doScrape = useCallback(async (opts?: { showProgress?: boolean }) => {
    setMessage(null);
    setWarnings([]);
    setScraping(true);
    if (opts?.showProgress) setShowScrapeProgress(true);
    try {
      const result = await scrapeActiveTab();
      const questionRoute = result.site !== "neetcode" || /\/question(?:\/|$)/.test(new URL(result.url).pathname);
      setCanTest(questionRoute);
      setRuns(null);
      setActiveRun(0);
      setStepIndex(0);
      setPlaying(false);
      const nextCode = result.code || code;
      const nextSignature = result.functionSignature || signature;
      const nextTestCases = result.testCases.length ? result.testCases : testCases;
      if (result.code) setCode(result.code);
      if (result.functionSignature) setSignature(result.functionSignature);
      if (result.testCases.length) setTestCases(result.testCases);
      setWarnings(result.warnings);
      setMessage(
        questionRoute
          ? `Scraped ${result.site} — ${result.testCases.length} test case(s)` +
            (result.code ? "" : " (no code found)")
          : "Navigate to questions tab to begin code visualization.",
      );
      // Kick off the visualization immediately with the freshly scraped values
      // (state setters above haven't flushed yet, so pass them explicitly).
      if (result.code && questionRoute) {
        await runWith({ code: nextCode, signature: nextSignature, testCases: nextTestCases });
      }
    } catch (err) {
      setMessage(String(err instanceof Error ? err.message : err));
    } finally {
      setScraping(false);
      setShowScrapeProgress(false);
    }
  }, [runWith, code, signature, testCases]);

  // Auto-scrape the active problem tab as soon as the panel opens, so the
  // user's own code is loaded and ready without pressing anything.
  // Only the first scrape shows the progress banner — re-scrape is usually
  // fast enough that the banner just flashes.
  const didAutoScrape = useRef(false);
  useEffect(() => {
    if (didAutoScrape.current) return;
    didAutoScrape.current = true;
    void doScrape({ showProgress: true });
  }, [doScrape]);

  // Close the ⋮ menu on an outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const loadSample = useCallback((id: string) => {
    const s = SAMPLES.find((x) => x.id === id);
    if (!s) return;
    setCode(s.code);
    setSignature(s.signature);
    setTestCases(s.testCases);
    setRuns(null);
    setMessage(`Loaded example — ${s.label}`);
    setWarnings([]);
    setMenuOpen(false);
  }, []);

  const seek = useCallback((i: number) => {
    setPlaying(false);
    setStepIndex(i);
  }, []);
  const step = useCallback(
    (delta: number) => {
      setPlaying(false);
      setStepIndex((i) => Math.min(Math.max(0, i + delta), Math.max(0, steps.length - 1)));
    },
    [steps.length],
  );
  const togglePlay = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (steps.length === 0) return;
    if (stepIndex >= steps.length - 1) setStepIndex(0);
    setPlaying(true);
  }, [playing, stepIndex, steps.length]);

  const errorLine = currentRun?.error?.line ?? null;
  const currentLine = currentStep?.line ?? null;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>LeetVision</h1>
          <p className="subtitle">
            Pyodide status:{" "}
            <span className={`pystatus pystatus--${pyStatus}`}>{pyStatus}</span>
          </p>
        </div>
        <div className="header-actions">
          <button
            className="btn btn--icon"
            onClick={() => void doScrape()}
            disabled={scraping}
            title="Re-scrape the active tab"
            aria-label="Re-scrape the active tab"
          >
            <ReloadIcon />
          </button>
          <div className="menu-wrap" ref={menuRef}>
            <button
              className="btn btn--icon"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              title="More options"
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="menu-dropdown" role="menu">
                <label className="menu-item menu-item--toggle">
                  <input
                    type="checkbox"
                    checked={debugMode}
                    onChange={(e) => setDebugMode(e.target.checked)}
                  />
                  Debug mode
                </label>

                <div className="menu-divider" />
                <div className="menu-label">Load example (fallback)</div>
                <select
                  className="sample-select"
                  onChange={(e) => loadSample(e.target.value)}
                  defaultValue=""
                  title="Load a built-in demo problem"
                >
                  <option value="" disabled>
                    Choose an example…
                  </option>
                  {SAMPLES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </header>

      {showScrapeProgress && (
        <div className="banner banner--scraping">
          <span className="spinner" aria-hidden="true" />
          Scraping the active tab…
        </div>
      )}
      {!showScrapeProgress && message && <div className="banner">{message}</div>}
      {warnings.length > 0 && (
        <div className="banner banner--warn">
          {warnings.map((w, i) => (
            <div key={i}>⚠ {w}</div>
          ))}
        </div>
      )}

      {debugMode && (
        <details className="editor-details" open={!runs}>
          <summary>Input (code + test cases)</summary>
          <label className="field-label">Solution code (Python)</label>
          <textarea
            className="code-input"
            value={code}
            spellCheck={false}
            onChange={(e) => setCode(e.target.value)}
            rows={12}
          />
          <label className="field-label">Signature</label>
          <input
            className="sig-input"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
          />
          <TestCaseEditor testCases={testCases} onChange={setTestCases} />
          <button
            className="btn btn--primary btn--play"
            onClick={runAll}
            disabled={running || scraping || pyStatus === "error"}
          >
            {running ? "Running…" : "Run ▶"}
          </button>
        </details>
      )}

      {currentRun && (
        <div className="results">
          <TestCaseTabs
            runs={runs!}
            activeIndex={activeRun}
            onSelect={(i) => {
              setActiveRun(i);
              setStepIndex(0);
              setPlaying(false);
            }}
          />

          {currentRun.truncated && (
            <div className="banner banner--warn">
              Infinite loop suspected — stopped after {MAX_TRACE_STEPS} steps.
            </div>
          )}
          {currentRun.error && (
            <div className="banner banner--error">
              {currentRun.error.type}: {currentRun.error.message}
              {currentRun.error.line != null && ` (line ${currentRun.error.line})`}
            </div>
          )}

          <Controls
            stepIndex={stepIndex}
            stepCount={steps.length}
            playing={playing}
            speed={speed}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onStep={step}
            onSpeed={setSpeed}
          />

          <Stage run={currentRun} step={currentStep} />

          <LocalsPanel step={currentStep} />

          {currentRun.stdout && (
            <div className="stdout">
              <div className="stdout-label">stdout</div>
              <pre>{currentRun.stdout}</pre>
            </div>
          )}

          <CodePanel code={code} currentLine={currentLine} errorLine={errorLine} />
        </div>
      )}
    </div>
  );
}

function TestCaseEditor({
  testCases,
  onChange,
}: {
  testCases: TestCase[];
  onChange: (t: TestCase[]) => void;
}) {
  const update = (i: number, patch: Partial<TestCase>) => {
    onChange(testCases.map((tc, idx) => (idx === i ? { ...tc, ...patch } : tc)));
  };
  const add = () =>
    onChange([...testCases, { name: `Example ${testCases.length + 1}`, input: "", expected: "" }]);
  const remove = (i: number) => onChange(testCases.filter((_, idx) => idx !== i));

  return (
    <div className="tc-editor">
      <div className="field-label">
        Test cases <button className="btn btn--tiny" onClick={add}>+ add</button>
      </div>
      {testCases.map((tc, i) => (
        <div key={i} className="tc-row">
          <input
            className="tc-name"
            value={tc.name}
            onChange={(e) => update(i, { name: e.target.value })}
          />
          <input
            className="tc-input"
            placeholder="nums = [2,7,11,15], target = 9"
            value={tc.input}
            onChange={(e) => update(i, { input: e.target.value })}
          />
          <input
            className="tc-expected"
            placeholder="expected (e.g. [0,1])"
            value={tc.expected ?? ""}
            onChange={(e) => update(i, { expected: e.target.value })}
          />
          <button className="btn btn--tiny" onClick={() => remove(i)} title="Remove">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
