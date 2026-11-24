# Frozen distribution notice analysis

The scratch build at tag `v1.0.0` reproduced both frozen JavaScript SHA-256 hashes.
The second build enabled esbuild metafiles without changing either output hash.
See [the inventory](third-party-inventory.json) for individual module paths and byte counts.

| Shipped input | Installed license | Notice in frozen bytes | Repository draft and remaining gap |
| --- | --- | --- | --- |
| `cosmjs-types@0.11.0` | Apache-2.0 | No retained package notice in either JavaScript bundle | Full installed LICENSE added. Confirm how the deployed copies should carry required terms and attribution. |
| `@noble/hashes@2.4.0` | MIT | No retained package notice in either JavaScript bundle | Full installed LICENSE and copyright added. Deployed notice coverage remains open. |
| `@noble/curves@2.4.0` | MIT | Short copyright and license header in both JavaScript bundles | Full installed LICENSE added. Frozen bundles lack the full permission text. |
| `@noble/post-quantum@0.7.1` | MIT | Short copyright and license header in `verifier.js` | Full installed LICENSE added. The verifier lacks the full permission text. |
| `@scure/base@2.4.0` | MIT | Short copyright and license header in `app.js` | Full installed LICENSE added. The application bundle lacks the full permission text. |
| IBM Plex Sans and Mono `5.2.5` | SIL OFL 1.1 | All three WOFF2 files include an IBM copyright and SIL license URL. No license-description record or WOFF2 extended metadata was present. | Full installed OFL text and upstream IBM copyright added. Confirm whether the binary metadata and repository notice together are sufficient for the shipped font files. |
| `public-vectors.json` | Apache-2.0 at the byte-matching QoreSign revision | Transformed fixture data. The frozen archive contains no separate upstream attribution. | Full upstream LICENSE and NOTICE, copyright, source, matching revision, hashes and transformation are recorded. Distribution with the frozen assets remains unresolved. |

The preserved archive has no standalone LICENSE or NOTICE file. The
[repository draft](../THIRD_PARTY_NOTICES.md) documents the installed terms and
the retained font and JavaScript metadata. It does not settle whether the
frozen deployment satisfies all redistribution obligations. A redeploy with
different notice files would replace the frozen distribution and a new build
would change its fingerprint. No redeploy is authorized or performed.
