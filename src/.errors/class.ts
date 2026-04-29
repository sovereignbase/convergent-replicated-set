export type CRSetErrorCode = 'EXAMPLE_ERROR_CODE'

export class CRSetError extends Error {
  readonly code: CRSetErrorCode

  constructor(code: CRSetErrorCode, message?: string) {
    const detail = message ?? code
    super(`{@sovereignbase/package-name} ${detail}`)
    this.code = code
    this.name = 'CRSetError'
  }
}
