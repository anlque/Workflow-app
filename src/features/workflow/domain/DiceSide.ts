export type DiceSideAvailability = 'any' | 'early' | 'late';

export type DiceSide = Readonly<{
  icon: string;
  title: string;
  description?: string;
  probability: number;
  availability: DiceSideAvailability;
}>;

export type DiceSideInput = Readonly<{
  icon: string;
  title: string;
  description?: string;
  weight?: number;
  availability?: DiceSideAvailability;
}>;
