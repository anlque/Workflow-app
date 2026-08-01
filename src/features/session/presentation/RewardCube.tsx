import { useEffect } from 'react';

export type RewardCubeProps = Readonly<{
  icon: string;
  reducedMotion: boolean;
  onSettled(): void;
}>;

const ROLL_DURATION_MS = 1_200;

export function RewardCube({
  icon,
  reducedMotion,
  onSettled,
}: RewardCubeProps) {
  const state = reducedMotion ? 'settled' : 'rolling';

  useEffect(() => {
    if (reducedMotion) {
      onSettled();
      return;
    }
    const timer = window.setTimeout(onSettled, ROLL_DURATION_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [onSettled, reducedMotion]);

  return (
    <div
      className="reward-cube-scene"
      data-testid="reward-cube"
      data-state={state}
      aria-hidden="true"
    >
      <div className="reward-cube">
        <span className="reward-cube__face reward-cube__face--front">
          {icon}
        </span>
        <span className="reward-cube__face reward-cube__face--back">•</span>
        <span className="reward-cube__face reward-cube__face--right">••</span>
        <span className="reward-cube__face reward-cube__face--left">•••</span>
        <span className="reward-cube__face reward-cube__face--top">••</span>
        <span className="reward-cube__face reward-cube__face--bottom">
          ••••
        </span>
      </div>
    </div>
  );
}
