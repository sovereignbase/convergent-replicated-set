// node_modules/uuid/dist/regex.js
var regex_default = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;

// node_modules/uuid/dist/validate.js
function validate(uuid) {
  return typeof uuid === "string" && regex_default.test(uuid);
}
var validate_default = validate;

// node_modules/uuid/dist/stringify.js
var byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

// node_modules/uuid/dist/rng.js
var rnds8 = new Uint8Array(16);
function rng() {
  return crypto.getRandomValues(rnds8);
}

// node_modules/uuid/dist/v7.js
var _state = {};
function v7(options, buf, offset) {
  let bytes;
  if (options) {
    bytes = v7Bytes(options.random ?? options.rng?.() ?? rng(), options.msecs, options.seq, buf, offset);
  } else {
    const now = Date.now();
    const rnds = rng();
    updateV7State(_state, now, rnds);
    bytes = v7Bytes(rnds, _state.msecs, _state.seq, buf, offset);
  }
  return buf ?? unsafeStringify(bytes);
}
function updateV7State(state, now, rnds) {
  state.msecs ??= -Infinity;
  state.seq ??= 0;
  if (now > state.msecs) {
    state.seq = rnds[6] << 23 | rnds[7] << 16 | rnds[8] << 8 | rnds[9];
    state.msecs = now;
  } else {
    state.seq = state.seq + 1 | 0;
    if (state.seq === 0) {
      state.msecs++;
    }
  }
  return state;
}
function v7Bytes(rnds, msecs, seq, buf, offset = 0) {
  if (rnds.length < 16) {
    throw new Error("Random bytes length must be >= 16");
  }
  if (!buf) {
    buf = new Uint8Array(16);
    offset = 0;
  } else {
    if (offset < 0 || offset + 16 > buf.length) {
      throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
    }
  }
  msecs ??= Date.now();
  seq ??= rnds[6] * 127 << 24 | rnds[7] << 16 | rnds[8] << 8 | rnds[9];
  buf[offset++] = msecs / 1099511627776 & 255;
  buf[offset++] = msecs / 4294967296 & 255;
  buf[offset++] = msecs / 16777216 & 255;
  buf[offset++] = msecs / 65536 & 255;
  buf[offset++] = msecs / 256 & 255;
  buf[offset++] = msecs & 255;
  buf[offset++] = 112 | seq >>> 28 & 15;
  buf[offset++] = seq >>> 20 & 255;
  buf[offset++] = 128 | seq >>> 14 & 63;
  buf[offset++] = seq >>> 6 & 255;
  buf[offset++] = seq << 2 & 255 | rnds[10] & 3;
  buf[offset++] = rnds[11];
  buf[offset++] = rnds[12];
  buf[offset++] = rnds[13];
  buf[offset++] = rnds[14];
  buf[offset++] = rnds[15];
  return buf;
}
var v7_default = v7;

// node_modules/uuid/dist/version.js
function version(uuid) {
  if (!validate_default(uuid)) {
    throw TypeError("Invalid UUID");
  }
  return parseInt(uuid.slice(14, 15), 16);
}
var version_default = version;

// node_modules/@sovereignbase/utils/dist/index.js
var PROTOTYPE_LIST = [
  "null",
  "undefined",
  "boolean",
  "string",
  "symbol",
  "number",
  "bigint",
  "record",
  "array",
  "map",
  "set",
  "date",
  "regexp",
  "error",
  "arraybuffer",
  "sharedarraybuffer",
  "dataview",
  "int8array",
  "uint8array",
  "uint8clampedarray",
  "int16array",
  "uint16array",
  "int32array",
  "uint32array",
  "float32array",
  "float64array",
  "bigint64array",
  "biguint64array",
  "url",
  "urlsearchparams",
  "blob",
  "file",
  "unknown"
];
function prototype(value) {
  let type = typeof value;
  if (type === "object") {
    type = Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
  }
  if (type === "object") type = "record";
  if (!PROTOTYPE_LIST.includes(type)) {
    type = "unknown";
  }
  return type;
}
function isUuidV7(value) {
  if (typeof value !== "string") return false;
  try {
    return version_default(value) === 7;
  } catch {
    return false;
  }
}
function safeStructuredClone(value) {
  try {
    return [true, structuredClone(value)];
  } catch {
    return [false];
  }
}

