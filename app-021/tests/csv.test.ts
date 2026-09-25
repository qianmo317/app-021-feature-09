import { describe, expect, it } from 'vitest'
import { fairnessCSV, toCSV, weeksCSV } from '../src/lib/csv'
import { generatePlan } from '../src/lib/engine'
import { computeFairness } from '../src/lib/fairness'
import { reportConfigOf } from '../src/lib/methodology'
import { makeClass } from './helpers'

describe('CSV 导出', () => {
  it('带 BOM 且正确转义逗号/引号/换行', () => {
    const csv = toCSV([['姓名', '备注'], ['张三', '爱说话,需关注'], ['李"四', '多行\n备注']])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('"爱说话,需关注"')
    expect(csv).toContain('"李""四"')
    expect(csv).toContain('"多行\n备注"')
  })

  it('公平性统计表：表头注释带指标定义/算法/配置，数据结构完整', () => {
    const cls = makeClass({ rows: 3, cols: 4, weeks: 4, seed: 8 })
    cls.assignments = generatePlan(cls)
    const report = computeFairness(cls)
    const f = fairnessCSV(cls, report)

    // 表头注释：以「# 」开头的说明行，含所用配置与每项指标的定义/算法/解读
    const commentRows = f.filter((r) => typeof r[0] === 'string' && r[0].startsWith('# '))
    expect(commentRows).toHaveLength(3 + 9) // 3 行配置说明 + 9 项指标
    const comments = commentRows.map((r) => String(r[0])).join('\n')
    expect(comments).toContain('3 行 × 4 列 · 前 3 排 · 4 周 · 种子 8')
    expect(comments).toContain('指标·前 3 排次数')
    expect(comments).toContain('指标·平均位置分')
    expect(comments).toContain('指标·位置分 Σ偏差²')
    expect(comments).toContain('指标·同桌超 2 次的对')
    expect(comments).toContain('越小越公平')
    // 未经 store 生成的数据没有配置快照，注释如实说明
    expect(comments).toContain('未记录')

    // 数据区：班级/周数/表头 + 12 行学生 + 空行收尾（本例无同桌超限对附加行）
    const headIdx = f.findIndex((r) => r[0] === '姓名')
    expect(f[headIdx - 2][0]).toContain(cls.name)
    expect(f[headIdx - 1][0]).toContain('统计周数')
    expect(f[headIdx]).toHaveLength(12) // 表头列数
    expect(f.slice(headIdx + 1, headIdx + 13)).toHaveLength(12)
    expect(f[headIdx + 13]).toHaveLength(0)
    expect(f).toHaveLength(headIdx + 14)

    const w = weeksCSV(cls)
    expect(w.length).toBeGreaterThan(cls.assignments.length)
    // 每周都有 12 个座位记录
    for (let week = 1; week <= 4; week++) {
      expect(w.filter((r) => r[0] === week)).toHaveLength(12)
    }
  })

  it('配置变更后导出的 CSV 能看出数据出自早先那套口径', () => {
    const cls = makeClass({ rows: 5, cols: 8, weeks: 4, seed: 42 })
    cls.assignments = generatePlan(cls)
    cls.genConfig = reportConfigOf(cls) // 生成时记录的快照
    // 之后修改配置（前排 3 → 2，换种子）
    cls.constraints = { ...cls.constraints, frontRows: 2 }
    cls.seed = 7
    const f = fairnessCSV(cls, computeFairness(cls))
    const comments = f
      .filter((r) => typeof r[0] === 'string' && r[0].startsWith('# '))
      .map((r) => String(r[0]))
      .join('\n')
    expect(comments).toContain('前 3 排 · 4 周 · 种子 42') // 生成时配置
    expect(comments).toContain('前 2 排 · 4 周 · 种子 7') // 当前配置
    expect(comments).toContain('与当前配置不一致')
    expect(comments).toContain('早先那套配置口径')
  })
})
