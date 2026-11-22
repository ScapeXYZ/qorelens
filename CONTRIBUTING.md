# Contributing

The frozen release is `v1.0.0`. Keep documentation-only changes separate from
product changes. Read [Security](SECURITY.md) before collecting evidence.

- Use the existing lockfile and exact pins for product development.
- Run the applicable lint, formatting, Node and browser checks before proposing
  product changes.
- Preserve raw reports and RPC responses. Record the release fingerprint and
  label replayed, wallet-reported, and chain-observed evidence accurately.
- Label UI mock data as MOCK. A mock cannot establish acceptance.
- Review the staged diff and scan it for secrets before committing.
