// Pure-function unit tests: no server, no DB. Deterministic by construction.
import { describe, it } from "node:test";
import assert from "node:assert";
import { rateLimit, _resetRateLimits, capabilityBand } from "../apps/web/src/server/util.js";
import { sniffVideo } from "../apps/web/src/server/files.js";

describe("rate limiter", () => {
  it("allows up to the limit, then blocks, then recovers", () => {
    _resetRateLimits();
    assert.equal(rateLimit("u", 3, 60000), true);
    assert.equal(rateLimit("u", 3, 60000), true);
    assert.equal(rateLimit("u", 3, 60000), true);
    assert.equal(rateLimit("u", 3, 60000), false);
    assert.equal(rateLimit("other", 3, 60000), true, "buckets are independent");
  });
  it("window expiry restores allowance", async () => {
    _resetRateLimits();
    assert.equal(rateLimit("w", 1, 30), true);
    assert.equal(rateLimit("w", 1, 30), false);
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(rateLimit("w", 1, 30), true);
  });
});

describe("capability bands", () => {
  it("maps levels to bands with honest floor", () => {
    assert.equal(capabilityBand(0), "UNRATED");
    assert.equal(capabilityBand(-5), "UNRATED");
    assert.equal(capabilityBand(8), "FOUNDATIONAL");
    assert.equal(capabilityBand(24), "FOUNDATIONAL");
    assert.equal(capabilityBand(25), "WORKING");
    assert.equal(capabilityBand(50), "INDEPENDENT");
    assert.equal(capabilityBand(75), "ADVANCED");
    assert.equal(capabilityBand(90), "EXPERT");
    assert.equal(capabilityBand(100), "EXPERT");
  });
});

describe("video sniffing", () => {
  it("accepts EBML/webm and ftyp/mp4, rejects everything else", () => {
    const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(100)]);
    const mp4 = Buffer.concat([Buffer.alloc(4), Buffer.from("ftypmp42"), Buffer.alloc(100)]);
    assert.equal(sniffVideo(webm), "video/webm");
    assert.equal(sniffVideo(mp4), "video/mp4");
    assert.equal(sniffVideo(Buffer.from("definitely not video............")), null);
    assert.equal(sniffVideo(Buffer.alloc(3)), null);
    assert.equal(sniffVideo(null), null);
  });
});
