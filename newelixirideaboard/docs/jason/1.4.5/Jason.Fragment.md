# `Jason.Fragment`
[🔗](https://github.com/michalmuskala/jason/blob/v1.4.5/lib/fragment.ex#L1)

Provides a way to inject an already-encoded JSON structure into a
to-be-encoded structure in optimized fashion.

This avoids a decoding/encoding round-trip for the subpart.

This feature can be used for caching parts of the JSON, or delegating
the generation of the JSON to a third-party system (e.g. Postgres).

# `new`

---

*Consult [api-reference.md](api-reference.md) for complete listing*
