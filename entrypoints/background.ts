import { bootstrapBackground } from '@/app/background/bootstrapBackground';

export default defineBackground(() => {
  void bootstrapBackground().catch((error: unknown) => {
    console.error('Flowarium background initialization failed.', error);
  });
});
