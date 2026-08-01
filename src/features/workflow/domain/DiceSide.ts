export type DiceSide = Readonly<{
  icon: string;
  title: string;
  description?: string;
  probability: number;
}>;

export type DiceSideInput = Readonly<{
  icon: string;
  title: string;
  description?: string;
  weight?: number;
}>;
