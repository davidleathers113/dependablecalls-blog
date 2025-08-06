/**
 * Zustand v5 Compatibility Shim
 * 
 * This file provides type compatibility between Zustand v4 and v5 patterns
 * to facilitate gradual migration of stores.
 */

import type { StateCreator as ZustandStateCreator, StoreApi, UseBoundStore } from 'zustand'

// Zustand v5 uses a different generic signature for StateCreator
// This bridges the gap for stores still using v4 patterns
export type StateCreatorCompat<T> = ZustandStateCreator<T, [], [], T>

// Helper type for stores with middleware
export type StandardStateCreator<T> = StateCreatorCompat<T>

// Lightweight state creator for UI stores (no persistence)
export type LightweightStateCreator<T> = StateCreatorCompat<T>

// Re-export common Zustand types for convenience
export type { StoreApi, UseBoundStore }

// Middleware type helpers for v5
export type ImmerMiddleware = ['zustand/immer', never]
export type DevtoolsMiddleware = ['zustand/devtools', never]
export type SubscribeMiddleware = ['zustand/subscribeWithSelector', never]
export type PersistMiddleware<T> = ['zustand/persist', T]

// Combined middleware types for different store patterns
export type StandardMiddlewares<T> = [
  ImmerMiddleware,
  SubscribeMiddleware,
  PersistMiddleware<Partial<T>>,
  DevtoolsMiddleware
]

export type UIMiddlewares = [
  ImmerMiddleware,
  DevtoolsMiddleware
]