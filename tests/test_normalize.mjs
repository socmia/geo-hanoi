import { foldVi } from "../js/normalize.js";
import assert from "node:assert/strict";

assert.equal(foldVi("Đống Đa"), "dong da");
assert.equal(foldVi("đông anh"), "dong anh");
assert.equal(foldVi("  Hoàn   Kiếm "), "hoan kiem");
assert.equal(foldVi("922"), "922");
assert.ok(foldVi("Phường Đống Đa").includes("dong da"));
console.log("ok");
