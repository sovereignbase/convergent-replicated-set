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

import type {
  CRSetState,
  CRSetSnapshot,
  CRSetAck,
  CRSetDelta,
  CRSetEventListenerFor,
  CRSetEventMap,
} from '../.types/index.js'

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
    let result
    try {
      result = __update(hash, value, this.state)
    } catch {}
    if (!result) return
    const { delta, change } = result
    if (delta) {
      this.eventTarget.dispatchEvent(
        new CustomEvent('delta', { detail: delta })
      )
    }
    if (change) {
      this.eventTarget.dispatchEvent(
        new CustomEvent('change', { detail: change })
      )
    }
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

  delete(value: T): void {
    let bytes: Uint8Array<ArrayBuffer>
    try {
      bytes = encode(value, { sortKeys: true })
    } catch {
      throw new CRSetError('EXAMPLE_ERROR_CODE')
    }

    const digest = sha256(bytes)
    const hash = Bytes.toBase64UrlString(digest)

    const result = __delete(this.state, hash)
    if (!result) return
    const { delta, change } = result
    if (delta) {
      this.eventTarget.dispatchEvent(
        new CustomEvent('delta', { detail: delta })
      )
    }
    if (change) {
      this.eventTarget.dispatchEvent(
        new CustomEvent('change', { detail: change })
      )
    }
  }

  /**
   * Deletes every visible key.
   */
  clear(): void {
    const result = __delete(this.state)
    if (!result) return
    const { delta, change } = result
    if (delta) {
      this.eventTarget.dispatchEvent(
        new CustomEvent('delta', { detail: delta })
      )
    }
    if (change) {
      this.eventTarget.dispatchEvent(
        new CustomEvent('change', { detail: change })
      )
    }
  }

  /**
   * Returns the current live keys.
   *
   * @returns The current keys in map iteration order.
   */
  keys(): Array<string> {
    return Array.from(this.state.values.keys())
  }

  /**
   * Returns detached copies of the current live values.
   *
   * @returns The current values in map iteration order.
   */
  values(): Array<T> {
    return Array.from(this.state.values.values(), (entry) =>
      structuredClone(entry.value.value)
    )
  }

  /**
   * Returns detached key-value entries for the current live projection.
   *
   * @returns The current entries in map iteration order.
   */
  entries(): Array<[T, T]> {
    return Array.from(this.state.values.values(), (entry) => [
      structuredClone(entry.value.value),
      structuredClone(entry.value.value),
    ])
  }

  /**
   * Applies a remote or local delta to the replica state.
   *
   * @param delta - The partial serialized map state to merge.
   */
  merge(delta: CRSetDelta<T>): void {
    const result = __merge<T>(delta, this.state)
    if (!result) return
    if (
      (result.delta.values?.length ?? 0) +
        (result.delta.tombstones?.length ?? 0) >
      0
    ) {
      void this.eventTarget.dispatchEvent(
        new CustomEvent('delta', { detail: result.delta })
      )
    }
    if (Object.keys(result.change).length > 0) {
      void this.eventTarget.dispatchEvent(
        new CustomEvent('change', { detail: result.change })
      )
    }
  }

  /**
   * Emits the current acknowledgement frontier.
   */
  acknowledge(): void {
    const ack = __acknowledge<T>(this.state)
    if (!ack) return
    void this.eventTarget.dispatchEvent(new CustomEvent('ack', { detail: ack }))
  }

  /**
   * Removes tombstones that every provided frontier has acknowledged.
   *
   * @param frontiers - Replica acknowledgement frontiers.
   */
  garbageCollect(frontiers: Array<CRSetAck>): void {
    void __garbageCollect<T>(frontiers, this.state)
  }

  /**
   * Emits the current serializable map snapshot.
   */
  snapshot(): void {
    const snapshot = __snapshot<T>(this.state)
    void this.eventTarget.dispatchEvent(
      new CustomEvent('snapshot', { detail: snapshot })
    )
  }

  /**
   * Registers an event listener.
   *
   * @param type - The event type to listen for.
   * @param listener - The listener to register.
   * @param options - Listener registration options.
   */
  addEventListener<K extends keyof CRSetEventMap<T>>(
    type: K,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.eventTarget.addEventListener(type, listener, options)
  }

  /**
   * Removes an event listener.
   *
   * @param type - The event type to stop listening for.
   * @param listener - The listener to remove.
   * @param options - Listener removal options.
   */
  removeEventListener<K extends keyof CRSetEventMap<T>>(
    type: K,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ): void {
    this.eventTarget.removeEventListener(type, listener, options)
  }

  /**
   * Returns a serializable snapshot representation of this map.
   *
   * Called automatically by `JSON.stringify`.
   */
  toJSON(): CRSetSnapshot<T> {
    return __snapshot<T>(this.state)
  }

  /**
   * Attempts to return this map as a JSON string.
   */
  toString(): string {
    return JSON.stringify(this)
  }

  /**
   * Returns the Node.js console inspection representation.
   */
  [Symbol.for('nodejs.util.inspect.custom')](): CRSetSnapshot<T> {
    return this.toJSON()
  }

  /**
   * Returns the Deno console inspection representation.
   */
  [Symbol.for('Deno.customInspect')](): CRSetSnapshot<T> {
    return this.toJSON()
  }

  /**
   * Iterates over detached copies of the current live entries.
   */
  *[Symbol.iterator](): IterableIterator<T> {
    for (const entry of this.state.values.values()) {
      yield structuredClone(entry.value.value)
    }
  }

  /**
   * Calls a function once for each live entry copy in map iteration order.
   *
   * Callback values are detached copies, so mutating them does not mutate the
   * replica.
   *
   * @param callback - Function to call for each key-value entry.
   * @param thisArg - Optional `this` value for the callback.
   */
  forEach(
    callback: (value1: T, value2: T, map: this) => void,
    thisArg?: unknown
  ): void {
    for (const value of this.values()) {
      callback.call(thisArg, value, value, this)
    }
  }
}
