import {
  __create,
  __read,
  __update,
  __delete,
  __merge,
  __acknowledge,
  __garbageCollect,
  __snapshot,
} from '@sovereignbase/convergent-replicated-map'

import { encode } from '@msgpack/msgpack'
import { sha256 } from '@noble/hashes/sha2.js'
import { Bytes } from '@sovereignbase/bytecodec'

import { CRSetError } from '../.errors/class.js'

import type { CRSetState, CRSetSnapshot } from '../.types/index.js'

export class CRSet<T> {
  declare private readonly state: CRSetState<T>
  declare private readonly eventTarget: EventTarget

  /**
   * Creates a replicated set from an optional serializable snapshot.
   *
   * @param snapshot - A previously emitted CRSet snapshot.
   */
  constructor(snapshot?: CRSetSnapshot<T>) {
    Object.defineProperties(this, {
      state: {
        value: __create<T>(snapshot),
        enumerable: false,
        configurable: false,
        writable: false,
      },
      eventTarget: {
        value: new EventTarget(),
        enumerable: false,
        configurable: false,
        writable: false,
      },
    })
  }

  /**
   * The current number of live keys.
   */
  get size(): number {
    return this.state.values.size
  }
  add(value: T): void {
    let bytes: Uint8Array<ArrayBuffer>
    try {
      bytes = encode(value, { sortKeys: true })
    } catch {
      throw new CRSetError('EXAMPLE_ERROR_CODE')
    }

    const digest = sha256(bytes)
    const hash = Bytes.toBase64UrlString(digest)

    if (__read(hash, this.state)) return
    void __update(hash, value, this.state)
  }

  has(value: T): boolean {
    let bytes: Uint8Array<ArrayBuffer>
    try {
      bytes = encode(value, { sortKeys: true })
    } catch {
      throw new CRSetError('EXAMPLE_ERROR_CODE')
    }

    const digest = sha256(bytes)
    const hash = Bytes.toBase64UrlString(digest)

    return Boolean(__read(hash, this.state))
  }

  delete(value: T) {
    let bytes: Uint8Array<ArrayBuffer>
    try {
      bytes = encode(value, { sortKeys: true })
    } catch {
      throw new CRSetError('EXAMPLE_ERROR_CODE')
    }

    const digest = sha256(bytes)
    const hash = Bytes.toBase64UrlString(digest)

    void __delete(hash, this.state)
  }
}
