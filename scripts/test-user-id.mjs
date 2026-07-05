/**
 * Anonymous install id — must be a UUID for Supabase session ingest.
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const sandbox = {
  console,
  localStorage: { store: new Map() },
  crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
};
sandbox.localStorage.getItem = (k) => sandbox.localStorage.store.get(k) ?? null;
sandbox.localStorage.setItem = (k, v) => sandbox.localStorage.store.set(k, v);
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "userId.js"), "utf8"), sandbox);

let passed = 0;
let failed = 0;
function assert(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}

const id1 = sandbox.LumenUserId.get();
assert("returns uuid", UUID_RE.test(id1), id1);

const id2 = sandbox.LumenUserId.get();
assert("persists id", id1 === id2);

sandbox.localStorage.setItem("lumenUserId", "not-a-uuid");
const id3 = sandbox.LumenUserId.get();
assert("replaces invalid id", UUID_RE.test(id3) && id3 !== "not-a-uuid", id3);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
