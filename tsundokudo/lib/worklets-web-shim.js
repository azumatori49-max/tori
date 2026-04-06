/**
 * react-native-worklets Web シム
 *
 * Reanimated 4 が Web でも worklets API を import するため、
 * Web 環境用の no-op スタブを全て提供。
 */
const noop = () => {};
const identity = (v) => v;
const falseFn = () => false;

module.exports = {
  // Runtime
  RuntimeKind: { UI: 'UI', JS: 'JS' },
  UIRuntimeId: 0,
  getUIRuntimeHolder: () => ({ value: null }),
  getUISchedulerHolder: () => ({ value: null }),

  // Worklet creation
  createWorkletRuntime: noop,
  isWorkletFunction: falseFn,

  // Shareables / Serializables
  makeShareable: identity,
  createShareable: identity,
  createSerializable: identity,
  createSynchronizable: identity,
  serializableMappingCache: new Map(),
  isShareableRef: falseFn,
  isShareable: falseFn,
  isSynchronizable: falseFn,
  makeShareableCloneRecursive: identity,
  makeShareableCloneOnUIRecursive: identity,
  shareableMappingCache: new Map(),
  registerCustomSerializable: noop,
  isSerializableRef: falseFn,
  callMicrotasks: noop,

  // Scheduling
  runOnUI: (fn) => fn,
  runOnUISync: (fn) => fn,
  runOnJS: (fn) => fn,
  runOnRuntime: (fn) => fn,
  scheduleOnUI: (fn) => { try { fn(); } catch {} },
  scheduleOnRN: (fn) => { try { fn(); } catch {} },
  executeOnUIRuntimeSync: (fn) => fn,

  // Feature flags
  getDynamicFeatureFlag: falseFn,
  getStaticFeatureFlag: falseFn,
  setDynamicFeatureFlag: noop,

  // Initializers
  init: noop,
  bundleModeInit: noop,
  _createWorkletInitializer: noop,
  createWorkletInitializer: noop,

  // WorkletsModule (used by JSReanimated)
  WorkletsModule: {
    makeShareableClone: identity,
    scheduleOnUI: noop,
    executeOnUIRuntimeSync: identity,
    createWorkletRuntime: noop,
    scheduleOnRuntime: noop,
  },
};
