// Single source of the CLI version, inlined from package.json at build time by tsup.
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const VERSION = (require('../package.json') as { version: string }).version
