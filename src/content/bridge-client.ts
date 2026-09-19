// Content-script side of the page bridge. Injects page-bridge.js into the page
// world and exposes a promise-based request for the editor state.

const TAG = "cv-bridge";
let injected = false;
let nextId = 1;

function injectBridge(): void {
  if (injected) return;
  injected = true;
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("page-bridge.js");
  script.dataset.cv = "bridge";
  (document.head || document.documentElement).appendChild(script);
  // The bridge lives on window; the tag can be removed once executed.
  script.addEventListener("load", () => script.remove());
}

export interface EditorState {
  code: string;
  source: string;
}

export function requestEditorState(timeoutMs = 1500): Promise<EditorState | null> {
  injectBridge();
  const id = nextId++;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve(null);
    }, timeoutMs);

    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || data.__cv !== true || data.tag !== TAG) return;
      if (data.kind === "response" && data.id === id) {
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve(data.ok ? (data.data as EditorState | null) : null);
      }
    }

    window.addEventListener("message", onMessage);
    // Post the request. If the bridge isn't ready yet, retry a couple times.
    const send = () =>
      window.postMessage({ __cv: true, kind: "request", tag: TAG, id, action: "getEditorState" }, "*");
    send();
    setTimeout(send, 150);
    setTimeout(send, 500);
  });
}
