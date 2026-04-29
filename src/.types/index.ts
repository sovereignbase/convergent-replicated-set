import type {
  CRMapState,
  CRMapSnapshot,
  CRMapAck,
  CRMapChange,
} from '@sovereignbase/convergent-replicated-map'

export type CRSetAck = CRMapAck
export type CRSetState<T> = CRMapState<string, T>
export type CRSetSnapshot<T> = CRMapSnapshot<string, T>
export type CRSetDelta<T> = Partial<CRSetSnapshot<T>>
export type CRSetChange<T> = CRMapChange<string, T | undefined>

/**
 * Maps event names to their payload shapes.
 */
export type CRSetEventMap<T> = {
  /** STATE / PROJECTION */
  snapshot: CRSetSnapshot<T>
  change: CRSetChange<T>

  /** GOSSIP / PROTOCOL */
  delta: CRSetDelta<T>
  ack: CRSetAck
}

/**
 * Represents a strongly typed CR-Map event listener.
 */
export type CRSetEventListener<T, K extends keyof CRSetEventMap<T>> =
  | ((event: CustomEvent<CRSetEventMap<T>[K]>) => void)
  | { handleEvent(event: CustomEvent<CRSetEventMap<T>[K]>): void }

/**
 * Resolves an event name to its corresponding listener type.
 */
export type CRSetEventListenerFor<
  T,
  K extends string,
> = K extends keyof CRSetEventMap<T>
  ? CRSetEventListener<T, K>
  : EventListenerOrEventListenerObject
