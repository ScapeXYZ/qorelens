Steps 1 to 6 need no wallet. For the full run with QoreX, see README: With QoreX.

# QoreLens guided fresh-profile test

See [With QoreX](README.md#with-qorex-full-run) for the guided-session instructions.

## Which session does an export describe?

Your export is a report of YOUR session. The recorded Session A evidence lives in evidence/; import it with Import report to compare. A verifier-only export shows NOT EXERCISED for wallet rows by design.

## Steps

Allow about five minutes.

Best viewed at desktop widths (1024 px or more). On narrower screens the matrix scrolls horizontally and the Verdict column may need scrolling.

1. **Open hosted QoreLens.** Use a fresh desktop Chrome profile (no local setup is needed). Start a timer and open
   [QoreLens](https://scapexyz.github.io/qorelens/). Expect **Build verified ·
   c0384c3b74aa**. Stop on a mismatch.
2. **Run the verifier.** Click **Run verifier self-test**. Open its evidence
   drawer, check the verdict, and inspect the accepted fixtures and rejected
   controls.
3. **Read Diana.** Click **Read deployed probe**. Open its evidence drawer and
   note the result and its source. Record any failed read and continue.
4. **Try report exchange.** Download JSON and Markdown from **Reports**,
   import each with **Import report**, and check the integrity status. Leave
   **Run guided session** untouched. No wallet extension is required.
5. **Read the recorded demo.** Import the [demo JSON](https://github.com/ScapeXYZ/qorelens/raw/master/evidence/video-session.json)
   or [Markdown](https://github.com/ScapeXYZ/qorelens/raw/master/evidence/video-session.md). Expect an integrity match and the frozen build. Compare with the [screenshots](README.md#screenshots). Note the difference. QoreLens independently verifies only the message signature (**VERIFIED**). The transaction is **CHAIN-OBSERVED**. Use the
   [transaction explorer](https://dashboard.qorechain.io/explorer/tx/5216F3E05807BDEBD8E843E831635FE60316D294FE94DE03690F3C5D520D8DDE)
   and [acceptance manifest](evidence/acceptance-manifest.json) to compare the
   transfer amount and fee.
6. **Record observations.** Stop the timer and complete the form.

| Observation                                            | Notes |
| ------------------------------------------------------ | ----- |
| Time to verified build, first verdict, and completion  |       |
| First confusing label or action, and help needed       |       |
| Interpretation of the imported report and digest       |       |
| Clarity of VERIFIED, CHAIN-OBSERVED, and NOT EXERCISED |       |
| Errors or unexpected prompts                           |       |
