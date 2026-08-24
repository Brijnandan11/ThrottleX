import { describe, expect, test } from "vitest"
import { TokenBucket } from "../token-bucket.ts.js"

describe("TokenBucket", () => {
    test("allows a burts up to a capacity", () => {
        const bucket = new TokenBucket(5, 2, 0)

        for (let i = 0; i < 5; i++) {
            expect(bucket.tryConsume(0)).toBe(true)
        }

        expect(bucket.tryConsume(0)).toBe(false)
    })

    test("reject when bucket is empty", () => {
        const bucket = new TokenBucket(2, 2, 0)

        expect(bucket.tryConsume(0)).toBe(true)
        expect(bucket.tryConsume(0)).toBe(true)
        expect(bucket.tryConsume(0)).toBe(false)
    })

    test("refill after time passes", () => {
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

        expect(bucket.tryConsume(10000)).toBe(true);

        for (let i = 0; i < 4; i++) {
            expect(bucket.tryConsume(10000)).toBe(true);
        }

        expect(bucket.tryConsume(10000)).toBe(false);
    })
})