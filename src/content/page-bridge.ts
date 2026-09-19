// Runs in the PAGE's main world (injected by the content script via a <script>
// tag). Content scripts live in an isolated world and cannot see the page's
// window globals, so this bridge reads the editor's underlying model object
// (Monaco / CodeMirror) and hands the value back over window.postMessage.

interface MonacoModel {
  getValue(): string;
  getLanguageId?(): string;
  uri?: { path?: string };
}
interface MonacoLike {
  editor?: { getModels(): MonacoModel[] };
}

declare global {
  interface Window {
    monaco?: MonacoLike;
  }
}

const TAG = "cv-bridge";

function readFromMonaco(): { code: string; source: string } | null {
  const monaco = window.monaco;
  const models = monaco?.editor?.getModels?.();
  if (!models || models.length === 0) return null;
  // Prefer a Python model; otherwise the longest non-empty model.
  const python = models.find((m) => {
    try {
      return m.getLanguageId?.() === "python";
    } catch {
      return false;
    }
  });
  const chosen =
    python ??
    models
      .slice()
      .sort((a, b) => (safeValue(b).length - safeValue(a).length))[0];
  const code = chosen ? safeValue(chosen) : "";
  return code ? { code, source: "monaco" } : null;
}

function safeValue(m: MonacoModel): string {
  try {
    return m.getValue() ?? "";
  } catch {
    return "";
  }
}

// CodeMirror 6 exposes the view on the DOM node's `.cmView`; CM5 on `.CodeMirror`.
function readFromCodeMirror(): { code: string; source: string } | null {
  const cm6 = document.querySelector(".cm-editor") as (HTMLElement & { cmView?: { view?: { state?: { doc?: { toString(): string } } } } }) | null;
  const doc6 = cm6?.cmView?.view?.state?.doc;
  if (doc6) {
    const code = doc6.toString();
    if (code) return { code, source: "codemirror6" };
  }
  const cm5 = document.querySelector(".CodeMirror") as (HTMLElement & { CodeMirror?: { getValue(): string } }) | null;
  if (cm5?.CodeMirror) {
    const code = cm5.CodeMirror.getValue();
    if (code) return { code, source: "codemirror5" };
  }
  return null;
}

function readFromEditorTextarea(): { code: string; source: string } | null {
  const editors = Array.from(
    document.querySelectorAll<HTMLTextAreaElement>(
      'app-code-editor .monaco-editor textarea.inputarea[aria-label="Code editor"]',
    ),
  );
  const editor = editors.find((textarea) => textarea.value) ?? editors[0];
  const code = editor?.value ?? "";
  return code ? { code, source: "monaco-textarea" } : null;
}

function getEditorState(): { code: string; source: string } | null {
  return readFromMonaco() ?? readFromCodeMirror() ?? readFromEditorTextarea();
}

async function waitForEditorState(timeoutMs = 1200): Promise<{ code: string; source: string } | null> {
  const deadline = Date.now() + timeoutMs;
  let state = getEditorState();
  while (!state && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    state = getEditorState();
  }
  return state;
}

window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.__cv !== true || data.kind !== "request" || data.tag !== TAG) return;
  const id = data.id;
  try {
    if (data.action === "getEditorState") {
      waitForEditorState().then((state) => {
      window.postMessage(
        { __cv: true, kind: "response", tag: TAG, id, ok: true, data: state },
        "*",
      );
      });
    } else {
      window.postMessage(
        { __cv: true, kind: "response", tag: TAG, id, ok: false, error: "unknown action" },
        "*",
      );
    }
  } catch (err) {
    window.postMessage(
      { __cv: true, kind: "response", tag: TAG, id, ok: false, error: String(err) },
      "*",
    );
  }
});

// Announce readiness so the content script knows the bridge is live.
window.postMessage({ __cv: true, kind: "ready", tag: TAG }, "*");

export {};
