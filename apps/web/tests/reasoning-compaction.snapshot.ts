import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import type { AgentHandle } from '@deepseek-ai/dsh-agent'
import { createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import {
  assertFixtureInventory,
  captureStableAria,
  compareOrRefreshGolden,
  fixtureUserPrompts,
  launchWebScaffold,
  watchConsole,
  webSnapshotMode,
  type WebScaffold,
} from './scaffold.ts'
import { newEnglishPage, saveFailureShot } from './support.ts'

const MODE = webSnapshotMode()

describe('reasoning effort compaction', () => {
  const snapshotDir = fileURLToPath(new URL('../../../snapshots/web/reasoning-compaction', import.meta.url))
  let scaffold: WebScaffold
  let handle: AgentHandle
  let browser: Browser | undefined
  let page: Page | undefined
  const requests: GenerateOptions[] = []

  beforeAll(async () => {
    const fixture = join(snapshotDir, 'session.v4.jsonl')
    const prompts = fixtureUserPrompts(await readFile(fixture, 'utf8'))
    expect(prompts).toHaveLength(2)
    const [initial, continuation] = prompts
    if (initial === undefined || continuation === undefined) {
      throw new Error('reasoning compaction fixture requires an initial prompt and a continuation')
    }
    scaffold = await launchWebScaffold({
      replayFixture: fixture,
      compareReplaySession: true,
      workspacePathLength: 192,
      extraOverlayPath: join(snapshotDir, 'cordis.snapshot.yml'),
      replayProviders: [{
        id: 'deepseek-official',
        name: 'DeepSeek',
        models: [{
          id: 'deepseek-v4-flash',
          name: 'DeepSeek-V4-Flash',
          contextWindow: 128_000,
          reasoningEfforts: ['off', 'max'],
          defaultReasoningEffort: 'off',
        }],
      }],
    })
    scaffold.ctx.on('llm/stream', async function* (options, next) {
      requests.push(options)
      yield* next()
    })
    handle = await scaffold.ctx.agents.create({
      sessionId: SessionId('reasoning-compaction-smoke'),
      meta: { cwd: scaffold.workspaceCwd, agentPreset: 'reasoning-compaction' },
      agentOptions: {
        provider: 'deepseek-official',
        model: 'deepseek-v4-flash',
        reasoningEffort: ReasoningEffortId('max'),
      },
      setup: agentCtx => scaffold.ctx.agentPresets.mount(agentCtx, 'reasoning-compaction').then(() => undefined),
    })
    handle.agent.followup(createUserMessage({
      content: [{ type: 'text', text: initial }], source: { kind: 'user' },
    }))
    await handle.agent.whenIdle()
    const execution = await scaffold.ctx.commands.execute(handle.agent, '/compact', [], new AbortController().signal)
    expect(execution?.result.kind).toBe('success')
    handle.agent.followup(createUserMessage({
      content: [{ type: 'text', text: continuation }], source: { kind: 'user' },
    }))
    await handle.agent.whenIdle()
  })

  afterAll(async () => {
    const failures: unknown[] = []
    await page?.close().catch((error: unknown) => failures.push(error))
    await browser?.close().catch((error: unknown) => failures.push(error))
    await handle?.dispose().catch((error: unknown) => failures.push(error))
    await scaffold?.close().catch((error: unknown) => failures.push(error))
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, 'reasoning compaction teardown failed')
  })

  it('uses the selected reasoning effort in the summary request and durable event', () => {
    const summaryRequest = requests.find(request => request.purpose === 'compaction')
    expect(summaryRequest?.reasoningEffort).toBe('max')
    const summary = handle.agent.session.snapshotEvents().find(event => event.type === 'compaction/summary')
    expect(summary?.data).toMatchObject({ reasoningEffort: 'max', llmStreamCall: true })
  })

  it('continues from the checkpoint with the selected reasoning effort', () => {
    expect(requests.map(request => request.purpose)).toEqual([undefined, 'compaction', undefined])
    const summary = handle.agent.session.snapshotEvents().find(event => event.type === 'compaction/summary')
    if (summary === undefined) throw new Error('reasoning compaction produced no summary')
    const continuation = requests.at(-1)
    expect(continuation?.reasoningEffort).toBe('max')
    expect(continuation?.messages.flatMap(message => message.content)).toEqual(expect.arrayContaining(summary.data.summary))
    expect(handle.agent.session.deriveMessages().at(-1)?.content).toEqual([{ type: 'text', text: 'MINIMAL_COMPACT_OK' }])
  })

  it.skipIf(MODE === 'record')('renders the compaction card and summary', async () => {
    onTestFailed(() => { if (page !== undefined) void saveFailureShot(page, 'web-reasoning-compaction') })
    browser = await chromium.launch()
    page = await newEnglishPage(browser)
    const tripwire = watchConsole(page)
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
    await page.locator('[role="treeitem"]').first().click()
    await page.locator('[role="treeitem"]').nth(1).click()
    await page.getByText('MINIMAL_COMPACT_OK', { exact: true }).waitFor()
    const card = page.getByRole('button', { name: /^compact Compacted / })
    await card.click()
    await expect.poll(() => card.getAttribute('aria-expanded')).toBe('true')
    await compareOrRefreshGolden(join(snapshotDir, 'ui.expected.md'),
      await captureStableAria(page, '[class*="centerCol"]', scaffold.workspaceCwd), MODE)
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
  })

  it('keeps its snapshot inventory closed', async () => {
    await assertFixtureInventory(snapshotDir, [
      'session.v4.jsonl',
      'cordis.snapshot.yml',
      'system-prompt.expected.md',
      'tool-schemas.expected.json',
      'ui.expected.md',
    ])
  })
})
