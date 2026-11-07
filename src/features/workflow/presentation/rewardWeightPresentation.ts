export type RewardWeightPresentation = Readonly<{
  summary: string | null;
  sides: readonly string[];
}>;

function formatChance(value: number): string {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: 1,
  }).format(value);
}

function rawWeightLabel(value: string): string {
  const normalized = value.trim();
  return normalized.length === 0 ? 'Weight not set' : `Weight ${normalized}`;
}

function normalizedChanceLabels(weights: readonly number[]): readonly string[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const exactUnits = weights.map((weight) => (weight / total) * 1_000);
  const roundedUnits = exactUnits.map(Math.floor);
  const remainingUnits =
    1_000 - roundedUnits.reduce((sum, units) => sum + units, 0);
  const remainderOrder = exactUnits
    .map((units, index) => ({ index, remainder: units - Math.floor(units) }))
    .sort(
      (left, right) =>
        right.remainder - left.remainder || left.index - right.index,
    );
  for (let index = 0; index < remainingUnits; index += 1) {
    const target = remainderOrder[index % remainderOrder.length];
    if (target !== undefined) {
      roundedUnits[target.index] = (roundedUnits[target.index] ?? 0) + 1;
    }
  }
  return roundedUnits.map((units) => `${formatChance(units / 10)}% chance`);
}

export function formatRewardWeightPresentation(
  weights: readonly string[],
): RewardWeightPresentation {
  const normalized = weights.map((weight) => weight.trim());
  const allEmpty = normalized.every((weight) => weight.length === 0);
  if (allEmpty && normalized.length > 0) {
    const chances = normalizedChanceLabels(normalized.map(() => 1));
    return {
      summary: 'Total chance 100%',
      sides: normalized.map((_, index) => {
        const chance = chances[index];
        if (chance === undefined) throw new Error('Missing Reward chance.');
        return `Equal weight · ${chance}`;
      }),
    };
  }

  const values = normalized.map(Number);
  const total = values.reduce((sum, weight) => sum + weight, 0);
  const valid =
    normalized.length > 0 &&
    normalized.every((weight) => weight.length > 0) &&
    values.every((weight) => Number.isFinite(weight) && weight > 0) &&
    Number.isFinite(total) &&
    total > 0;
  if (!valid) {
    return { summary: null, sides: weights.map(rawWeightLabel) };
  }

  const chances = normalizedChanceLabels(values);
  return {
    summary: 'Total chance 100%',
    sides: normalized.map((weight, index) => {
      const chance = chances[index];
      if (chance === undefined) throw new Error('Missing Reward chance.');
      return `Weight ${weight} · ${chance}`;
    }),
  };
}
