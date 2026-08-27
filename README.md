# ThrottleX — Token Bucket Rate Limiter

A small, focused system project: cap request rate per client fairly, while
still allowing short bursts.

## Problem

Naive rate limiting (fixed window counters) either lets clients burst
way over their allowed rate at window boundaries, or is too strict and
rejects legitimate bursty traffic. Need an algorithm that allows short
bursts up to a cap, then throttles to a sustained average rate.

## Concept

**Token bucket vs leaky bucket**

- **Token bucket**: a bucket holds up to `N` tokens. Tokens refill at a
  fixed rate (`r` tokens/sec). Each request consumes 1 token. If the
  bucket has tokens, the request is allowed and a token is removed. If
  empty, the request is rejected. Because tokens accumulate while idle
  (up to the cap), a client that hasn't made requests in a while can
  burst up to `N` requests instantly.
- **Leaky bucket**: requests fill a queue (the bucket) that drains
  (leaks) at a fixed rate. Output rate is smoothed to exactly the leak
  rate regardless of input burstiness — no bursting allowed, and
  requests queue instead of executing immediately.

Token bucket is chosen as the primary implementation because it
tolerates bursts (more realistic for API clients), while leaky bucket
is built afterward as a comparison extension.

## Build plan

1. **In-memory token bucket** — single process, `Map<clientId, {tokens, lastRefill}>`.
   Prove the algorithm and refill math work before adding network calls.
2. **Redis-backed, atomic** — a Lua script (`EVAL`) that reads the
   current token count and last-refill timestamp, computes the refill,
   checks/decrements, and writes the new state back in one atomic round
   trip. This is the version that ships.

## Explicitly out of scope

- A full API gateway (routing, auth, request transformation, etc.) —
  this is a rate-limiting primitive only, not a gateway.

## Tests

- **Burst allowed** — a client with a full bucket can fire `N` requests
  back-to-back and all succeed.
- **Refill math** — a client firing requests faster than the refill rate
  gets throttled once the bucket empties, and then recovers as time
  passes.
- **Redis forwarding** — the Redis wrapper sends the expected key and
  arguments into the Lua script and parses the reply.
- **TTL / reset behavior** — bucket state correctly expires after a
  period of inactivity.

## Failure mode: Redis unavailable

Decision: **fail closed**.

- *Why:* this project is a protection primitive, so the safer default is
  to stop traffic rather than silently disable the limit when Redis is
  unhealthy.
- *Tradeoff:* a Redis outage can now block legitimate requests.
- *Mitigation:* keep the in-memory `TokenBucket` available as a local
  fallback for development and tests, and consider a circuit breaker in a
  real service integration.

## Extension

- **Leaky-bucket variant** can still be added later for direct
  comparison — same interface, different algorithm, so behavior
  differences (burst vs no-burst) can be demonstrated with the same test
  suite or benchmark.

## What production actually uses instead

- [`redis-cell`](https://github.com/brandur/redis-cell) — a Redis
  module implementing the generic cell rate limiting algorithm (GCRA),
  battle-tested and more efficient than a hand-rolled Lua script.
- Kong / Envoy rate-limit plugins — for gateway-level rate limiting at
  the infrastructure layer rather than in application code.

This project is for understanding the mechanism, not replacing these.

## Stack

Node.js, TypeScript, Redis (Lua via `EVAL`), Docker.

## Scripts

- `npm test` runs the Vitest suite.
- `npm run typecheck` runs `tsc --noEmit`.

## Research

- "token bucket vs leaky bucket rate limiting"
- "redis rate limiter lua script"