// node_modules/@sovereignbase/convergent-replicated-map/dist/index.js
function transformSnapshotEntryToStateEntry(snapshotEntry) {
  if (prototype(snapshotEntry) !== "record" || !Object.hasOwn(snapshotEntry, "value") || !isUuidV7(snapshotEntry.uuidv7) || !isUuidV7(snapshotEntry.predecessor))
    return false;
  const { key, value } = snapshotEntry.value;
  if (!key || typeof key !== "string") return false;
  const [cloned, copiedValue] = safeStructuredClone(value);
  if (!cloned) return false;
  return {
    uuidv7: snapshotEntry.uuidv7,
    value: { key, value: copiedValue },
    predecessor: snapshotEntry.predecessor
  };
}
function transformStateEntryToSnapshotEntry(stateEntry) {
  return {
    uuidv7: stateEntry.uuidv7,
    value: {
      key: stateEntry.value.key,
      value: structuredClone(stateEntry.value.value)
    },
    predecessor: stateEntry.predecessor
  };
}
function __create(snapshot) {
  const crMapReplica = {
    values: /* @__PURE__ */ new Map(),
    relations: /* @__PURE__ */ new Map(),
    tombstones: /* @__PURE__ */ new Set(),
    predecessors: /* @__PURE__ */ new Set()
  };
  if (!snapshot || prototype(snapshot) !== "record") return crMapReplica;
  if (Object.hasOwn(snapshot, "tombstones") && Array.isArray(snapshot.tombstones)) {
    for (const tombstone of snapshot.tombstones) {
      if (!isUuidV7(tombstone) || crMapReplica.tombstones.has(tombstone))
        continue;
      crMapReplica.tombstones.add(tombstone);
    }
  }
  if (!Object.hasOwn(snapshot, "values") || !Array.isArray(snapshot.values))
    return crMapReplica;
  for (const snapshotEntry of snapshot.values) {
    if (prototype(snapshotEntry) !== "record") continue;
    if (crMapReplica.tombstones.has(snapshotEntry.uuidv7)) continue;
    const stateEntry = transformSnapshotEntryToStateEntry(snapshotEntry);
    if (!stateEntry) continue;
    const currentEntry = crMapReplica.values.get(stateEntry.value.key);
    if (currentEntry && currentEntry.uuidv7 === stateEntry.uuidv7 && currentEntry.predecessor >= stateEntry.predecessor)
      continue;
    if (currentEntry && currentEntry.uuidv7 !== stateEntry.uuidv7 && currentEntry.uuidv7 !== stateEntry.predecessor && currentEntry.uuidv7 >= stateEntry.uuidv7)
      continue;
    if (currentEntry) {
      crMapReplica.relations.delete(currentEntry.uuidv7);
      crMapReplica.predecessors.delete(currentEntry.predecessor);
    }
    crMapReplica.relations.set(stateEntry.uuidv7, stateEntry.value.key);
    crMapReplica.values.set(stateEntry.value.key, stateEntry);
    crMapReplica.predecessors.add(stateEntry.predecessor);
  }
  return crMapReplica;
}
function __read(key, crMapReplica) {
  return structuredClone(crMapReplica.values.get(key)?.value.value);
}
var CRMapError = class extends Error {
  /**
   * The semantic error code for the failure.
   */
  code;
  /**
   * Creates a typed CRMap error.
   *
   * @param code - The semantic error code.
   * @param message - An optional human-readable detail message.
   */
  constructor(code, message) {
    const detail = message ?? code;
    super(`{@sovereignbase/convergent-replicated-map} ${detail}`);
    this.code = code;
    this.name = "CRMapError";
  }
};
function __update(key, value, crMapReplica) {
  if (typeof key !== "string" || key.length === 0)
    throw new CRMapError("INVALID_KEY", "Map keys must be non-empty strings.");
  const [cloned, copiedValue] = safeStructuredClone(value);
  if (!cloned)
    throw new CRMapError(
      "VALUE_NOT_CLONEABLE",
      "Updated values must be supported by structuredClone."
    );
  const oldEntry = crMapReplica.values.get(key);
  const predecessor = oldEntry ? oldEntry.uuidv7 : v7_default();
  const entry = {
    uuidv7: v7_default(),
    value: { key, value: copiedValue },
    predecessor
  };
  if (oldEntry) {
    crMapReplica.relations.delete(oldEntry.uuidv7);
    crMapReplica.predecessors.delete(oldEntry.predecessor);
  }
  crMapReplica.values.set(key, entry);
  crMapReplica.relations.set(entry.uuidv7, key);
  crMapReplica.predecessors.add(predecessor);
  crMapReplica.tombstones.add(predecessor);
  const delta = {
    values: [
      {
        uuidv7: entry.uuidv7,
        value: { key, value: copiedValue },
        predecessor
      }
    ],
    tombstones: [predecessor]
  };
  const change = {};
  change[key] = structuredClone(copiedValue);
  return { delta, change };
}
function __delete(keyOrReplica, crMapReplicaOrKey) {
  const crMapReplica = typeof keyOrReplica === "string" ? crMapReplicaOrKey : keyOrReplica;
  const key = typeof keyOrReplica === "string" ? keyOrReplica : typeof crMapReplicaOrKey === "string" ? crMapReplicaOrKey : void 0;
  if (!crMapReplica) return false;
  if (key !== void 0) {
    if (typeof key !== "string" || key.length === 0)
      throw new CRMapError("INVALID_KEY", "Map keys must be non-empty strings.");
    const entry = crMapReplica.values.get(key);
    if (!entry) return false;
    crMapReplica.tombstones.add(entry.uuidv7);
    crMapReplica.values.delete(key);
    crMapReplica.relations.delete(entry.uuidv7);
    crMapReplica.predecessors.delete(entry.predecessor);
    const delta2 = {
      tombstones: [entry.uuidv7]
    };
    const change2 = { [key]: void 0 };
    return { delta: delta2, change: change2 };
  }
  if (crMapReplica.values.size === 0) return false;
  const delta = { tombstones: [] };
  const change = {};
  for (const [liveKey, entry] of crMapReplica.values.entries()) {
    crMapReplica.tombstones.add(entry.uuidv7);
    delta.tombstones.push(entry.uuidv7);
    change[liveKey] = void 0;
  }
  crMapReplica.values.clear();
  crMapReplica.relations.clear();
  crMapReplica.predecessors.clear();
  return { delta, change };
}
function __merge(crMapDelta, crMapReplica) {
  if (!crMapDelta || prototype(crMapDelta) !== "record") return false;
  const change = {};
  const delta = {};
  let hasChange = false;
  let hasDelta = false;
  if (Object.hasOwn(crMapDelta, "tombstones") && Array.isArray(crMapDelta.tombstones)) {
    for (const tombstone of crMapDelta.tombstones) {
      if (!isUuidV7(tombstone) || crMapReplica.tombstones.has(tombstone))
        continue;
      crMapReplica.tombstones.add(tombstone);
      const live = crMapReplica.relations.get(tombstone);
      if (!live) continue;
      const currentEntry = crMapReplica.values.get(live);
      if (!currentEntry || currentEntry.uuidv7 !== tombstone) {
        crMapReplica.relations.delete(tombstone);
        continue;
      }
      crMapReplica.values.delete(live);
      crMapReplica.relations.delete(tombstone);
      crMapReplica.predecessors.delete(currentEntry.predecessor);
      change[live] = void 0;
      hasChange = true;
    }
  }
  if (!Object.hasOwn(crMapDelta, "values") || !Array.isArray(crMapDelta.values))
    return hasChange ? { change, delta } : false;
  for (const snapshotEntry of crMapDelta.values) {
    if (prototype(snapshotEntry) !== "record") continue;
    if (crMapReplica.tombstones.has(snapshotEntry.uuidv7)) continue;
    const contender = transformSnapshotEntryToStateEntry(snapshotEntry);
    if (!contender) continue;
    const currentEntry = crMapReplica.values.get(contender.value.key);
    if (!currentEntry) {
      crMapReplica.values.set(contender.value.key, contender);
      crMapReplica.relations.set(contender.uuidv7, contender.value.key);
      crMapReplica.predecessors.add(contender.predecessor);
      crMapReplica.tombstones.add(contender.predecessor);
      change[contender.value.key] = structuredClone(contender.value.value);
      hasChange = true;
      continue;
    }
    if (currentEntry.uuidv7 === contender.uuidv7) {
      if (currentEntry.predecessor < contender.predecessor) {
        crMapReplica.predecessors.delete(currentEntry.predecessor);
        currentEntry.value = contender.value;
        currentEntry.predecessor = contender.predecessor;
        crMapReplica.predecessors.add(contender.predecessor);
        crMapReplica.tombstones.add(contender.predecessor);
        change[contender.value.key] = structuredClone(contender.value.value);
        hasChange = true;
      } else if (currentEntry.predecessor === contender.predecessor && JSON.stringify(currentEntry.value.value) === JSON.stringify(contender.value.value)) {
        continue;
      } else {
        if (!delta.values) delta.values = [];
        delta.values.push(transformStateEntryToSnapshotEntry(currentEntry));
        hasDelta = true;
      }
      continue;
    }
    if (currentEntry.uuidv7 === contender.predecessor || crMapReplica.tombstones.has(currentEntry.uuidv7) || contender.uuidv7 > currentEntry.uuidv7) {
      crMapReplica.tombstones.add(contender.predecessor);
      crMapReplica.tombstones.add(currentEntry.uuidv7);
      crMapReplica.relations.delete(currentEntry.uuidv7);
      crMapReplica.predecessors.delete(currentEntry.predecessor);
      crMapReplica.values.set(contender.value.key, contender);
      crMapReplica.relations.set(contender.uuidv7, contender.value.key);
      crMapReplica.predecessors.add(contender.predecessor);
      change[contender.value.key] = structuredClone(contender.value.value);
      hasChange = true;
      continue;
    }
    crMapReplica.tombstones.add(contender.uuidv7);
    if (!delta.tombstones) delta.tombstones = [];
    delta.tombstones.push(contender.uuidv7);
    if (!delta.values) delta.values = [];
    delta.values.push(transformStateEntryToSnapshotEntry(currentEntry));
    hasDelta = true;
  }
  if (!hasChange && !hasDelta) return false;
  return { change, delta };
}
function __acknowledge(crMapReplica) {
  let largest = "";
  for (const tombstone of crMapReplica.tombstones.values()) {
    if (!isUuidV7(tombstone) || tombstone < largest) continue;
    largest = tombstone;
  }
  return largest;
}
function __garbageCollect(frontiers, crMapReplica) {
  if (!Array.isArray(frontiers) || frontiers.length < 1) return;
  let smallest = "";
  for (const frontier of frontiers) {
    if (!isUuidV7(frontier)) continue;
    if (smallest !== "" && smallest <= frontier) continue;
    smallest = frontier;
  }
  if (smallest === "") return;
  crMapReplica.tombstones.forEach((tombstone, _, tombstones) => {
    if (tombstone > smallest || crMapReplica.predecessors.has(tombstone)) return;
    tombstones.delete(tombstone);
  });
}
function __snapshot(crMapReplica) {
  const out = {
    values: [],
    tombstones: Array.from(crMapReplica.tombstones)
  };
  for (const stateEntry of crMapReplica.values.values()) {
    out.values.push(transformStateEntryToSnapshotEntry(stateEntry));
  }
  return out;
}
var CRMap = class {
  /**
   * Creates a replicated map from an optional serializable snapshot.
   *
   * @param snapshot - A previously emitted CRMap snapshot.
   */
  constructor(snapshot) {
    Object.defineProperties(this, {
      state: {
        value: __create(snapshot),
        enumerable: false,
        configurable: false,
        writable: false
      },
      eventTarget: {
        value: new EventTarget(),
        enumerable: false,
        configurable: false,
        writable: false
      }
    });
  }
  /**
   * The current number of live keys.
   */
  get size() {
    return this.state.values.size;
  }
  /**
   * Reads the current visible value for a key.
   *
   * @param key - Target key in the live map.
   * @returns A detached copy of the value, or `undefined` when the key is absent.
   */
  get(key) {
    return __read(key, this.state);
  }
  /**
   * Checks whether a key currently exists in the live projection.
   *
   * @param key - Key to check.
   * @returns `true` when the key is currently visible.
   */
  has(key) {
    return this.state.values.has(key);
  }
  /**
   * Overwrites the visible value for a key.
   *
   * @param key - Key to write.
   * @param value - Next visible value for the key.
   * @throws {CRMapError} Thrown when the key is not a non-empty string.
   * @throws {CRMapError} Thrown when the value is not supported by `structuredClone`.
   */
  set(key, value) {
    const result = __update(key, value, this.state);
    if (!result) return;
    void this.eventTarget.dispatchEvent(
      new CustomEvent("delta", { detail: result.delta })
    );
    void this.eventTarget.dispatchEvent(
      new CustomEvent("change", { detail: result.change })
    );
  }
  /**
   * Deletes one visible key.
   *
   * @param key - Key to remove.
   * @throws {CRMapError} Thrown when the key is not a non-empty string.
   */
  delete(key) {
    const result = __delete(this.state, key);
    if (!result) return;
    void this.eventTarget.dispatchEvent(
      new CustomEvent("delta", { detail: result.delta })
    );
    void this.eventTarget.dispatchEvent(
      new CustomEvent("change", { detail: result.change })
    );
  }
  /**
   * Deletes every visible key.
   */
  clear() {
    const result = __delete(this.state);
    if (!result) return;
    void this.eventTarget.dispatchEvent(
      new CustomEvent("delta", { detail: result.delta })
    );
    void this.eventTarget.dispatchEvent(
      new CustomEvent("change", { detail: result.change })
    );
  }
  /**
   * Returns the current live keys.
   *
   * @returns The current keys in map iteration order.
   */
  keys() {
    return Array.from(this.state.values.keys());
  }
  /**
   * Returns detached copies of the current live values.
   *
   * @returns The current values in map iteration order.
   */
  values() {
    return Array.from(
      this.state.values.values(),
      (entry) => structuredClone(entry.value.value)
    );
  }
  /**
   * Returns detached key-value entries for the current live projection.
   *
   * @returns The current entries in map iteration order.
   */
  entries() {
    return Array.from(this.state.values.values(), (entry) => [
      entry.value.key,
      structuredClone(entry.value.value)
    ]);
  }
  /**
   * Applies a remote or local delta to the replica state.
   *
   * @param delta - The partial serialized map state to merge.
   */
  merge(delta) {
    const result = __merge(delta, this.state);
    if (!result) return;
    if ((result.delta.values?.length ?? 0) + (result.delta.tombstones?.length ?? 0) > 0) {
      void this.eventTarget.dispatchEvent(
        new CustomEvent("delta", { detail: result.delta })
      );
    }
    if (Object.keys(result.change).length > 0) {
      void this.eventTarget.dispatchEvent(
        new CustomEvent("change", { detail: result.change })
      );
    }
  }
  /**
   * Emits the current acknowledgement frontier.
   */
  acknowledge() {
    const ack = __acknowledge(this.state);
    if (!ack) return;
    void this.eventTarget.dispatchEvent(new CustomEvent("ack", { detail: ack }));
  }
  /**
   * Removes tombstones that every provided frontier has acknowledged.
   *
   * @param frontiers - Replica acknowledgement frontiers.
   */
  garbageCollect(frontiers) {
    void __garbageCollect(frontiers, this.state);
  }
  /**
   * Emits the current serializable map snapshot.
   */
  snapshot() {
    const snapshot = __snapshot(this.state);
    void this.eventTarget.dispatchEvent(
      new CustomEvent("snapshot", { detail: snapshot })
    );
  }
  /**
   * Registers an event listener.
   *
   * @param type - The event type to listen for.
   * @param listener - The listener to register.
   * @param options - Listener registration options.
   */
  addEventListener(type, listener, options) {
    this.eventTarget.addEventListener(type, listener, options);
  }
  /**
   * Removes an event listener.
   *
   * @param type - The event type to stop listening for.
   * @param listener - The listener to remove.
   * @param options - Listener removal options.
   */
  removeEventListener(type, listener, options) {
    this.eventTarget.removeEventListener(type, listener, options);
  }
  /**
   * Returns a serializable snapshot representation of this map.
   *
   * Called automatically by `JSON.stringify`.
   */
  toJSON() {
    return __snapshot(this.state);
  }
  /**
   * Attempts to return this map as a JSON string.
   */
  toString() {
    return JSON.stringify(this);
  }
  /**
   * Returns the Node.js console inspection representation.
   */
  [/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")]() {
    return this.toJSON();
  }
  /**
   * Returns the Deno console inspection representation.
   */
  [/* @__PURE__ */ Symbol.for("Deno.customInspect")]() {
    return this.toJSON();
  }
  /**
   * Iterates over detached copies of the current live entries.
   */
  *[Symbol.iterator]() {
    for (const entry of this.state.values.values()) {
      yield [entry.value.key, structuredClone(entry.value.value)];
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
  forEach(callback, thisArg) {
    for (const [key, value] of this) {
      callback.call(thisArg, value, key, this);
    }
  }
};

// node_modules/@msgpack/msgpack/dist.esm/utils/utf8.mjs
function utf8Count(str) {
  const strLength = str.length;
  let byteLength = 0;
  let pos = 0;
  while (pos < strLength) {
    let value = str.charCodeAt(pos++);
    if ((value & 4294967168) === 0) {
      byteLength++;
      continue;
    } else if ((value & 4294965248) === 0) {
      byteLength += 2;
    } else {
      if (value >= 55296 && value <= 56319) {
        if (pos < strLength) {
          const extra = str.charCodeAt(pos);
          if ((extra & 64512) === 56320) {
            ++pos;
            value = ((value & 1023) << 10) + (extra & 1023) + 65536;
          }
        }
      }
      if ((value & 4294901760) === 0) {
        byteLength += 3;
      } else {
        byteLength += 4;
      }
    }
  }
  return byteLength;
}
function utf8EncodeJs(str, output, outputOffset) {
  const strLength = str.length;
  let offset = outputOffset;
  let pos = 0;
  while (pos < strLength) {
    let value = str.charCodeAt(pos++);
    if ((value & 4294967168) === 0) {
      output[offset++] = value;
      continue;
    } else if ((value & 4294965248) === 0) {
      output[offset++] = value >> 6 & 31 | 192;
    } else {
      if (value >= 55296 && value <= 56319) {
        if (pos < strLength) {
          const extra = str.charCodeAt(pos);
          if ((extra & 64512) === 56320) {
            ++pos;
            value = ((value & 1023) << 10) + (extra & 1023) + 65536;
          }
        }
      }
      if ((value & 4294901760) === 0) {
        output[offset++] = value >> 12 & 15 | 224;
        output[offset++] = value >> 6 & 63 | 128;
      } else {
        output[offset++] = value >> 18 & 7 | 240;
        output[offset++] = value >> 12 & 63 | 128;
        output[offset++] = value >> 6 & 63 | 128;
      }
    }
    output[offset++] = value & 63 | 128;
  }
}
var sharedTextEncoder = new TextEncoder();
var TEXT_ENCODER_THRESHOLD = 50;
function utf8EncodeTE(str, output, outputOffset) {
  sharedTextEncoder.encodeInto(str, output.subarray(outputOffset));
}
function utf8Encode(str, output, outputOffset) {
  if (str.length > TEXT_ENCODER_THRESHOLD) {
    utf8EncodeTE(str, output, outputOffset);
  } else {
    utf8EncodeJs(str, output, outputOffset);
  }
}
var sharedTextDecoder = new TextDecoder();

// node_modules/@msgpack/msgpack/dist.esm/ExtData.mjs
var ExtData = class {
  type;
  data;
  constructor(type, data) {
    this.type = type;
    this.data = data;
  }
};

// node_modules/@msgpack/msgpack/dist.esm/DecodeError.mjs
var DecodeError = class _DecodeError extends Error {
  constructor(message) {
    super(message);
    const proto = Object.create(_DecodeError.prototype);
    Object.setPrototypeOf(this, proto);
    Object.defineProperty(this, "name", {
      configurable: true,
      enumerable: false,
      value: _DecodeError.name
    });
  }
};

// node_modules/@msgpack/msgpack/dist.esm/utils/int.mjs
function setUint64(view, offset, value) {
  const high = value / 4294967296;
  const low = value;
  view.setUint32(offset, high);
  view.setUint32(offset + 4, low);
}
function setInt64(view, offset, value) {
  const high = Math.floor(value / 4294967296);
  const low = value;
  view.setUint32(offset, high);
  view.setUint32(offset + 4, low);
}
function getInt64(view, offset) {
  const high = view.getInt32(offset);
  const low = view.getUint32(offset + 4);
  return high * 4294967296 + low;
}

// node_modules/@msgpack/msgpack/dist.esm/timestamp.mjs
var EXT_TIMESTAMP = -1;
var TIMESTAMP32_MAX_SEC = 4294967296 - 1;
var TIMESTAMP64_MAX_SEC = 17179869184 - 1;
function encodeTimeSpecToTimestamp({ sec, nsec }) {
  if (sec >= 0 && nsec >= 0 && sec <= TIMESTAMP64_MAX_SEC) {
    if (nsec === 0 && sec <= TIMESTAMP32_MAX_SEC) {
      const rv = new Uint8Array(4);
      const view = new DataView(rv.buffer);
      view.setUint32(0, sec);
      return rv;
    } else {
      const secHigh = sec / 4294967296;
      const secLow = sec & 4294967295;
      const rv = new Uint8Array(8);
      const view = new DataView(rv.buffer);
      view.setUint32(0, nsec << 2 | secHigh & 3);
      view.setUint32(4, secLow);
      return rv;
    }
  } else {
    const rv = new Uint8Array(12);
    const view = new DataView(rv.buffer);
    view.setUint32(0, nsec);
    setInt64(view, 4, sec);
    return rv;
  }
}
function encodeDateToTimeSpec(date) {
  const msec = date.getTime();
  const sec = Math.floor(msec / 1e3);
  const nsec = (msec - sec * 1e3) * 1e6;
  const nsecInSec = Math.floor(nsec / 1e9);
  return {
    sec: sec + nsecInSec,
    nsec: nsec - nsecInSec * 1e9
  };
}
function encodeTimestampExtension(object) {
  if (object instanceof Date) {
    const timeSpec = encodeDateToTimeSpec(object);
    return encodeTimeSpecToTimestamp(timeSpec);
  } else {
    return null;
  }
}
function decodeTimestampToTimeSpec(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  switch (data.byteLength) {
    case 4: {
      const sec = view.getUint32(0);
      const nsec = 0;
      return { sec, nsec };
    }
    case 8: {
      const nsec30AndSecHigh2 = view.getUint32(0);
      const secLow32 = view.getUint32(4);
      const sec = (nsec30AndSecHigh2 & 3) * 4294967296 + secLow32;
      const nsec = nsec30AndSecHigh2 >>> 2;
      return { sec, nsec };
    }
    case 12: {
      const sec = getInt64(view, 4);
      const nsec = view.getUint32(0);
      return { sec, nsec };
    }
    default:
      throw new DecodeError(`Unrecognized data size for timestamp (expected 4, 8, or 12): ${data.length}`);
  }
}
function decodeTimestampExtension(data) {
  const timeSpec = decodeTimestampToTimeSpec(data);
  return new Date(timeSpec.sec * 1e3 + timeSpec.nsec / 1e6);
}
var timestampExtension = {
  type: EXT_TIMESTAMP,
  encode: encodeTimestampExtension,
  decode: decodeTimestampExtension
};

// node_modules/@msgpack/msgpack/dist.esm/ExtensionCodec.mjs
var ExtensionCodec = class _ExtensionCodec {
  static defaultCodec = new _ExtensionCodec();
  // ensures ExtensionCodecType<X> matches ExtensionCodec<X>
  // this will make type errors a lot more clear
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __brand;
  // built-in extensions
  builtInEncoders = [];
  builtInDecoders = [];
  // custom extensions
  encoders = [];
  decoders = [];
  constructor() {
    this.register(timestampExtension);
  }
  register({ type, encode: encode2, decode }) {
    if (type >= 0) {
      this.encoders[type] = encode2;
      this.decoders[type] = decode;
    } else {
      const index = -1 - type;
      this.builtInEncoders[index] = encode2;
      this.builtInDecoders[index] = decode;
    }
  }
  tryToEncode(object, context) {
    for (let i = 0; i < this.builtInEncoders.length; i++) {
      const encodeExt = this.builtInEncoders[i];
      if (encodeExt != null) {
        const data = encodeExt(object, context);
        if (data != null) {
          const type = -1 - i;
          return new ExtData(type, data);
        }
      }
    }
    for (let i = 0; i < this.encoders.length; i++) {
      const encodeExt = this.encoders[i];
      if (encodeExt != null) {
        const data = encodeExt(object, context);
        if (data != null) {
          const type = i;
          return new ExtData(type, data);
        }
      }
    }
    if (object instanceof ExtData) {
      return object;
    }
    return null;
  }
  decode(data, type, context) {
    const decodeExt = type < 0 ? this.builtInDecoders[-1 - type] : this.decoders[type];
    if (decodeExt) {
      return decodeExt(data, type, context);
    } else {
      return new ExtData(type, data);
    }
  }
};

// node_modules/@msgpack/msgpack/dist.esm/utils/typedArrays.mjs
function isArrayBufferLike(buffer) {
  return buffer instanceof ArrayBuffer || typeof SharedArrayBuffer !== "undefined" && buffer instanceof SharedArrayBuffer;
}
function ensureUint8Array(buffer) {
  if (buffer instanceof Uint8Array) {
    return buffer;
  } else if (ArrayBuffer.isView(buffer)) {
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } else if (isArrayBufferLike(buffer)) {
    return new Uint8Array(buffer);
  } else {
    return Uint8Array.from(buffer);
  }
}

// node_modules/@msgpack/msgpack/dist.esm/Encoder.mjs
var DEFAULT_MAX_DEPTH = 100;
var DEFAULT_INITIAL_BUFFER_SIZE = 2048;
var Encoder = class _Encoder {
  extensionCodec;
  context;
  useBigInt64;
  maxDepth;
  initialBufferSize;
  sortKeys;
  forceFloat32;
  ignoreUndefined;
  forceIntegerToFloat;
  pos;
  view;
  bytes;
  entered = false;
  constructor(options) {
    this.extensionCodec = options?.extensionCodec ?? ExtensionCodec.defaultCodec;
    this.context = options?.context;
    this.useBigInt64 = options?.useBigInt64 ?? false;
    this.maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
    this.initialBufferSize = options?.initialBufferSize ?? DEFAULT_INITIAL_BUFFER_SIZE;
    this.sortKeys = options?.sortKeys ?? false;
    this.forceFloat32 = options?.forceFloat32 ?? false;
    this.ignoreUndefined = options?.ignoreUndefined ?? false;
    this.forceIntegerToFloat = options?.forceIntegerToFloat ?? false;
    this.pos = 0;
    this.view = new DataView(new ArrayBuffer(this.initialBufferSize));
    this.bytes = new Uint8Array(this.view.buffer);
  }
  clone() {
    return new _Encoder({
      extensionCodec: this.extensionCodec,
      context: this.context,
      useBigInt64: this.useBigInt64,
      maxDepth: this.maxDepth,
      initialBufferSize: this.initialBufferSize,
      sortKeys: this.sortKeys,
      forceFloat32: this.forceFloat32,
      ignoreUndefined: this.ignoreUndefined,
      forceIntegerToFloat: this.forceIntegerToFloat
    });
  }
  reinitializeState() {
    this.pos = 0;
  }
  /**
   * This is almost equivalent to {@link Encoder#encode}, but it returns an reference of the encoder's internal buffer and thus much faster than {@link Encoder#encode}.
   *
   * @returns Encodes the object and returns a shared reference the encoder's internal buffer.
   */
  encodeSharedRef(object) {
    if (this.entered) {
      const instance = this.clone();
      return instance.encodeSharedRef(object);
    }
    try {
      this.entered = true;
      this.reinitializeState();
      this.doEncode(object, 1);
      return this.bytes.subarray(0, this.pos);
    } finally {
      this.entered = false;
    }
  }
  /**
   * @returns Encodes the object and returns a copy of the encoder's internal buffer.
   */
  encode(object) {
    if (this.entered) {
      const instance = this.clone();
      return instance.encode(object);
    }
    try {
      this.entered = true;
      this.reinitializeState();
      this.doEncode(object, 1);
      return this.bytes.slice(0, this.pos);
    } finally {
      this.entered = false;
    }
  }
  doEncode(object, depth) {
    if (depth > this.maxDepth) {
      throw new Error(`Too deep objects in depth ${depth}`);
    }
    if (object == null) {
      this.encodeNil();
    } else if (typeof object === "boolean") {
      this.encodeBoolean(object);
    } else if (typeof object === "number") {
      if (!this.forceIntegerToFloat) {
        this.encodeNumber(object);
      } else {
        this.encodeNumberAsFloat(object);
      }
    } else if (typeof object === "string") {
      this.encodeString(object);
    } else if (this.useBigInt64 && typeof object === "bigint") {
      this.encodeBigInt64(object);
    } else {
      this.encodeObject(object, depth);
    }
  }
  ensureBufferSizeToWrite(sizeToWrite) {
    const requiredSize = this.pos + sizeToWrite;
    if (this.view.byteLength < requiredSize) {
      this.resizeBuffer(requiredSize * 2);
    }
  }
  resizeBuffer(newSize) {
    const newBuffer = new ArrayBuffer(newSize);
    const newBytes = new Uint8Array(newBuffer);
    const newView = new DataView(newBuffer);
    newBytes.set(this.bytes);
    this.view = newView;
    this.bytes = newBytes;
  }
  encodeNil() {
    this.writeU8(192);
  }
  encodeBoolean(object) {
    if (object === false) {
      this.writeU8(194);
    } else {
      this.writeU8(195);
    }
  }
  encodeNumber(object) {
    if (!this.forceIntegerToFloat && Number.isSafeInteger(object)) {
      if (object >= 0) {
        if (object < 128) {
          this.writeU8(object);
        } else if (object < 256) {
          this.writeU8(204);
          this.writeU8(object);
        } else if (object < 65536) {
          this.writeU8(205);
          this.writeU16(object);
        } else if (object < 4294967296) {
          this.writeU8(206);
          this.writeU32(object);
        } else if (!this.useBigInt64) {
          this.writeU8(207);
          this.writeU64(object);
        } else {
          this.encodeNumberAsFloat(object);
        }
      } else {
        if (object >= -32) {
          this.writeU8(224 | object + 32);
        } else if (object >= -128) {
          this.writeU8(208);
          this.writeI8(object);
        } else if (object >= -32768) {
          this.writeU8(209);
          this.writeI16(object);
        } else if (object >= -2147483648) {
          this.writeU8(210);
          this.writeI32(object);
        } else if (!this.useBigInt64) {
          this.writeU8(211);
          this.writeI64(object);
        } else {
          this.encodeNumberAsFloat(object);
        }
      }
    } else {
      this.encodeNumberAsFloat(object);
    }
  }
  encodeNumberAsFloat(object) {
    if (this.forceFloat32) {
      this.writeU8(202);
      this.writeF32(object);
    } else {
      this.writeU8(203);
      this.writeF64(object);
    }
  }
  encodeBigInt64(object) {
    if (object >= BigInt(0)) {
      this.writeU8(207);
      this.writeBigUint64(object);
    } else {
      this.writeU8(211);
      this.writeBigInt64(object);
    }
  }
  writeStringHeader(byteLength) {
    if (byteLength < 32) {
      this.writeU8(160 + byteLength);
    } else if (byteLength < 256) {
      this.writeU8(217);
      this.writeU8(byteLength);
    } else if (byteLength < 65536) {
      this.writeU8(218);
      this.writeU16(byteLength);
    } else if (byteLength < 4294967296) {
      this.writeU8(219);
      this.writeU32(byteLength);
    } else {
      throw new Error(`Too long string: ${byteLength} bytes in UTF-8`);
    }
  }
  encodeString(object) {
    const maxHeaderSize = 1 + 4;
    const byteLength = utf8Count(object);
    this.ensureBufferSizeToWrite(maxHeaderSize + byteLength);
    this.writeStringHeader(byteLength);
    utf8Encode(object, this.bytes, this.pos);
    this.pos += byteLength;
  }
  encodeObject(object, depth) {
    const ext = this.extensionCodec.tryToEncode(object, this.context);
    if (ext != null) {
      this.encodeExtension(ext);
    } else if (Array.isArray(object)) {
      this.encodeArray(object, depth);
    } else if (ArrayBuffer.isView(object)) {
      this.encodeBinary(object);
    } else if (typeof object === "object") {
      this.encodeMap(object, depth);
    } else {
      throw new Error(`Unrecognized object: ${Object.prototype.toString.apply(object)}`);
    }
  }
  encodeBinary(object) {
    const size = object.byteLength;
    if (size < 256) {
      this.writeU8(196);
      this.writeU8(size);
    } else if (size < 65536) {
      this.writeU8(197);
      this.writeU16(size);
    } else if (size < 4294967296) {
      this.writeU8(198);
      this.writeU32(size);
    } else {
      throw new Error(`Too large binary: ${size}`);
    }
    const bytes = ensureUint8Array(object);
    this.writeU8a(bytes);
  }
  encodeArray(object, depth) {
    const size = object.length;
    if (size < 16) {
      this.writeU8(144 + size);
    } else if (size < 65536) {
      this.writeU8(220);
      this.writeU16(size);
    } else if (size < 4294967296) {
      this.writeU8(221);
      this.writeU32(size);
    } else {
      throw new Error(`Too large array: ${size}`);
    }
    for (const item of object) {
      this.doEncode(item, depth + 1);
    }
  }
  countWithoutUndefined(object, keys) {
    let count = 0;
    for (const key of keys) {
      if (object[key] !== void 0) {
        count++;
      }
    }
    return count;
  }
  encodeMap(object, depth) {
    const keys = Object.keys(object);
    if (this.sortKeys) {
      keys.sort();
    }
    const size = this.ignoreUndefined ? this.countWithoutUndefined(object, keys) : keys.length;
    if (size < 16) {
      this.writeU8(128 + size);
    } else if (size < 65536) {
      this.writeU8(222);
      this.writeU16(size);
    } else if (size < 4294967296) {
      this.writeU8(223);
      this.writeU32(size);
    } else {
      throw new Error(`Too large map object: ${size}`);
    }
    for (const key of keys) {
      const value = object[key];
      if (!(this.ignoreUndefined && value === void 0)) {
        this.encodeString(key);
        this.doEncode(value, depth + 1);
      }
    }
  }
  encodeExtension(ext) {
    if (typeof ext.data === "function") {
      const data = ext.data(this.pos + 6);
      const size2 = data.length;
      if (size2 >= 4294967296) {
        throw new Error(`Too large extension object: ${size2}`);
      }
      this.writeU8(201);
      this.writeU32(size2);
      this.writeI8(ext.type);
      this.writeU8a(data);
      return;
    }
    const size = ext.data.length;
    if (size === 1) {
      this.writeU8(212);
    } else if (size === 2) {
      this.writeU8(213);
    } else if (size === 4) {
      this.writeU8(214);
    } else if (size === 8) {
      this.writeU8(215);
    } else if (size === 16) {
      this.writeU8(216);
    } else if (size < 256) {
      this.writeU8(199);
      this.writeU8(size);
    } else if (size < 65536) {
      this.writeU8(200);
      this.writeU16(size);
    } else if (size < 4294967296) {
      this.writeU8(201);
      this.writeU32(size);
    } else {
      throw new Error(`Too large extension object: ${size}`);
    }
    this.writeI8(ext.type);
    this.writeU8a(ext.data);
  }
  writeU8(value) {
    this.ensureBufferSizeToWrite(1);
    this.view.setUint8(this.pos, value);
    this.pos++;
  }
  writeU8a(values2) {
    const size = values2.length;
    this.ensureBufferSizeToWrite(size);
    this.bytes.set(values2, this.pos);
    this.pos += size;
  }
  writeI8(value) {
    this.ensureBufferSizeToWrite(1);
    this.view.setInt8(this.pos, value);
    this.pos++;
  }
  writeU16(value) {
    this.ensureBufferSizeToWrite(2);
    this.view.setUint16(this.pos, value);
    this.pos += 2;
  }
  writeI16(value) {
    this.ensureBufferSizeToWrite(2);
    this.view.setInt16(this.pos, value);
    this.pos += 2;
  }
  writeU32(value) {
    this.ensureBufferSizeToWrite(4);
    this.view.setUint32(this.pos, value);
    this.pos += 4;
  }
  writeI32(value) {
    this.ensureBufferSizeToWrite(4);
    this.view.setInt32(this.pos, value);
    this.pos += 4;
  }
  writeF32(value) {
    this.ensureBufferSizeToWrite(4);
    this.view.setFloat32(this.pos, value);
    this.pos += 4;
  }
  writeF64(value) {
    this.ensureBufferSizeToWrite(8);
    this.view.setFloat64(this.pos, value);
    this.pos += 8;
  }
  writeU64(value) {
    this.ensureBufferSizeToWrite(8);
    setUint64(this.view, this.pos, value);
    this.pos += 8;
  }
  writeI64(value) {
    this.ensureBufferSizeToWrite(8);
    setInt64(this.view, this.pos, value);
    this.pos += 8;
  }
  writeBigUint64(value) {
    this.ensureBufferSizeToWrite(8);
    this.view.setBigUint64(this.pos, value);
    this.pos += 8;
  }
  writeBigInt64(value) {
    this.ensureBufferSizeToWrite(8);
    this.view.setBigInt64(this.pos, value);
    this.pos += 8;
  }
};

// node_modules/@msgpack/msgpack/dist.esm/encode.mjs
function encode(value, options) {
  const encoder = new Encoder(options);
  return encoder.encodeSharedRef(value);
}

// node_modules/@noble/hashes/utils.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
}
function abytes(value, length, title = "") {
  const bytes = isBytes(value);
  const len = value?.length;
  const needsLen = length !== void 0;
  if (!bytes || needsLen && len !== length) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    const message = prefix + "expected Uint8Array" + ofLen + ", got " + got;
    if (!bytes)
      throw new TypeError(message);
    throw new RangeError(message);
  }
  return value;
}
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput(out, instance) {
  abytes(out, void 0, "digestInto() output");
  const min = instance.outputLen;
  if (out.length < min) {
    throw new RangeError('"digestInto() output" expected to be of length >=' + min);
  }
}
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
function createHasher(hashCons, info = {}) {
  const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
  const tmp = hashCons(void 0);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.canXOF = tmp.canXOF;
  hashC.create = (opts) => hashCons(opts);
  Object.assign(hashC, info);
  return Object.freeze(hashC);
}
var oidNist = (suffix) => ({
  // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
  // Larger suffix values would need base-128 OID encoding and a different length byte.
  oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
});

