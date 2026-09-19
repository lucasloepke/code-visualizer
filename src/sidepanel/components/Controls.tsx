interface ControlsProps {
  stepIndex: number;
  stepCount: number;
  playing: boolean;
  speed: number;
  onTogglePlay: () => void;
  onSeek: (index: number) => void;
  onStep: (delta: number) => void;
  onSpeed: (speed: number) => void;
}

export function Controls({
  stepIndex,
  stepCount,
  playing,
  speed,
  onTogglePlay,
  onSeek,
  onStep,
  onSpeed,
}: ControlsProps) {
  const max = Math.max(0, stepCount - 1);
  const atEnd = stepCount > 0 && stepIndex >= max;
  return (
    <div className="controls">
      <div className="controls-row">
        <button className="btn" onClick={() => onStep(-1)} disabled={stepIndex <= 0} title="Previous step">
          ◀
        </button>
        <button className="btn btn--primary" onClick={onTogglePlay} disabled={stepCount === 0}>
          {playing ? "❚❚ Pause" : atEnd ? "↻ Replay" : "▶ Play"}
        </button>
        <button className="btn" onClick={() => onStep(1)} disabled={stepIndex >= max} title="Next step">
          ▶
        </button>
        <span className="step-counter">
          {stepCount === 0 ? "0 / 0" : `${stepIndex + 1} / ${stepCount}`}
        </span>
      </div>
      <input
        type="range"
        className="scrubber"
        min={0}
        max={max}
        value={stepIndex}
        onChange={(e) => onSeek(Number(e.target.value))}
        disabled={stepCount === 0}
      />
      <div className="controls-row controls-row--speed">
        <label>Speed</label>
        <input
          type="range"
          min={1}
          max={20}
          value={speed}
          onChange={(e) => onSpeed(Number(e.target.value))}
        />
        <span>{speed} steps/s</span>
      </div>
    </div>
  );
}
