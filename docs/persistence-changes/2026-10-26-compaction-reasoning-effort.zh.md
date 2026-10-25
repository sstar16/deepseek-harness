---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-10-26-compaction-reasoning-effort

[English](2026-10-26-compaction-reasoning-effort.md) | 中文

## 概述

记录压缩摘要调用中显式提供的推理档位。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

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
## 兼容性

现有 V4 compaction/summary 事件仍然有效。可选字段只记录显式提供的档位；字段缺失不表示 off，也不表示适配器已解析的默认值。旧读取方可以忽略该字段，同时保留并回放摘要与检查点。

<a id="verification"></a>
## 验证

pnpm exec vitest run packages/compaction/compaction-basic/tests/compaction-basic.spec.ts：125 个测试通过。pnpm exec vitest run apps/cli/tests/web-agent-presets.e2e.ts -t "compacts minimal history|automatically compacts minimal history"：自动路径通过；手动档位断言在既有 Windows pwsh/bash 差异前通过。pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/reasoning-compaction.snapshot.ts -t "reasoning effort compaction"：4 个测试通过。

<a id="dev-note"></a>
## 开发备注

无。
