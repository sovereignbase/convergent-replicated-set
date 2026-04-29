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
  CRSetEventMap,
} from '../.types/index.js'

/**
 * A convergent replicated set for content-addressed values.
 *
 * Values are stored in a CRMap under a SHA-256 Base64URL key derived from their
 * canonical MessagePack encoding. Local mutations emit `delta` and `change`
 * events; received deltas converge through {@link merge}.
 *
 * Reads and iteration return detached copies of the live values.
 *
 * @typeParam T - The value type stored in the set.
 */
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
   * The current number of live values.
   */
  get size(): number {
    return this.state.values.size
  }

  /**
   * Adds a value to the replicated set.
   *
   * If the value's content key is already visible, the operation is a no-op.
   * Successful additions emit `delta` and `change` events.
   *
   * @param value - Value to add.
   * @throws {CRSetError} Thrown when the value cannot be encoded.
   * @throws {CRSetError} Thrown when the value cannot be cloned into replica
   * state.
   */
  add(value: T): void {
    const hash = this.valueToKey(value)

    if (this.state.values.has(hash)) return
    let result
    try {
      result = __update(hash, value, this.state)
    } catch {
      throw new CRSetError(
        'VALUE_NOT_CLONEABLE',
        "Failed to execute 'add' on 'CRSet': The value could not be cloned."
      )
    }
    if (!result) return

    void this.eventTarget.dispatchEvent(
      new CustomEvent('delta', { detail: result.delta })
    )

    void this.eventTarget.dispatchEvent(
      new CustomEvent('change', { detail: result.change })
    )
  }

  /**
   * Checks whether a value is currently visible in the replicated set.
   *
   * @param value - Value to check.
   * @returns `true` when the value's content key is visible.
   * @throws {CRSetError} Thrown when the value cannot be encoded.
   */
  has(value: T): boolean {
    return this.state.values.has(this.valueToKey(value))
  }

  /**
   * Deletes a value from the replicated set.
   *
   * If the value's content key is not visible, the operation is a no-op.
   * Successful deletions emit `delta` and `change` events.
   *
   * @param value - Value to delete.
   * @throws {CRSetError} Thrown when the value cannot be encoded.
   */
  delete(value: T): void {
    const result = __delete(this.state, this.valueToKey(value))
    if (!result) return

    void this.hashCache.delete(value)

    void this.eventTarget.dispatchEvent(
      new CustomEvent('delta', { detail: result.delta })
    )

    void this.eventTarget.dispatchEvent(
      new CustomEvent('change', { detail: result.change })
    )
  }

  /**
   * Deletes every visible value.
   *
   * Successful clears emit `delta` and `change` events.
   */
  clear(): void {
    const result = __delete(this.state)
    if (!result) return

    void this.hashCache.clear()

    void this.eventTarget.dispatchEvent(
      new CustomEvent('delta', { detail: result.delta })
    )

    void this.eventTarget.dispatchEvent(
      new CustomEvent('change', { detail: result.change })
    )
  }

  /**
   * Returns detached copies of the current live values.
   *
   * @returns The current values in replica iteration order.
   */
  values(): Array<T> {
    return Array.from(this.state.values.values(), (entry) =>
      structuredClone(entry.value.value)
    )
  }

  /**
   * Applies a remote or local delta to the replica state.
   *
   * Accepted remote changes may emit `change`; dominated incoming state may
   * emit a reply `delta`.
   *
   * @param delta - The partial serialized set state to merge.
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
   *
   * Acknowledgement frontiers are used by peers to decide when tombstones can
   * be garbage collected.
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
   * Emits the current serializable set snapshot.
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
    void this.eventTarget.addEventListener(type, listener, options)
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
    void this.eventTarget.removeEventListener(type, listener, options)
  }

  /**
   * Returns a serializable snapshot representation of this set.
   *
   * Called automatically by `JSON.stringify`.
   */
  toJSON(): CRSetSnapshot<T> {
    return __snapshot<T>(this.state)
  }

  /**
   * Attempts to return this set as a JSON string.
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
   * Iterates over detached copies of the current live values.
   */
  *[Symbol.iterator](): IterableIterator<T> {
    for (const entry of this.state.values.values()) {
      yield structuredClone(entry.value.value)
    }
  }

  /**
   * Calls a function once for each live value copy in replica iteration order.
   *
   * Callback values are detached copies, so mutating them does not mutate the
   * replica.
   *
   * @param callback - Function to call for each value.
   * @param thisArg - Optional `this` value for the callback.
   */
  forEach(callback: (value: T, set: this) => void, thisArg?: unknown): void {
    for (const value of this.values()) {
      callback.call(thisArg, value, this)
    }
  }

  private valueToKey(value: T): string {
    let bytes: Uint8Array<ArrayBuffer>
    try {
      bytes = encode(value, { sortKeys: true })
    } catch {
      throw new CRSetError(
        'VALUE_NOT_ENCODABLE',
        "Failed to encode 'CRSet' value: The value could not be encoded as canonical MessagePack."
      )
    }
    return Bytes.toBase64UrlString(sha256(bytes))
  }
}
