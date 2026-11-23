Steps 1 to 6 need no wallet. For the full run with QoreX, see README: With QoreX.

# QoreLens guided fresh-profile test

See [With QoreX](README.md#with-qorex-full-run) for the guided-session instructions.

## Which session does an export describe?

Your export is a report of YOUR session. The recorded Session A evidence lives in evidence/; import it with Import report to compare. A verifier-only export shows NOT EXERCISED for wallet rows by design.

## Steps

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
5. **Read recorded Session A.** Import the [original JSON](evidence/rc2-session-a.json)
   and [Markdown](evidence/rc2-session-a.md). Note the difference. Compare **VERIFIED** and **CHAIN-OBSERVED**. Use the
   [transaction explorer](https://dashboard.qorechain.io/explorer/tx/AD56AC8AEAC810C7393C96AD9CD31C55DDDC7ECD3C9C7F96BF6F03D653956E0A)
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
