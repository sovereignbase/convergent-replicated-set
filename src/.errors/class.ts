/**
 * Error codes thrown by {@link CRSet}.
 */
export type CRSetErrorCode = 'VALUE_NOT_ENCODABLE' | 'VALUE_NOT_CLONEABLE'

/**
 * Represents a typed CRSet runtime error.
 */
export class CRSetError extends Error {
  /**
   * The semantic error code for the failure.
   */
  readonly code: CRSetErrorCode

  /**
   * Creates a typed CRSet error.
   *
   * @param code - The semantic error code.
   * @param message - Optional human-readable detail.
   */
  constructor(code: CRSetErrorCode, message?: string) {
    const detail = message ?? code
    super(`{@sovereignbase/convergent-replicated-set} ${detail}`)
    this.code = code
    this.name = 'CRSetError'
  }
}
