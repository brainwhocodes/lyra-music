import { patchConsole } from '~/server/utils/logger';

export default defineNitroPlugin((): void => {
  patchConsole();
});
