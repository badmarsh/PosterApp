const fs = require('fs');
const path = require('path');
const { TextDecoder, TextEncoder } = require('util');

global.PRISMA_WASM_PANIC_REGISTRY = { set_message: () => {} };

const modExports = {};
const imports = { '__wbindgen_placeholder__': modExports };
let wasm;
const cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
let cachedUint8Memory0 = null;
function getUint8Memory0() {
  if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) {
    cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8Memory0;
}
function getStringFromWasm0(ptr, len) {
  return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}
const heap = new Array(128).fill(void 0);
heap.push(void 0, null, true, false);
let heap_next = heap.length;
function addHeapObject(obj) {
  if (heap_next === heap.length) heap.push(heap.length + 1);
  const idx = heap_next;
  heap_next = heap[idx];
  heap[idx] = obj;
  return idx;
}
let WASM_VECTOR_LEN = 0;
const cachedTextEncoder = new TextEncoder('utf-8');
function passStringToWasm0(arg2, malloc, realloc) {
  const buf = cachedTextEncoder.encode(arg2);
  const ptr2 = malloc(buf.length);
  getUint8Memory0().subarray(ptr2, ptr2 + buf.length).set(buf);
  WASM_VECTOR_LEN = buf.length;
  return ptr2;
}
let cachedInt32Memory0 = null;
function getInt32Memory0() {
  if (cachedInt32Memory0 === null || cachedInt32Memory0.byteLength === 0) {
    cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
  }
  return cachedInt32Memory0;
}
function getObject(idx) { return heap[idx]; }
function dropObject(idx) {
  if (idx < 132) return;
  heap[idx] = heap_next;
  heap_next = idx;
}
function takeObject(idx) {
  const ret = getObject(idx);
  dropObject(idx);
  return ret;
}
modExports.__wbindgen_error_new = function(arg0, arg1) {
  const ret = new Error(getStringFromWasm0(arg0, arg1));
  return addHeapObject(ret);
};
modExports.__wbg_setmessage_e113e9fee2d41bd4 = function(arg0, arg1) {};
modExports.__wbindgen_throw = function(arg0, arg1) {
  throw new Error(getStringFromWasm0(arg0, arg1));
};

const wasmPath = path.resolve(__dirname, '../node_modules/.pnpm/prisma@5.0.0/node_modules/prisma/build/prisma_schema_build_bg.wasm');
const bytes = fs.readFileSync(wasmPath);
const wasmModule = new WebAssembly.Module(bytes);
const wasmInstance = new WebAssembly.Instance(wasmModule, imports);
wasm = wasmInstance.exports;

function get_dmmf(params) {
  let ptr1 = 0;
  let len1 = 0;
  try {
    const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
    const ptr0 = passStringToWasm0(params, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    wasm.get_dmmf(retptr, ptr0, len0);
    const r0 = getInt32Memory0()[retptr / 4 + 0];
    const r1 = getInt32Memory0()[retptr / 4 + 1];
    const r2 = getInt32Memory0()[retptr / 4 + 2];
    const r3 = getInt32Memory0()[retptr / 4 + 3];
    ptr1 = r0;
    len1 = r1;
    if (r3) {
      ptr1 = 0;
      len1 = 0;
      throw takeObject(r2);
    }
    return getStringFromWasm0(ptr1, len1);
  } finally {
    wasm.__wbindgen_add_to_stack_pointer(16);
    if (ptr1) wasm.__wbindgen_free(ptr1, len1);
  }
}

const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf8');
const params = JSON.stringify({ prismaSchema: schema, noColor: true });
const dmmf = JSON.parse(get_dmmf(params));

const clientModule = require('@prisma/client/generator-build');
const { externalToInternalDmmf, dmmfToTypes } = clientModule;
const internalDmmf = externalToInternalDmmf(dmmf);
let types = dmmfToTypes(internalDmmf);
types = types.replace("import * as runtime from '/';", "import * as runtime from '@prisma/client/runtime/library';");

const targetPath = path.resolve(__dirname, '../node_modules/.pnpm/@prisma+client@5.0.0_prisma@5.0.0/node_modules/.prisma/client/index.d.ts');
fs.writeFileSync(targetPath, types);
console.log('Successfully generated Prisma TypeScript definitions at:', targetPath, `(${types.length} bytes)`);
