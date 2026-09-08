import type { AssetId } from '@/shared';

import type { Session } from '../domain/Session';
import type { SessionSnapshot } from '../domain/SessionSnapshot';
import type { SessionRepository } from './SessionRepository';

function isActive(session: Session): boolean {
  return (
    session.status === 'running' ||
    session.status === 'transitioning' ||
    session.status === 'paused'
  );
}

function snapshotReferencesAsset(
  snapshot: SessionSnapshot,
  assetId: AssetId,
): boolean {
  return snapshot.workflow.phases.some(
    ({ environment }) =>
      (environment.backgroundAsset?.type === 'direct' &&
        environment.backgroundAsset.assetId === assetId) ||
      (environment.audioAsset?.type === 'direct' &&
        environment.audioAsset.assetId === assetId),
  );
}

export async function activeSessionReferencesAsset(
  repository: SessionRepository,
  assetId: AssetId,
): Promise<boolean> {
  const session = await repository.getActive();
  return (
    session !== null &&
    isActive(session) &&
    snapshotReferencesAsset(session.snapshot, assetId)
  );
}
