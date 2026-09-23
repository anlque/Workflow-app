import type { RewardCommandReceipt, Session } from '../domain/Session';
import { SessionApplicationError } from './SessionApplicationError';

export function isDuplicateRewardCommand(
  session: Session,
  commandId: string,
  type: RewardCommandReceipt['type'],
  rewardRitualId: string,
): boolean {
  const receipt = session.rewardCommandReceipts.find(
    (candidate) => candidate.commandId === commandId,
  );
  if (receipt !== undefined) {
    if (receipt.type === type && receipt.rewardRitualId === rewardRitualId) {
      return true;
    }
    throw new SessionApplicationError(
      'Reward command identifier conflicts with an earlier command.',
    );
  }
  if (session.rewardRitual?.id !== rewardRitualId) {
    throw new SessionApplicationError(
      'Reward command does not match the current Reward opportunity.',
    );
  }
  return false;
}
