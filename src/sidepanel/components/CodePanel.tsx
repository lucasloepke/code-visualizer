interface CodePanelProps {
  code: string;
  currentLine: number | null;
  errorLine: number | null;
}

export function CodePanel({ code, currentLine, errorLine }: CodePanelProps) {
  const lines = code.replace(/\n$/, "").split("\n");
  return (
    <pre className="code-panel">
      {lines.map((text, i) => {
        const lineNo = i + 1;
        const isCurrent = lineNo === currentLine;
        const isError = lineNo === errorLine;
        return (
          <div
            key={lineNo}
            className={`code-line${isCurrent ? " code-line--current" : ""}${
              isError ? " code-line--error" : ""
            }`}
          >
            <span className="code-gutter">{lineNo}</span>
            <span className="code-text">{text || " "}</span>
          </div>
        );
      })}
    </pre>
  );
}
