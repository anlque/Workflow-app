export type RewardCubeStage = 'ready' | 'mixing' | 'mixing-reduced' | 'result';

export type RewardCubeProps = Readonly<{
  icon: string;
  stage: RewardCubeStage;
}>;

export function RewardCube({ icon, stage }: RewardCubeProps) {
  return (
    <div
      className="reward-cube-scene"
      data-testid="reward-cube"
      data-state={stage}
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
