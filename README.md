# QoreLens

QoreLens tests QoreX capabilities on Diana testnet. The product is a static site. The archived feasibility harness and raw evidence remain in feasibility/ and are excluded from the product build.

Build with npm ci and npm run build, then serve dist/ over HTTPS or on localhost. Use npm run lint, npm run format:check, npm test and npm run test:browser to run the local checks.

Diana probe: `0x05d2c199925e43767b79a6564542de75fa03f0c5`. Deployment transaction: `0x54029f6dca0b82dbde7a5de5325c5ca9bc88914d46cb17276e6ffdefd58ae36a`. See the archived G7 evidence.

Only the native signer signs. A separate EVM-lane account can differ. VERIFIED is produced only by the independent verifier after fixture self-tests, live verification and all tamper controls. The report hash protects integrity. It does not establish attribution.
