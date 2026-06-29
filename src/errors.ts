// Exit-code contract for the `ledger` CLI. Documented and stable — CI relies on it.
export const EXIT = {
  OK: 0, // success
  RUNTIME: 1, // unexpected runtime/provider error
  USAGE: 2, // bad config or invalid usage (provider missing, unknown flag value, auth)
  EMPTY: 3, // no changes found, only when --fail-on-empty is set
} as const

export type ExitCode = (typeof EXIT)[keyof typeof EXIT]

// An error that carries the exit code the CLI should terminate with.
export class CliError extends Error {
  constructor(
    message: string,
    public readonly code: ExitCode = EXIT.RUNTIME
  ) {
    super(message)
    this.name = 'CliError'
  }
}

export function exitCodeFor(err: unknown): ExitCode {
  return err instanceof CliError ? err.code : EXIT.RUNTIME
}
