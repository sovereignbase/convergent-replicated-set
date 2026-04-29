import type {
  CRMapState,
  CRMapSnapshot,
  CRMapAck,
  CRMapChange,
} from '@sovereignbase/convergent-replicated-map'

/**
 * Acknowledgement frontier emitted by a CRSet replica.
 */
export type CRSetAck = CRMapAck

/**
 * Internal CRSet replica state.
 *
 * Keys are derived from set values and stored in the underlying CRMap state.
 */
export type CRSetState<T> = CRMapState<string, T>

/**
 * Serializable full-state projection of a CRSet replica.
 *
 * Snapshots can be passed to the {@link CRSet} constructor to hydrate another
 * replica.
 */
export type CRSetSnapshot<T> = CRMapSnapshot<string, T>

/**
 * Partial serialized CRSet state exchanged between replicas.
 */
export type CRSetDelta<T> = Partial<CRSetSnapshot<T>>

/**
 * Visible membership changes emitted by local operations or merges.
 *
 * The record is keyed by the underlying value-derived CRMap key. Added or
 * replaced values map to `T`; deleted values map to `undefined`.
 */
export type CRSetChange<T> = CRMapChange<string, T | undefined>

/**
 * Maps event names to their payload shapes.
 */
export type CRSetEventMap<T> = {
  /**
   * Full serializable replica state.
   */
  snapshot: CRSetSnapshot<T>

  /**
   * Visible membership changes.
   */
  change: CRSetChange<T>

  /**
   * Partial state intended for peer replication.
   */
  delta: CRSetDelta<T>

  /**
   * Current acknowledgement frontier.
   */
  ack: CRSetAck
}

/**
 * Represents a strongly typed CRSet event listener.
 */
export type CRSetEventListener<T, K extends keyof CRSetEventMap<T>> =
  | ((event: CustomEvent<CRSetEventMap<T>[K]>) => void)
  | { handleEvent(event: CustomEvent<CRSetEventMap<T>[K]>): void }

/**
 * Resolves an event name to its corresponding CRSet listener type.
 */
export type CRSetEventListenerFor<
  T,
  K extends string,
> = K extends keyof CRSetEventMap<T>
  ? CRSetEventListener<T, K>
  : EventListenerOrEventListenerObject