// node_modules/@noble/hashes/_md.js
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}
var HashMD = class {
  blockLen;
  outputLen;
  canXOF = false;
  padOffset;
  isLE;
  // For partial updates less than block size
  buffer;
  view;
  finished = false;
  length = 0;
  pos = 0;
  destroyed = false;
  constructor(blockLen, outputLen, padOffset, isLE) {
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    aexists(this);
    abytes(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView(data);
        for (; blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    clean(this.buffer.subarray(pos));
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i = pos; i < blockLen; i++)
      buffer[i] = 0;
    view.setBigUint64(blockLen - 8, BigInt(this.length * 8), isLE);
    this.process(view, 0);
    const oview = createView(out);
    const len = this.outputLen;
    if (len % 4)
      throw new Error("_sha2: outputLen must be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let i = 0; i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to ||= new this.constructor();
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    if (length % blockLen)
      to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
};
var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);

// node_modules/@noble/hashes/sha2.js
var SHA256_K = /* @__PURE__ */ Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
var SHA2_32B = class extends HashMD {
  constructor(outputLen) {
    super(64, outputLen, 8, false);
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  // prettier-ignore
  set(A, B, C, D, E, F, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  process(view, offset) {
    for (let i = 0; i < 16; i++, offset += 4)
      SHA256_W[i] = view.getUint32(offset, false);
    for (let i = 16; i < 64; i++) {
      const W15 = SHA256_W[i - 15];
      const W2 = SHA256_W[i - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
      SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
    }
    let { A, B, C, D, E, F, G, H } = this;
    for (let i = 0; i < 64; i++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
      const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
      const T2 = sigma0 + Maj(A, B, C) | 0;
      H = G;
      G = F;
      F = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D, E, F, G, H);
  }
  roundClean() {
    clean(SHA256_W);
  }
  destroy() {
    this.destroyed = true;
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    clean(this.buffer);
  }
};
var _SHA256 = class extends SHA2_32B {
  // We cannot use array here since array allows indexing by variable
  // which means optimizer/compiler cannot use registers.
  A = SHA256_IV[0] | 0;
  B = SHA256_IV[1] | 0;
  C = SHA256_IV[2] | 0;
  D = SHA256_IV[3] | 0;
  E = SHA256_IV[4] | 0;
  F = SHA256_IV[5] | 0;
  G = SHA256_IV[6] | 0;
  H = SHA256_IV[7] | 0;
  constructor() {
    super(32);
  }
};
var sha256 = /* @__PURE__ */ createHasher(
  () => new _SHA256(),
  /* @__PURE__ */ oidNist(1)
);

// node_modules/@sovereignbase/bytecodec/dist/index.js
var BytecodecError = class extends Error {
  /**
   * Machine-readable error code for programmatic handling.
   */
  code;
  /**
   * Creates a new bytecodec error with a package-prefixed message.
   *
   * @param code Stable error code describing the failure category.
   * @param message Optional human-readable detail appended to the package prefix.
   */
  constructor(code, message) {
    const detail = message ?? code;
    super(`{@sovereignbase/bytecodec} ${detail}`);
    this.code = code;
    this.name = "BytecodecError";
  }
};
var textEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
var textDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
function isNodeRuntime() {
  return typeof process !== "undefined" && !!process.versions?.node;
}
function isSharedArrayBuffer(buffer) {
  return typeof SharedArrayBuffer !== "undefined" && buffer instanceof SharedArrayBuffer;
}
async function importNodeBuiltin(specifier) {
  const importer = new Function("specifier", "return import(specifier)");
  return importer(specifier);
}
var HEX_PAIRS = Array.from(
  { length: 256 },
  (_, value) => value.toString(16).padStart(2, "0")
);
var HEX_VALUES = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let index = 0; index < 10; index++)
    table["0".charCodeAt(0) + index] = index;
  for (let index = 0; index < 6; index++) {
    table["A".charCodeAt(0) + index] = index + 10;
    table["a".charCodeAt(0) + index] = index + 10;
  }
  return table;
})();
var BASE45_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
var BASE45_VALUES = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < BASE45_CHARS.length; i++) {
    table[BASE45_CHARS.charCodeAt(i)] = i;
  }
  return table;
})();
var Z85_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#";
var Z85_VALUES = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < Z85_CHARS.length; i++) {
    table[Z85_CHARS.charCodeAt(i)] = i;
  }
  return table;
})();
var BASE58BTC_PREFIX = "z";
var BASE58BTC_CHARS = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
var BASE58BTC_VALUES = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < BASE58BTC_CHARS.length; i++) {
    table[BASE58BTC_CHARS.charCodeAt(i)] = i;
  }
  return table;
})();
function fromBase45String(base45String) {
  if (typeof base45String !== "string")
    throw new BytecodecError(
      "BASE45_INPUT_EXPECTED",
      "fromBase45String expects a string input"
    );
  if (base45String.length % 3 === 1)
    throw new BytecodecError(
      "BASE45_INVALID_LENGTH",
      "Base45 string length must not leave a trailing single character"
    );
  const bytes = new Uint8Array(
    Math.floor(base45String.length / 3) * 2 + (base45String.length % 3 === 2 ? 1 : 0)
  );
  let byteOffset = 0;
  for (let stringOffset = 0; stringOffset < base45String.length; ) {
    const remaining = base45String.length - stringOffset;
    const digit0 = toBase45Digit(base45String, stringOffset);
    const digit1 = toBase45Digit(base45String, stringOffset + 1);
    if (remaining === 2) {
      const value2 = digit0 + digit1 * 45;
      if (value2 > 255)
        throw new BytecodecError(
          "BASE45_INVALID_CHUNK",
          `Invalid base45 chunk at index ${stringOffset}`
        );
      bytes[byteOffset++] = value2;
      stringOffset += 2;
      continue;
    }
    const digit2 = toBase45Digit(base45String, stringOffset + 2);
    const value = digit0 + digit1 * 45 + digit2 * 2025;
    if (value > 65535)
      throw new BytecodecError(
        "BASE45_INVALID_CHUNK",
        `Invalid base45 chunk at index ${stringOffset}`
      );
    bytes[byteOffset++] = value >>> 8;
    bytes[byteOffset++] = value & 255;
    stringOffset += 3;
  }
  return bytes;
}
function toBase45Digit(base45String, stringOffset) {
  const code = base45String.charCodeAt(stringOffset);
  const digit = code < 128 ? BASE45_VALUES[code] : -1;
  if (digit === -1)
    throw new BytecodecError(
      "BASE45_INVALID_CHARACTER",
      `Invalid base45 character at index ${stringOffset}`
    );
  return digit;
}
function toBase45String(bytes) {
  const view = toUint8Array(bytes);
  let base45String = "";
  for (let offset = 0; offset + 1 < view.length; offset += 2) {
    let value = view[offset] * 256 + view[offset + 1];
    base45String += BASE45_CHARS[value % 45];
    value = Math.floor(value / 45);
    base45String += BASE45_CHARS[value % 45];
    base45String += BASE45_CHARS[Math.floor(value / 45)];
  }
  if (view.length % 2 === 1) {
    const value = view[view.length - 1];
    base45String += BASE45_CHARS[value % 45];
    base45String += BASE45_CHARS[Math.floor(value / 45)];
  }
  return base45String;
}
function fromBase58String(base58String) {
  if (typeof base58String !== "string")
    throw new BytecodecError(
      "BASE58_INPUT_EXPECTED",
      "fromBase58String expects a string input"
    );
  if (base58String.length === 0) return new Uint8Array(0);
  let zeroCount = 0;
  while (zeroCount < base58String.length && base58String.charCodeAt(zeroCount) === 49)
    zeroCount++;
  const bytes = [];
  for (let stringOffset = 0; stringOffset < base58String.length; stringOffset++) {
    const code = base58String.charCodeAt(stringOffset);
    const digit = code < 128 ? BASE58BTC_VALUES[code] : -1;
    if (digit === -1)
      throw new BytecodecError(
        "BASE58_INVALID_CHARACTER",
        `Invalid base58 character at index ${stringOffset}`
      );
    let carry = digit;
    for (let byteOffset = 0; byteOffset < bytes.length; byteOffset++) {
      carry += bytes[byteOffset] * 58;
      bytes[byteOffset] = carry & 255;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 255);
      carry >>= 8;
    }
  }
  const decoded = new Uint8Array(zeroCount + bytes.length);
  for (let index = 0; index < bytes.length; index++) {
    decoded[decoded.length - 1 - index] = bytes[index];
  }
  return decoded;
}
function toBase58String(bytes) {
  const view = toUint8Array(bytes);
  if (view.length === 0) return "";
  let zeroCount = 0;
  while (zeroCount < view.length && view[zeroCount] === 0) zeroCount++;
  const digits = [];
  for (const value of view) {
    let carry = value;
    for (let index = 0; index < digits.length; index++) {
      carry += digits[index] << 8;
      digits[index] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let base58String = "1".repeat(zeroCount);
  for (let index = digits.length - 1; index >= 0; index--) {
    base58String += BASE58BTC_CHARS[digits[index]];
  }
  return base58String;
}
function fromBase58BtcString(base58BtcString) {
  if (typeof base58BtcString !== "string")
    throw new BytecodecError(
      "BASE58BTC_INPUT_EXPECTED",
      "fromBase58BtcString expects a string input"
    );
  if (!base58BtcString.startsWith(BASE58BTC_PREFIX))
    throw new BytecodecError(
      "BASE58BTC_INVALID_PREFIX",
      'base58btc string must start with the multibase prefix "z"'
    );
  return fromBase58String(base58BtcString.slice(1));
}
function toBase58BtcString(bytes) {
  return BASE58BTC_PREFIX + toBase58String(bytes);
}
function fromBase64String(base64String) {
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function")
    return new Uint8Array(Buffer.from(base64String, "base64"));
  if (typeof atob !== "function")
    throw new BytecodecError(
      "BASE64_DECODER_UNAVAILABLE",
      "No base64 decoder available in this environment."
    );
  const binaryString = atob(base64String);
  const bytes = new Uint8Array(binaryString.length);
  for (let index = 0; index < binaryString.length; index++)
    bytes[index] = binaryString.charCodeAt(index);
  return bytes;
}
function toBase64String(bytes) {
  const view = toUint8Array(bytes);
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function")
    return Buffer.from(view).toString("base64");
  let binaryString = "";
  const chunkSize = 32768;
  for (let offset = 0; offset < view.length; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, view.length);
    let chunkString = "";
    for (let index = offset; index < end; index++) {
      chunkString += String.fromCharCode(view[index]);
    }
    binaryString += chunkString;
  }
  if (typeof btoa !== "function")
    throw new BytecodecError(
      "BASE64_ENCODER_UNAVAILABLE",
      "No base64 encoder available in this environment."
    );
  return btoa(binaryString);
}
function fromBase64UrlString(base64UrlString) {
  const base64String = toBase64String2(base64UrlString);
  return fromBase64String(base64String);
}
function toBase64String2(base64UrlString) {
  let base64String = base64UrlString.replace(/-/g, "+").replace(/_/g, "/");
  const mod = base64String.length & 3;
  if (mod === 2) base64String += "==";
  else if (mod === 3) base64String += "=";
  else if (mod !== 0)
    throw new BytecodecError(
      "BASE64URL_INVALID_LENGTH",
      "Invalid base64url length"
    );
  return base64String;
}
function toBase64UrlString(bytes) {
  const base64 = toBase64String(bytes);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromHex(hex) {
  if (typeof hex !== "string")
    throw new BytecodecError(
      "HEX_INPUT_EXPECTED",
      "fromHex expects a string input"
    );
  if (hex.length % 2 !== 0)
    throw new BytecodecError(
      "HEX_INVALID_LENGTH",
      "Hex string must have an even length"
    );
  const bytes = new Uint8Array(hex.length / 2);
  for (let offset = 0; offset < hex.length; offset += 2) {
    const highCode = hex.charCodeAt(offset);
    const lowCode = hex.charCodeAt(offset + 1);
    const highNibble = highCode < 128 ? HEX_VALUES[highCode] : -1;
    const lowNibble = lowCode < 128 ? HEX_VALUES[lowCode] : -1;
    if (highNibble === -1 || lowNibble === -1)
      throw new BytecodecError(
        "HEX_INVALID_CHARACTER",
        `Invalid hex character at index ${highNibble === -1 ? offset : offset + 1}`
      );
    bytes[offset / 2] = highNibble << 4 | lowNibble;
  }
  return bytes;
}
function toHex(bytes) {
  const view = toUint8Array(bytes);
  let hex = "";
  for (let index = 0; index < view.length; index++) {
    hex += HEX_PAIRS[view[index]];
  }
  return hex;
}
function fromZ85String(z85String) {
  if (typeof z85String !== "string")
    throw new BytecodecError(
      "Z85_INPUT_EXPECTED",
      "fromZ85String expects a string input"
    );
  if (z85String.length % 5 !== 0)
    throw new BytecodecError(
      "Z85_INVALID_LENGTH",
      "Z85 string length must be divisible by 5"
    );
  const bytes = new Uint8Array(z85String.length / 5 * 4);
  let byteOffset = 0;
  for (let blockOffset = 0; blockOffset < z85String.length; blockOffset += 5) {
    let value = 0;
    for (let digitOffset = 0; digitOffset < 5; digitOffset++) {
      const stringOffset = blockOffset + digitOffset;
      const code = z85String.charCodeAt(stringOffset);
      const digit = code < 128 ? Z85_VALUES[code] : -1;
      if (digit === -1)
        throw new BytecodecError(
          "Z85_INVALID_CHARACTER",
          `Invalid Z85 character at index ${stringOffset}`
        );
      value = value * 85 + digit;
    }
    if (value > 4294967295)
      throw new BytecodecError(
        "Z85_INVALID_BLOCK",
        `Invalid Z85 block at index ${blockOffset}`
      );
    bytes[byteOffset++] = value >>> 24;
    bytes[byteOffset++] = value >>> 16 & 255;
    bytes[byteOffset++] = value >>> 8 & 255;
    bytes[byteOffset++] = value & 255;
  }
  return bytes;
}
function toZ85String(bytes) {
  const view = toUint8Array(bytes);
  if (view.length % 4 !== 0)
    throw new BytecodecError(
      "Z85_INVALID_LENGTH",
      "Z85 input length must be divisible by 4"
    );
  let z85String = "";
  for (let offset = 0; offset < view.length; offset += 4) {
    let value = ((view[offset] * 256 + view[offset + 1]) * 256 + view[offset + 2]) * 256 + view[offset + 3];
    const block = new Array(5);
    for (let index = 4; index >= 0; index--) {
      block[index] = Z85_CHARS[value % 85];
      value = Math.floor(value / 85);
    }
    z85String += block.join("");
  }
  return z85String;
}
function fromString(text) {
  if (typeof text !== "string")
    throw new BytecodecError(
      "STRING_INPUT_EXPECTED",
      "fromString expects a string input"
    );
  if (textEncoder) return textEncoder.encode(text);
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function")
    return new Uint8Array(Buffer.from(text, "utf8"));
  throw new BytecodecError(
    "UTF8_ENCODER_UNAVAILABLE",
    "No UTF-8 encoder available in this environment."
  );
}
function toString(bytes) {
  const view = toUint8Array(bytes);
  if (textDecoder) return textDecoder.decode(view);
  if (typeof Buffer !== "undefined" && typeof Buffer.from === "function")
    return Buffer.from(view).toString("utf8");
  throw new BytecodecError(
    "UTF8_DECODER_UNAVAILABLE",
    "No UTF-8 decoder available in this environment."
  );
}
function toUint8Array(input) {
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input.slice(0));
  }
  if (typeof SharedArrayBuffer !== "undefined" && input instanceof SharedArrayBuffer) {
    return new Uint8Array(input).slice();
  }
  if (ArrayBuffer.isView(input)) {
    const view = new Uint8Array(
      input.buffer,
      input.byteOffset,
      input.byteLength
    );
    return new Uint8Array(view);
  }
  if (Array.isArray(input)) {
    return new Uint8Array(input);
  }
  throw new BytecodecError(
    "BYTE_SOURCE_EXPECTED",
    "Expected a Uint8Array, ArrayBuffer, SharedArrayBuffer, ArrayBufferView, or number[]"
  );
}
function fromBigInt(value) {
  if (typeof value !== "bigint")
    throw new BytecodecError(
      "BIGINT_INPUT_EXPECTED",
      "fromBigInt expects a bigint input"
    );
  if (value < 0n)
    throw new BytecodecError(
      "BIGINT_UNSIGNED_EXPECTED",
      "fromBigInt expects an unsigned bigint"
    );
  if (value === 0n) return new Uint8Array();
  const bytes = [];
  while (value > 0n) {
    bytes.push(Number(value & 0xffn));
    value >>= 8n;
  }
  bytes.reverse();
  return toUint8Array(bytes);
}
function toBigInt(bytes) {
  const view = toUint8Array(bytes);
  let value = 0n;
  for (const byte of view) value = value << 8n | BigInt(byte);
  return value;
}
function fromJSON(value) {
  try {
    return fromString(JSON.stringify(value));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new BytecodecError(
      "JSON_STRINGIFY_FAILED",
      `fromJSON failed to stringify value: ${message}`
    );
  }
}
function toJSON(input) {
  const jsonString = typeof input === "string" ? input : toString(input);
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new BytecodecError(
      "JSON_PARSE_FAILED",
      `toJSON failed to parse value: ${message}`
    );
  }
}
async function toCompressed(bytes) {
  const view = toUint8Array(bytes);
  if (isNodeRuntime()) {
    const { gzip } = await importNodeBuiltin("node:zlib");
    const { promisify } = await importNodeBuiltin("node:util");
    const gzipAsync = promisify(gzip);
    const compressed = await gzipAsync(view);
    return toUint8Array(compressed);
  }
  if (typeof CompressionStream === "undefined")
    throw new BytecodecError(
      "GZIP_COMPRESSION_UNAVAILABLE",
      "gzip compression not available in this environment."
    );
  return compressWithStream(view, "gzip");
}
async function compressWithStream(bytes, format) {
  const compressedStream = new Blob([toBufferSource(bytes)]).stream().pipeThrough(new CompressionStream(format));
  const arrayBuffer = await new Response(compressedStream).arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
async function fromCompressed(bytes) {
  const view = toUint8Array(bytes);
  if (isNodeRuntime()) {
    const { gunzip } = await importNodeBuiltin("node:zlib");
    const { promisify } = await importNodeBuiltin("node:util");
    const gunzipAsync = promisify(gunzip);
    const decompressed = await gunzipAsync(view);
    return toUint8Array(decompressed);
  }
  if (typeof DecompressionStream === "undefined")
    throw new BytecodecError(
      "GZIP_DECOMPRESSION_UNAVAILABLE",
      "gzip decompression not available in this environment."
    );
  return decompressWithStream(view, "gzip");
}
async function decompressWithStream(bytes, format) {
  const decompressedStream = new Blob([toBufferSource(bytes)]).stream().pipeThrough(new DecompressionStream(format));
  const arrayBuffer = await new Response(decompressedStream).arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
function toBufferSource(bytes) {
  return toUint8Array(bytes);
}
function toArrayBuffer(bytes) {
  if (bytes instanceof ArrayBuffer) return bytes.slice(0);
  if (typeof SharedArrayBuffer !== "undefined" && bytes instanceof SharedArrayBuffer) {
    return new Uint8Array(bytes).slice().buffer;
  }
  if (ArrayBuffer.isView(bytes)) {
    const view = new Uint8Array(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength
    );
    return isSharedArrayBuffer(view.buffer) ? view.slice().buffer : view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
  }
  if (Array.isArray(bytes)) return new Uint8Array(bytes).buffer;
  throw new BytecodecError(
    "BYTE_SOURCE_EXPECTED",
    "Expected a Uint8Array, ArrayBuffer, SharedArrayBuffer, ArrayBufferView, or number[]"
  );
}
function concat(sources) {
  if (!Array.isArray(sources))
    throw new BytecodecError(
      "CONCAT_INVALID_INPUT",
      "concat expects an array of ByteSource items"
    );
  if (sources.length === 0) return new Uint8Array(0);
  const arrays = sources.map((source, index) => {
    try {
      return toUint8Array(source);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BytecodecError(
        "CONCAT_NORMALIZE_FAILED",
        `concat failed to normalize input at index ${index}: ${message}`
      );
    }
  });
  const totalLength = arrays.reduce((sum, array) => sum + array.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const array of arrays) {
    if (array.length === 0) continue;
    result.set(array, offset);
    offset += array.length;
  }
  return result;
}
function equals(x, y) {
  const a = toUint8Array(x);
  const b = toUint8Array(y);
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) diff |= a[index] ^ b[index];
  return diff === 0;
}
var Bytes = class {
  /**
   * See {@link fromBase45String}.
   */
  static fromBase45String(base45String) {
    return fromBase45String(base45String);
  }
  /**
   * See {@link toBase45String}.
   */
  static toBase45String(bytes) {
    return toBase45String(bytes);
  }
  /**
   * See {@link fromBase58String}.
   */
  static fromBase58String(base58String) {
    return fromBase58String(base58String);
  }
  /**
   * See {@link toBase58String}.
   */
  static toBase58String(bytes) {
    return toBase58String(bytes);
  }
  /**
   * See {@link fromBase58BtcString}.
   */
  static fromBase58BtcString(base58BtcString) {
    return fromBase58BtcString(base58BtcString);
  }
  /**
   * See {@link toBase58BtcString}.
   */
  static toBase58BtcString(bytes) {
    return toBase58BtcString(bytes);
  }
  /**
   * See {@link fromBase64String}.
   */
  static fromBase64String(base64String) {
    return fromBase64String(base64String);
  }
  /**
   * See {@link toBase64String}.
   */
  static toBase64String(bytes) {
    return toBase64String(bytes);
  }
  /**
   * See {@link fromBase64UrlString}.
   */
  static fromBase64UrlString(base64UrlString) {
    return fromBase64UrlString(base64UrlString);
  }
  /**
   * See {@link toBase64UrlString}.
   */
  static toBase64UrlString(bytes) {
    return toBase64UrlString(bytes);
  }
  /**
   * See {@link fromHex}.
   */
  static fromHex(hex) {
    return fromHex(hex);
  }
  /**
   * See {@link toHex}.
   */
  static toHex(bytes) {
    return toHex(bytes);
  }
  /**
   * See {@link fromZ85String}.
   */
  static fromZ85String(z85String) {
    return fromZ85String(z85String);
  }
  /**
   * See {@link toZ85String}.
   */
  static toZ85String(bytes) {
    return toZ85String(bytes);
  }
  /**
   * See {@link fromString}.
   */
  static fromString(text) {
    return fromString(text);
  }
  /**
   * See {@link toString}.
   */
  static toString(bytes) {
    return toString(bytes);
  }
  /**
   * See {@link fromBigInt}.
   */
  static fromBigInt(value) {
    return fromBigInt(value);
  }
  /**
   * See {@link toBigInt}.
   */
  static toBigInt(bytes) {
    return toBigInt(bytes);
  }
  /**
   * See {@link toJSON}.
   */
  static toJSON(bytes) {
    return toJSON(bytes);
  }
  /**
   * See {@link fromJSON}.
   */
  static fromJSON(value) {
    return fromJSON(value);
  }
  /**
   * See {@link toCompressed}.
   */
  static toCompressed(bytes) {
    return toCompressed(bytes);
  }
  /**
   * See {@link fromCompressed}.
   */
  static fromCompressed(bytes) {
    return fromCompressed(bytes);
  }
  /**
   * See {@link toBufferSource}.
   */
  static toBufferSource(bytes) {
    return toBufferSource(bytes);
  }
  /**
   * See {@link toArrayBuffer}.
   */
  static toArrayBuffer(bytes) {
    return toArrayBuffer(bytes);
  }
  /**
   * See {@link toUint8Array}.
   */
  static toUint8Array(bytes) {
    return toUint8Array(bytes);
  }
  /**
   * See {@link concat}.
   */
  static concat(sources) {
    return concat(sources);
  }
  /**
   * See {@link equals}.
   */
  static equals(a, b) {
    return equals(a, b);
  }
};

// dist/index.js
var CRSetError = class extends Error {
  /**
   * The semantic error code for the failure.
   */
  code;
  /**
   * Creates a typed CRSet error.
   *
   * @param code - The semantic error code.
   * @param message - Optional human-readable detail.
   */
  constructor(code, message) {
    const detail = message ?? code;
    super(`{@sovereignbase/convergent-replicated-set} ${detail}`);
    this.code = code;
    this.name = "CRSetError";
  }
};
var CRSet = class {
  /**
   * Creates a convergent replicated set from an optional serializable snapshot.
   *
   * @param snapshot - A previously emitted CRSet snapshot.
   */
  constructor(snapshot) {
    Object.defineProperties(this, {
      state: {
        value: __create(snapshot),
        enumerable: false,
        configurable: false,
        writable: false
      },
      eventTarget: {
        value: new EventTarget(),
        enumerable: false,
        configurable: false,
        writable: false
      }
    });
  }
  /**
   * The current number of live values.
   */
  get size() {
    return this.state.values.size;
  }
  /**
   * Adds a value to the replicated set.
   *
   * The value's content key is derived from its current canonical MessagePack
   * encoding. If that key is already visible, the operation is a no-op.
   * Successful additions emit `delta` and `change` events.
   *
   * @param value - Value to add.
   * @throws {CRSetError} Thrown when the value cannot be encoded.
   * @throws {CRSetError} Thrown when the value cannot be cloned into replica
   * state.
   */
  add(value) {
    const hash = this.valueToKey(value);
    if (this.state.values.has(hash)) return;
    let result;
    try {
      result = __update(hash, value, this.state);
    } catch {
      throw new CRSetError(
        "VALUE_NOT_CLONEABLE",
        "Failed to execute 'add' on 'CRSet': The value could not be cloned."
      );
    }
    void this.eventTarget.dispatchEvent(
      new CustomEvent("delta", { detail: result.delta })
    );
    void this.eventTarget.dispatchEvent(
      new CustomEvent("change", { detail: result.change })
    );
  }
  /**
   * Checks whether a value is currently visible in the replicated set.
   *
   * @param value - Value to check.
   * @returns `true` when the value's current content key is visible.
   * @throws {CRSetError} Thrown when the value cannot be encoded.
   */
  has(value) {
    return this.state.values.has(this.valueToKey(value));
  }
  /**
   * Deletes a value from the replicated set.
   *
   * The value's content key is derived from its current canonical MessagePack
   * encoding. If that key is not visible, the operation is a no-op. Successful
   * deletions emit `delta` and `change` events.
   *
   * @param value - Value to delete.
   * @throws {CRSetError} Thrown when the value cannot be encoded.
   */
  delete(value) {
    const result = __delete(this.state, this.valueToKey(value));
    if (!result) return;
    void this.eventTarget.dispatchEvent(
      new CustomEvent("delta", { detail: result.delta })
    );
    void this.eventTarget.dispatchEvent(
      new CustomEvent("change", { detail: result.change })
    );
  }
  /**
   * Deletes every visible value.
   *
   * Successful clears emit `delta` and `change` events.
   */
  clear() {
    const result = __delete(this.state);
    if (!result) return;
    void this.eventTarget.dispatchEvent(
      new CustomEvent("delta", { detail: result.delta })
    );
    void this.eventTarget.dispatchEvent(
      new CustomEvent("change", { detail: result.change })
    );
  }
  /**
   * Returns detached copies of the current live values.
   *
   * @returns The current values in replica iteration order.
   */
  values() {
    return Array.from(
      this.state.values.values(),
      (entry) => structuredClone(entry.value.value)
    );
  }
  /**
   * Applies a remote or local delta to the replica state.
   *
   * Accepted remote changes may emit `change`; dominated incoming state may
   * emit a reply `delta`.
   *
   * @param delta - The partial serialized set state to merge.
   */
  merge(delta) {
    const result = __merge(delta, this.state);
    if (!result) return;
    if ((result.delta.values?.length ?? 0) + (result.delta.tombstones?.length ?? 0) > 0) {
      void this.eventTarget.dispatchEvent(
        new CustomEvent("delta", { detail: result.delta })
      );
    }
    if (Object.keys(result.change).length > 0) {
      void this.eventTarget.dispatchEvent(
        new CustomEvent("change", { detail: result.change })
      );
    }
  }
  /**
   * Emits the current acknowledgement frontier.
   *
   * Acknowledgement frontiers are used by peers to decide when tombstones can
   * be garbage collected.
   */
  acknowledge() {
    const ack = __acknowledge(this.state);
    if (!ack) return;
    void this.eventTarget.dispatchEvent(
      new CustomEvent("ack", { detail: ack })
    );
  }
  /**
   * Removes tombstones that every provided frontier has acknowledged.
   *
   * @param frontiers - Replica acknowledgement frontiers.
   */
  garbageCollect(frontiers) {
    void __garbageCollect(frontiers, this.state);
  }
  /**
   * Emits the current serializable set snapshot.
   */
  snapshot() {
    const snapshot = __snapshot(this.state);
    void this.eventTarget.dispatchEvent(
      new CustomEvent("snapshot", { detail: snapshot })
    );
  }
  /**
   * Registers an event listener.
   *
   * @param type - The event type to listen for.
   * @param listener - The listener to register.
   * @param options - Listener registration options.
   */
  addEventListener(type, listener, options) {
    void this.eventTarget.addEventListener(type, listener, options);
  }
  /**
   * Removes an event listener.
   *
   * @param type - The event type to stop listening for.
   * @param listener - The listener to remove.
   * @param options - Listener removal options.
   */
  removeEventListener(type, listener, options) {
    void this.eventTarget.removeEventListener(type, listener, options);
  }
  /**
   * Returns a serializable snapshot representation of this set.
   *
   * Called automatically by `JSON.stringify`.
   */
  toJSON() {
    return __snapshot(this.state);
  }
  /**
   * Attempts to return this set as a JSON string.
   */
  toString() {
    return JSON.stringify(this);
  }
  /**
   * Returns the Node.js console inspection representation.
   */
  [/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")]() {
    return this.toJSON();
  }
  /**
   * Returns the Deno console inspection representation.
   */
  [/* @__PURE__ */ Symbol.for("Deno.customInspect")]() {
    return this.toJSON();
  }
  /**
   * Iterates over detached copies of the current live values.
   */
  *[Symbol.iterator]() {
    for (const entry of this.state.values.values()) {
      yield structuredClone(entry.value.value);
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
  forEach(callback, thisArg) {
    for (const value of this.values()) {
      callback.call(thisArg, value, this);
    }
  }
  /**
   * Derives the CRMap key for a set value.
   *
   * @param value - Value to encode.
   * @returns The Base64URL-encoded SHA-256 digest of the canonical MessagePack
   * bytes.
   * @throws {CRSetError} Thrown when the value cannot be encoded.
   */
  valueToKey(value) {
    let bytes;
    try {
      bytes = encode(value, { sortKeys: true });
    } catch {
      throw new CRSetError(
        "VALUE_NOT_ENCODABLE",
        "Failed to encode 'CRSet' value: The value could not be encoded as canonical MessagePack."
      );
    }
    return Bytes.toBase64UrlString(sha256(bytes));
  }
};

// node_modules/@sovereignbase/dragonwatch/dist/index.js
function raiseDragged(dragged) {
  const restoredStyle = {
    position: dragged.style.position,
    transform: dragged.style.transform,
    transition: dragged.style.transition,
    zIndex: dragged.style.zIndex
  };
  if (dragged.ownerDocument.defaultView?.getComputedStyle(dragged).position === "static")
    dragged.style.position = "relative";
  dragged.style.zIndex = "2147483647";
  return restoredStyle;
}
function restoreDraggedStyle(dragged, restoredStyle) {
  dragged.style.position = restoredStyle.position;
  dragged.style.transform = restoredStyle.transform;
  dragged.style.transition = restoredStyle.transition;
  dragged.style.zIndex = restoredStyle.zIndex;
}
function intersects(a, b) {
  const ar = a.getBoundingClientRect();
  const br = b.getBoundingClientRect();
  return !(ar.right < br.left || ar.left > br.right || ar.bottom < br.top || ar.top > br.bottom);
}
function moveDraggedToOffset(dragged, x, y) {
  dragged.dataset.x = String(x);
  dragged.dataset.y = String(y);
  dragged.style.transform = `translate(${x}px, ${y}px)`;
}
function drag(pointerEvent, onIntersectingStart, onIntersectingStop, onMove) {
  const target = pointerEvent.target;
  if (!(target instanceof HTMLElement)) return;
  const ownerDocument = target.ownerDocument;
  const restoredStyle = raiseDragged(target);
  const userSelect = ownerDocument.body.style.userSelect;
  let watcher;
  let intersecting = false;
  const closestWatcher = (event) => {
    const elements = target.ownerDocument.elementsFromPoint(
      event.clientX,
      event.clientY
    );
    for (const element of elements) {
      if (element instanceof HTMLElement && element !== target) {
        if (element.dataset.dragonWatches === target.dataset.dragonwatchId)
          return element;
      }
    }
  };
  const move = (event) => {
    if (event.pointerId !== pointerEvent.pointerId) return;
    const x = Number(target.dataset.x ?? 0) + event.movementX;
    const y = Number(target.dataset.y ?? 0) + event.movementY;
    void moveDraggedToOffset(target, x, y);
    void onMove?.(target, { thisEl: target, x, y }, event);
    const nextWatcher = closestWatcher(event);
    const next = nextWatcher ? intersects(target, nextWatcher) : false;
    if (intersecting && (!next || nextWatcher !== watcher) && watcher)
      void onIntersectingStop?.(target, watcher);
    if (next && (!intersecting || nextWatcher !== watcher) && nextWatcher)
      void onIntersectingStart?.(target, nextWatcher);
    watcher = nextWatcher;
    intersecting = next;
  };
  const stop = (event) => {
    if (event.pointerId !== pointerEvent.pointerId) return;
    void ownerDocument.removeEventListener("pointermove", move, true);
    void ownerDocument.removeEventListener("pointerup", stop, true);
    void ownerDocument.removeEventListener("pointercancel", stop, true);
    ownerDocument.body.style.userSelect = userSelect;
    void restoreDraggedStyle(target, {
      ...restoredStyle,
      transform: target.style.transform,
      transition: target.style.transition
    });
    if (target.hasPointerCapture(event.pointerId))
      void target.releasePointerCapture(event.pointerId);
    if (event.target !== target) {
      void target.dispatchEvent(
        new PointerEvent(event.type, { pointerId: event.pointerId })
      );
    }
  };
  ownerDocument.body.style.userSelect = "none";
  void target.setPointerCapture(pointerEvent.pointerId);
  void ownerDocument.addEventListener("pointermove", move, true);
  void ownerDocument.addEventListener("pointerup", stop, true);
  void ownerDocument.addEventListener("pointercancel", stop, true);
}
function startWatch(watcher, elementToWatch) {
  const id = elementToWatch.dataset.dragonwatchId ?? crypto.randomUUID();
  elementToWatch.dataset.dragonwatchId = id;
  watcher.dataset.dragonWatches = id;
}
function stopWatch(watcher, elementToWatch) {
  if (watcher.dataset.dragonWatches === elementToWatch.dataset.dragonwatchId)
    delete watcher.dataset.dragonWatches;
}

// in-browser-testing-libs.ts
var values = [
  { id: "circle", label: "circle", value: "circle" },
  { id: "square", label: "square", value: "square" },
  { id: "triangle", label: "triangle", value: "triangle" },
  { id: "diamond", label: "diamond", value: "diamond" }
];
var demo = document.querySelector("[data-crset-demo]");
var palette = document.querySelector("[data-palette]");
var replicasEl = document.querySelector("[data-replicas]");
var gossipButton = document.querySelector(
  '[data-action="gossip"]'
);
var replicas = createReplicas(2);
var gossiping = false;
if (demo && palette && replicasEl && gossipButton) {
  gossipButton.addEventListener("click", () => void gossip());
  render();
}
function createReplicas(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `replica-${index + 1}`,
    label: `replica ${index + 1}`,
    set: new CRSet()
  }));
}
function render() {
  if (!palette || !replicasEl) return;
  palette.replaceChildren(
    ...values.map(
      (entry) => createShapeButton(entry.id, entry.label, entry.value)
    )
  );
  replicasEl.replaceChildren(...replicas.map(createReplicaCard));
  wireFreeDragging();
  updateStatus();
  document.body.dataset.ready = "true";
}
function createReplicaCard(replica) {
  const card = document.createElement("section");
  card.className = "replica-card";
  card.dataset.replicaId = replica.id;
  card.setAttribute("aria-label", replica.label);
  const heading = document.createElement("div");
  heading.className = "replica-heading";
  const title = document.createElement("h2");
  title.textContent = replica.label;
  const count = document.createElement("span");
  count.className = "replica-count";
  count.textContent = `${replica.set.size} live`;
  heading.append(title, count);
  const snapshot = replica.set.toJSON();
  const stats = document.createElement("p");
  stats.className = "replica-stats";
  stats.textContent = `${snapshot.values.length} values / ${snapshot.tombstones.length} tombstones`;
  card.append(heading, stats);
  return card;
}
function createShapeButton(id, label, value) {
  const tile = document.createElement("button");
  tile.type = "button";
  tile.className = "item-tile";
  tile.dataset.tile = "true";
  tile.dataset.valueId = id;
  tile.dataset.value = value;
  tile.setAttribute("aria-label", label);
  const shape = document.createElement("span");
  shape.className = `shape shape-${value}`;
  shape.setAttribute("aria-hidden", "true");
  tile.append(shape);
  return tile;
}
function wireFreeDragging() {
  for (const tile of document.querySelectorAll("[data-tile]")) {
    if (tile.dataset.dragBound === "true") continue;
    tile.dataset.dragBound = "true";
    tile.addEventListener("pointerdown", (event) => {
      const value = readTileValue(tile);
      if (!value) return;
      detachFromPalette(tile, value);
      const watchers = replicaCards();
      const blockedReplicas = duplicateReplicasFor(tile, value);
      for (const watcher of watchers) startWatch(watcher, tile);
      drag(
        event,
        (_dragged, watcher) => {
          const replicaId = watcher.dataset.replicaId;
          if (replicaId && blockedReplicas.has(replicaId)) {
            watcher.classList.add("is-repelling");
            repelFrom(tile, watcher);
          } else {
            watcher.classList.add("is-targeted");
          }
          syncShapeMembership(tile, blockedReplicas);
        },
        (_dragged, watcher) => {
          watcher.classList.remove("is-targeted", "is-repelling");
          syncShapeMembership(tile, blockedReplicas);
        },
        () => syncShapeMembership(tile, blockedReplicas)
      );
      const stop = () => {
        for (const watcher of watchers) stopWatch(watcher, tile);
        clearTargeting();
        syncShapeMembership(tile, blockedReplicas);
      };
      tile.addEventListener("pointerup", stop, { once: true });
      tile.addEventListener("pointercancel", stop, { once: true });
    });
  }
}
function detachFromPalette(tile, value) {
  if (!palette?.contains(tile)) return;
  const rect = tile.getBoundingClientRect();
  const replacement = createShapeButton(
    tile.dataset.valueId ?? valueId(value),
    tile.getAttribute("aria-label") ?? value,
    value
  );
  tile.replaceWith(replacement);
  tile.dataset.detached = "true";
  tile.style.position = "fixed";
  tile.style.left = `${rect.left}px`;
  tile.style.top = `${rect.top}px`;
  tile.style.width = `${rect.width}px`;
  tile.style.height = `${rect.height}px`;
  tile.style.margin = "0";
  tile.style.transform = "";
  document.body.append(tile);
  wireFreeDragging();
}
function syncShapeMembership(tile, blockedReplicas = /* @__PURE__ */ new Set()) {
  const value = readTileValue(tile);
  if (!value) return;
  for (const replica of replicas) {
    const card = replicaCard(replica.id);
    if (!card) continue;
    const inside = intersects2(tile, card);
    const blocked = blockedReplicas.has(replica.id);
    if (!blocked) {
      if (inside) replica.set.add(value);
      else replica.set.delete(value);
    }
    card.classList.toggle("has-overlap", inside && !blocked);
    card.classList.toggle("is-repelling", inside && blocked);
    updateReplicaCard(replica);
  }
  updateStatus();
}
function duplicateReplicasFor(tile, value) {
  const blocked = /* @__PURE__ */ new Set();
  for (const replica of replicas) {
    const card = replicaCard(replica.id);
    if (card && replica.set.has(value) && !intersects2(tile, card)) {
      blocked.add(replica.id);
    }
  }
  return blocked;
}
function repelFrom(tile, card) {
  const tileRect = tile.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const pushes = [
    { x: cardRect.left - tileRect.right - 8, y: 0 },
    { x: cardRect.right - tileRect.left + 8, y: 0 },
    { x: 0, y: cardRect.top - tileRect.bottom - 8 },
    { x: 0, y: cardRect.bottom - tileRect.top + 8 }
  ];
  const push = pushes.reduce(
    (closest, candidate) => Math.abs(candidate.x) + Math.abs(candidate.y) < Math.abs(closest.x) + Math.abs(closest.y) ? candidate : closest
  );
  const x = Number(tile.dataset.x ?? 0) + push.x;
  const y = Number(tile.dataset.y ?? 0) + push.y;
  const from = tile.style.transform || "none";
  const to = `translate(${x}px, ${y}px)`;
  tile.dataset.x = String(x);
  tile.dataset.y = String(y);
  tile.classList.add("is-repelling");
  tile.style.transform = to;
  void tile.animate([{ transform: from }, { transform: to }], {
    duration: 140,
    easing: "ease-out"
  });
  window.setTimeout(() => tile.classList.remove("is-repelling"), 180);
}
async function gossip() {
  if (gossiping) return;
  gossiping = true;
  gossipButton?.toggleAttribute("disabled", true);
  const snapshots = replicas.map((replica) => ({
    source: replica,
    snapshot: replica.set.toJSON()
  }));
  const deliveries = snapshots.flatMap(
    ({ source, snapshot }) => replicas.filter((target) => target.id !== source.id).map((target) => ({ source, snapshot, target }))
  );
  await Promise.all(
    deliveries.map(async (delivery, index) => {
      await animatePacket(delivery.source.id, delivery.target.id, index);
      delivery.target.set.merge(delivery.snapshot);
      updateReplicaCard(delivery.target);
    })
  );
  gossiping = false;
  gossipButton?.toggleAttribute("disabled", false);
  updateStatus();
}
function animatePacket(sourceId, targetId, index) {
  const source = replicaCard(sourceId);
  const target = replicaCard(targetId);
  if (!source || !target) return Promise.resolve();
  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const packet = document.createElement("span");
  packet.className = "gossip-packet";
  packet.textContent = "delta";
  packet.style.left = `${sourceRect.left + sourceRect.width / 2}px`;
  packet.style.top = `${sourceRect.top + sourceRect.height / 2}px`;
  document.body.append(packet);
  const dx = targetRect.left + targetRect.width / 2 - sourceRect.left - sourceRect.width / 2;
  const dy = targetRect.top + targetRect.height / 2 - sourceRect.top - sourceRect.height / 2;
  const delay = index % Math.max(1, replicas.length - 1) * 70;
  return new Promise((resolve) => {
    window.setTimeout(() => {
      packet.style.transform = `translate(${dx}px, ${dy}px)`;
      packet.style.opacity = "0";
    }, delay);
    window.setTimeout(() => {
      packet.remove();
      resolve();
    }, delay + 520);
  });
}
function updateReplicaCard(replica) {
  const card = replicaCard(replica.id);
  const count = card?.querySelector(".replica-count");
  const stats = card?.querySelector(".replica-stats");
  const snapshot = replica.set.toJSON();
  if (count) count.textContent = `${replica.set.size} live`;
  if (stats) {
    stats.textContent = `${snapshot.values.length} values / ${snapshot.tombstones.length} tombstones`;
  }
}
function updateStatus() {
  if (!demo) return;
  const projections = replicas.map((replica) => projection(replica.set));
  const [first] = projections;
  const converged = first ? projections.every((candidate) => sameMembers(candidate, first)) : true;
  const unionSize = new Set(
    replicas.flatMap((replica) => replica.set.values().map(valueId))
  ).size;
  demo.dataset.converged = String(converged);
  demo.dataset.visible = String(unionSize);
}
function clearTargeting() {
  for (const target of document.querySelectorAll(
    ".is-targeted, .is-repelling, .has-overlap"
  )) {
    target.classList.remove("is-targeted", "is-repelling", "has-overlap");
  }
}
function replicaCards() {
  return Array.from(
    document.querySelectorAll(".replica-card[data-replica-id]")
  );
}
function replicaCard(id) {
  return document.querySelector(
    `.replica-card[data-replica-id="${id}"]`
  ) ?? void 0;
}
function intersects2(left, right) {
  const leftRect = left.getBoundingClientRect();
  const rightRect = right.getBoundingClientRect();
  return !(leftRect.right < rightRect.left || leftRect.left > rightRect.right || leftRect.bottom < rightRect.top || leftRect.top > rightRect.bottom);
}
function readTileValue(tile) {
  const value = tile.dataset.value;
  return isDemoValue(value) ? value : void 0;
}
function projection(set) {
  return new Set(set.values().map(valueId));
}
function valueId(value) {
  return value;
}
function sameMembers(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}
function isDemoValue(value) {
  return value === "circle" || value === "square" || value === "triangle" || value === "diamond";
}
