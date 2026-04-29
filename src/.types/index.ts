import type {
  CRMapState,
  CRMapSnapshot,
} from '@sovereignbase/convergent-replicated-map'

export type CRSetState<T> = CRMapState<string, T>
export type CRSetSnapshot<T> = CRMapSnapshot<string, T>
