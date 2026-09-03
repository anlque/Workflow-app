import { bootstrapBackground } from '@/app/background/bootstrapBackground';

export default defineBackground(() => {
  void bootstrapBackground().catch((error: unknown) => {
    console.error('Locusora background initialization failed.', error);
  });
});
