import { describe, expect, it } from 'vitest'
import {
  configLabel,
  frontThirdRows,
  metricDefs,
  methodologyCommentLines,
  middleColsLabel,
  reportConfigMeta,
  reportConfigOf,
  sameConfig,
} from '../src/lib/methodology'
import { makeClass } from './helpers'

describe('报告口径配置', () => {
  it('configLabel 覆盖行数/列数/前排/周数/种子', () => {
    const cls = makeClass({ rows: 6, cols: 7, frontRows: 2, weeks: 20, seed: 42 })
    expect(configLabel(reportConfigOf(cls))).toBe('6 行 × 7 列 · 前 2 排 · 20 周 · 种子 42')
  })

  it('sameConfig 逐字段比较', () => {
    const a = reportConfigOf(makeClass({}))
    expect(sameConfig(a, { ...a })).toBe(true)
    expect(sameConfig(a, { ...a, seed: a.seed + 1 })).toBe(false)
    expect(sameConfig(a, { ...a, frontRows: a.frontRows + 1 })).toBe(false)
    expect(sameConfig(a, { ...a, rows: a.rows + 1 })).toBe(false)
  })

  it('reportConfigMeta：未记录 → generated 为 null；一致 → 不 stale；变更 → stale', () => {
    const cls = makeClass({ rows: 5, cols: 8, frontRows: 3, weeks: 20, seed: 42 })
    const bare = reportConfigMeta(cls)
    expect(bare.generated).toBeNull()
    expect(bare.stale).toBe(false)

    cls.genConfig = reportConfigOf(cls)
    expect(reportConfigMeta(cls).stale).toBe(false)

    // 生成后改配置（前排 3 → 2、换种子）→ 能看出数据出自早先那套口径
    cls.constraints = { ...cls.constraints, frontRows: 2 }
    cls.seed = 7
    const meta = reportConfigMeta(cls)
    expect(meta.stale).toBe(true)
    expect(meta.generated?.frontRows).toBe(3)
    expect(meta.current.frontRows).toBe(2)
  })
})

describe('指标定义文案（随配置参数化）', () => {
  it('前排次数按配置的 frontRows 计；位置分说明含行/列加权', () => {
    const defs = metricDefs({ rows: 6, cols: 7, frontRows: 2, weeks: 20, seed: 42 })
    const front = defs.find((d) => d.id === 'front-rows')!
    expect(front.name).toBe('前 2 排次数')
    expect(front.definition).toContain('第 1～2 排')
    const score = defs.find((d) => d.id === 'position-score')!
    expect(score.definition).toContain('行权重')
    expect(score.definition).toContain('列权重')
    expect(defs.find((d) => d.id === 'variance')!.reading).toContain('越小越公平')
    expect(defs.find((d) => d.id === 'deskmate')!.definition).toContain('同桌')
  })

  it('前/中/后分段行数与中间列描述随行/列数变化', () => {
    expect(frontThirdRows(6)).toBe(2)
    expect(frontThirdRows(5)).toBe(2) // ⌈5/3⌉
    expect(frontThirdRows(3)).toBe(1)
    expect(middleColsLabel(7)).toBe('第 3～5 列')
    expect(middleColsLabel(8)).toBe('第 3～6 列')
    const defs = metricDefs({ rows: 5, cols: 8, frontRows: 3, weeks: 20, seed: 42 })
    expect(defs.find((d) => d.id === 'middle-col')!.definition).toContain('第 3～6 列')
    expect(defs.find((d) => d.id === 'front-middle-back')!.algorithm).toContain('≤ 2')
  })
})

describe('CSV 表头注释行', () => {
  it('含配置与全部 9 项指标；配置变更后指出数据出自早先口径', () => {
    const cls = makeClass({ rows: 5, cols: 8, frontRows: 3, weeks: 20, seed: 42 })
    const before = methodologyCommentLines(cls)
    expect(before.filter((l) => l.startsWith('指标·'))).toHaveLength(9)
    expect(before.join('\n')).toContain('5 行 × 8 列 · 前 3 排 · 20 周 · 种子 42')
    expect(before.join('\n')).toContain('未记录')
    expect(before.join('\n')).not.toContain('早先')

    cls.genConfig = reportConfigOf(cls)
    cls.constraints = { ...cls.constraints, frontRows: 2 }
    const after = methodologyCommentLines(cls).join('\n')
    expect(after).toContain('与当前配置不一致')
    expect(after).toContain('早先那套配置口径')
    // 指标说明按当前配置口径生成
    expect(after).toContain('指标·前 2 排次数')
  })
})
