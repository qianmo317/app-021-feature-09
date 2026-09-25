import { describe, expect, it } from 'vitest'
import { generatePlan, regenerateFrom } from '../src/lib/engine'
import { computeFairness } from '../src/lib/fairness'
import { fairnessCSV, toCSV } from '../src/lib/csv'
import { makeClass } from './helpers'

// ================= 报告口径快照（生成时配置固化） =================

describe('生成口径快照', () => {
  it('生成的每份周次都记录当时的行数/列数/前排数/周数/种子', () => {
    const cls = makeClass({ rows: 5, cols: 8, weeks: 6, seed: 77, frontRows: 2 })
    const plan = generatePlan(cls)
    expect(plan).toHaveLength(6)
    for (const a of plan) {
      expect(a.gen).toMatchObject({ rows: 5, cols: 8, frontRows: 2, weeks: 6, seed: 77 })
      expect(a.gen?.schema).toBe(1)
    }
  })

  it('报告主口径与当前配置一致时不提示偏离', () => {
    const cls = makeClass({ rows: 4, cols: 6, weeks: 4, seed: 3, frontRows: 2 })
    cls.assignments = generatePlan(cls)
    const report = computeFairness(cls)
    expect(report.caliber.currentMatches).toBe(true)
    expect(report.caliber.legacy).toBe(false)
    expect(report.caliber.mixed).toBe(false)
    expect(report.frontRows).toBe(2)
    expect(report.layoutRows).toBe(4)
    expect(report.layoutCols).toBe(6)
  })

  it('配置改过后：旧报告仍按早先那套算法统计，并逐项指出差异', () => {
    const cls = makeClass({ rows: 4, cols: 6, weeks: 4, seed: 3, frontRows: 1 })
    cls.assignments = generatePlan(cls)
    const oldReport = computeFairness(cls)
    const oldVariance = oldReport.variance
    const oldRange = oldReport.frontRowsRange

    // 事后改动配置（模拟 Setup 页未清空历史周次的情况）：排数 4→5、前排 1→2、种子 3→99
    cls.layout = { ...cls.layout, rows: 5 }
    cls.seats = [] // 不重建座位，强制统计只能依赖快照里的布局
    cls.constraints = { ...cls.constraints, frontRows: 2 }
    cls.seed = 99

    const report = computeFairness(cls)
    // 数字仍按生成时口径（4 排 × 6 列、前 1 排）
    expect(report.frontRows).toBe(1)
    expect(report.layoutRows).toBe(4)
    expect(report.layoutCols).toBe(6)
    expect(report.variance).toBeCloseTo(oldVariance, 8)
    expect(report.frontRowsRange).toBe(oldRange)
    // 页面可据此醒目提示
    expect(report.caliber.currentMatches).toBe(false)
    const fields = report.caliber.diffs.map((d) => d.field)
    expect(fields).toEqual(expect.arrayContaining(['rows', 'frontRows', 'seed']))
    const rowsDiff = report.caliber.diffs.find((d) => d.field === 'rows')
    expect(rowsDiff?.oldV).toContain('4')
    expect(rowsDiff?.newV).toContain('5')
  })

  it('分批重生成：旧周保留旧口径、新周用新口径，报告标记混用并逐批列出', () => {
    const cls = makeClass({ rows: 4, cols: 6, weeks: 6, seed: 3, frontRows: 1 })
    cls.assignments = generatePlan(cls)
    // 从第 4 周起用新配置（前排 2）重排
    cls.constraints = { ...cls.constraints, frontRows: 2 }
    cls.assignments = regenerateFrom(cls, 4)
    const report = computeFairness(cls)
    expect(report.caliber.mixed).toBe(true)
    expect(report.caliber.groups).toHaveLength(2)
    expect(report.caliber.groups[0].weeks).toEqual([1, 2, 3])
    expect(report.caliber.groups[0].snap?.frontRows).toBe(1)
    expect(report.caliber.groups[1].weeks).toEqual([4, 5, 6])
    expect(report.caliber.groups[1].snap?.frontRows).toBe(2)
    // 主口径取最早一批
    expect(report.caliber.primary.snap?.frontRows).toBe(1)
  })

  it('旧数据（无 gen 快照）：标记为 legacy 并按当前配置回溯', () => {
    const cls = makeClass({ rows: 3, cols: 4, weeks: 3, seed: 5, frontRows: 1 })
    cls.assignments = generatePlan(cls).map((a) => {
      const { gen: _gen, ...rest } = a
      void _gen
      return rest
    })
    const report = computeFairness(cls)
    expect(report.caliber.legacy).toBe(true)
    expect(report.caliber.primary.legacy).toBe(true)
    expect(report.totalWeeks).toBe(3)
    // 仍能正常出数字（前 1 排每周 4 座 × 3 周 = 12）
    expect(report.rows.reduce((s, r) => s + r.frontRowsCount, 0)).toBe(12)
  })

  it('CSV 头部注释包含口径（行列/前排/周数/种子）与全部指标算法', () => {
    const cls = makeClass({ rows: 3, cols: 4, weeks: 4, seed: 8, frontRows: 2 })
    cls.assignments = generatePlan(cls)
    const csv = toCSV(fairnessCSV(cls, computeFairness(cls)))
    expect(csv).toContain('#')
    expect(csv).toContain('3 排 × 4 列')
    expect(csv).toContain('前 2 排')
    expect(csv).toContain('随机种子：8')
    expect(csv).toContain('前排次数极差')
    expect(csv).toContain('之差的平方和')
    expect(csv).toContain('越小越平')
    expect(csv).toContain('同桌超 2 次的对')
    expect(csv).toContain('平均位置分')
    // 配置改过后导出的 CSV 要能看出用的是早先配置
    cls.constraints = { ...cls.constraints, frontRows: 3 }
    const csv2 = toCSV(fairnessCSV(cls, computeFairness(cls)))
    expect(csv2).toContain('与班级当前配置不一致')
    expect(csv2).toContain('前排数')
  })
})
