import { useEffect, useRef } from 'react';

export type RewardCubeStage = 'ready' | 'rolling' | 'result';
export type RewardCubeResultMedia = 'video' | 'poster';
export type RewardCubeTerminalReason = 'ended' | 'fallback' | 'reduced';

export type RewardCubeProps = Readonly<{
  attemptId: number;
  icon: string;
  stage: RewardCubeStage;
  resultMedia: RewardCubeResultMedia;
  reducedMotion: boolean;
  animateResult?: boolean;
  onTerminal(attemptId: number, reason: RewardCubeTerminalReason): void;
}>;

const VIDEO_TIMEOUT_MS = 3_800;
const REDUCED_MOTION_DURATION_MS = 600;

export function RewardCube({
  attemptId,
  icon,
  stage,
  resultMedia,
  reducedMotion,
  animateResult = false,
  onTerminal,
}: RewardCubeProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const settledAttemptRef = useRef<number | null>(null);

  function settle(reason: RewardCubeTerminalReason): void {
    if (stage !== 'rolling' || settledAttemptRef.current === attemptId) return;
    settledAttemptRef.current = attemptId;
    onTerminal(attemptId, reason);
  }

  useEffect(() => {
    settledAttemptRef.current = null;
    if (stage !== 'rolling') return;

    let active = true;
    const terminal = (reason: RewardCubeTerminalReason) => {
      if (active) {
        settle(reason);
      }
    };
    const timer = window.setTimeout(
      () => {
        terminal(reducedMotion ? 'reduced' : 'fallback');
      },
      reducedMotion ? REDUCED_MOTION_DURATION_MS : VIDEO_TIMEOUT_MS,
    );

    const video = videoRef.current;
    if (!reducedMotion && video !== null) {
      video.currentTime = 0;
      void video.play().catch(() => {
        terminal('fallback');
      });
    }

    return () => {
      active = false;
      window.clearTimeout(timer);
      if (video !== null) {
        try {
          video.pause();
        } catch {
          // Media cleanup must remain non-blocking.
        }
      }
    };
  }, [attemptId, reducedMotion, stage]);

  const showVideo =
    !reducedMotion &&
    (stage === 'rolling' || (stage === 'result' && resultMedia === 'video'));

  return (
    <div
      className="reward-dice-stage"
      data-testid="reward-cube"
      data-state={stage}
      data-result-media={resultMedia}
      aria-hidden="true"
    >
      <span
        className="reward-dice-stage__backdrop"
        data-testid="reward-dice-backdrop"
      />
      <div
        className="reward-dice-stage__composition"
        data-testid="reward-dice-composition"
      >
        {showVideo ? (
          <video
            key={attemptId}
            ref={videoRef}
            className="reward-dice-stage__media"
            data-testid="reward-dice-video"
            src="/video/reward-dice-roll.webm"
            poster="/video/reward-dice-final.png"
            preload="auto"
            playsInline
            muted
            onEnded={() => {
              settle('ended');
            }}
            onError={() => {
              settle('fallback');
            }}
          />
        ) : (
          <img
            className="reward-dice-stage__media"
            data-testid="reward-dice-poster"
            src="/video/reward-dice-final.png"
            alt=""
          />
        )}
        {stage === 'result' ? (
          <span
            className="reward-dice-stage__overlay"
            data-testid="reward-dice-overlay"
            data-reduced-motion={reducedMotion || undefined}
            data-animate={animateResult || undefined}
          >
            <span className="reward-dice-stage__cloud" />
            <span className="reward-dice-stage__icon">{icon}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
