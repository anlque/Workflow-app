import type { Asset } from '../domain/Asset';
import type { AssetRepository } from './AssetRepository';

export function listAssetsUseCase(
  repository: AssetRepository,
): Promise<readonly Asset[]> {
  return repository.list();
}
