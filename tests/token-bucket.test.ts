import { describe, expect, test } from "vitest"
import { TokenBucket } from "../src/token-bucket.js"

describe("TokenBucket", () => {
  test("allows a burst up to capacity", () => {
    const bucket = new TokenBucket(5, 2, 0)

    for (let i = 0; i < 5; i++) {
      expect(bucket.tryConsume(0)).toBe(true)
    }

    expect(bucket.tryConsume(0)).toBe(false)
  })

  test("rejects when bucket is empty", () => {
    const bucket = new TokenBucket(2, 2, 0)

    expect(bucket.tryConsume(0)).toBe(true)
    expect(bucket.tryConsume(0)).toBe(true)
    expect(bucket.tryConsume(0)).toBe(false)
  })

  test("refills after time passes", () => {
    const bucket = new TokenBucket(5, 2, 0)

    bucket.tryConsume(0)
    bucket.tryConsume(0)
    bucket.tryConsume(0)
    bucket.tryConsume(0)
    bucket.tryConsume(0)

    expect(bucket.tryConsume(1000)).toBe(true)
    expect(bucket.tryConsume(1000)).toBe(true)
    expect(bucket.tryConsume(1000)).toBe(false)
  })

  test("never exceeds capacity", () => {
    const bucket = new TokenBucket(5, 2, 0)

    expect(bucket.tryConsume(10000)).toBe(true)

    for (let i = 0; i < 4; i++) {
      expect(bucket.tryConsume(10000)).toBe(true)
    }

    expect(bucket.tryConsume(10000)).toBe(false)
  })

  test("rejects invalid configuration", () => {
    expect(() => new TokenBucket(0, 1)).toThrow(RangeError)
    expect(() => new TokenBucket(1, 0)).toThrow(RangeError)
  })
})
