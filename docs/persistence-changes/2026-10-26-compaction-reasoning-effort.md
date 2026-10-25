---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-26-compaction-reasoning-effort

English | [中文](2026-10-26-compaction-reasoning-effort.zh.md)

## Summary

Records the reasoning effort explicitly supplied by compaction summary calls.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-10-26-compaction-reasoning-effort
baseline: false
changes:
  - root: "event:compaction/summary"
    previous: "2026-09-16-session-format-v4"
    after: "8cd2f19c03f77ae26dcd90dd62951c19d425a1a88f6695ff51372b7e9c117747"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

Existing V4 compaction/summary events remain valid. The optional field records only an explicitly supplied effort; absence does not mean off or a resolved adapter default. Older readers can ignore it while retaining and replaying the summary and checkpoint.

<a id="verification"></a>
## Verification

pnpm exec vitest run packages/compaction/compaction-basic/tests/compaction-basic.spec.ts: 125 tests passed. pnpm exec vitest run apps/cli/tests/web-agent-presets.e2e.ts -t "compacts minimal history|automatically compacts minimal history": automatic path passed; manual effort assertions passed before a pre-existing Windows pwsh/bash mismatch. pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/reasoning-compaction.snapshot.ts -t "reasoning effort compaction": 4 tests passed.

<a id="dev-note"></a>
## Dev Note

None.
