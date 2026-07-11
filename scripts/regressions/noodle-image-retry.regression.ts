import assert from "node:assert/strict";
import {
  generateNoodleImageWithRetry,
  NOODLE_IMAGE_GENERATION_MAX_ATTEMPTS,
} from "../../packages/server/src/services/noodle/noodle-image-retry.js";

let attempts = 0;
const recovered = await generateNoodleImageWithRetry(async () => {
  attempts += 1;
  if (attempts === 1) throw new Error("temporary image provider failure");
  return "generated-image";
});
assert.equal(recovered, "generated-image");
assert.equal(attempts, NOODLE_IMAGE_GENERATION_MAX_ATTEMPTS);

attempts = 0;
await assert.rejects(
  generateNoodleImageWithRetry(async () => {
    attempts += 1;
    throw new Error("persistent image provider failure");
  }),
  /persistent image provider failure/,
);
assert.equal(attempts, NOODLE_IMAGE_GENERATION_MAX_ATTEMPTS);

process.stdout.write("Noodle image retry regression passed.\n");
