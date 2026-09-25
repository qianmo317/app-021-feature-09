import type { ClassEntity, ReportConfig } from '../types'
import { middleColSet } from './layout'

// ================= 公平性报告的统计口径说明（§4.4 可解释性） =================
// 本模块是「每个数字怎么定义、怎么算」的唯一事实来源：
// 报告页（Fairness.tsx）与 CSV 导出（csv.ts）共用同一份文案，
// 保证拿出去的报告自带依据，且配置变更后能看出数据出自哪套口径。

// 从班级当前配置提取口径配置
export function reportConfigOf(cls: ClassEntity): ReportConfig {
  return {
    rows: cls.layout.rows,
    cols: cls.layout.cols,
    frontRows: cls.constraints.frontRows,
    weeks: cls.weeks,
    seed: cls.seed,
  }
}

// 「6 行 × 7 列 · 前 2 排 · 20 周 · 种子 42」
export function configLabel(cfg: ReportConfig): string {
  return `${cfg.rows} 行 × ${cfg.cols} 列 · 前 ${cfg.frontRows} 排 · ${cfg.weeks} 周 · 种子 ${cfg.seed}`
}

export function sameConfig(a: ReportConfig, b: ReportConfig): boolean {
  return (
    a.rows === b.rows && a.cols === b.cols && a.frontRows === b.frontRows && a.weeks === b.weeks && a.seed === b.seed
  )
}

export interface ReportConfigMeta {
  current: ReportConfig // 本报告统计计算所用配置
  generated: ReportConfig | null // 轮换结果生成时记录的配置（旧数据可能未记录）
  stale: boolean // 生成后配置又改过 → 数据出自早先那套口径
}

export function reportConfigMeta(cls: ClassEntity): ReportConfigMeta {
  const current = reportConfigOf(cls)
  const generated = cls.genConfig ?? null
  return { current, generated, stale: !!generated && !sameConfig(generated, current) }
}

// 「前/中/后」分段的前（后）段行数：max(1, ⌈行数/3⌉)，与 fairness.ts 一致
export function frontThirdRows(rows: number): number {
  return Math.max(1, Math.ceil(rows / 3))
}

// 中间列的人话描述（1 起始列号），如「第 3～5 列」
export function middleColsLabel(cols: number): string {
  const set = middleColSet({ rows: 2, cols, aisles: [], mode: 'rows', doorSide: 'right' })
  const list = [...set].sort((a, b) => a - b).map((c) => c + 1)
  if (list.length === 0) return '无'
  if (list.length === 1) return `第 ${list[0]} 列`
  return `第 ${list[0]}～${list[list.length - 1]} 列`
}

export interface MetricDef {
  id: string
  name: string // 指标名（与汇总卡 / 表格列对应）
  short: string // 一句话说明（汇总卡下方）
  definition: string // 定义：这个数是什么
  algorithm: string // 算法：怎么算出来的
  reading: string // 解读：怎么判断好坏
}

// 全部指标的定义（文案随口径配置参数化，页面与 CSV 共用）
export function metricDefs(cfg: ReportConfig): MetricDef[] {
  const third = frontThirdRows(cfg.rows)
  const midLabel = middleColsLabel(cfg.cols)
  return [
    {
      id: 'weeks',
      name: '统计周数',
      short: '纳入统计的已生成周数',
      definition: `本报告统计覆盖的轮换周数（计划共 ${cfg.weeks} 周）。`,
      algorithm: '已生成并纳入统计的周座位表数量。',
      reading: '周数越多统计越有代表性；不足计划周数时可继续生成。',
    },
    {
      id: 'hard',
      name: '硬约束违反',
      short: '违反视力/听力/行动/固定座位/必须分开的人次，必须为 0',
      definition: `全部周次中违反硬性约束的人次（视力需前 ${cfg.frontRows} 排、视力需中间列、听力需前半排、行动不便需靠过道、未坐固定座位、「必须分开」的两人成为同桌）。`,
      algorithm: '逐周逐人检查所坐座位是否满足其全部硬约束，每违反一项计 1。',
      reading: '必须为 0；生成引擎保证为 0，仅手工改动历史数据后才可能非 0。',
    },
    {
      id: 'front-rows',
      name: `前 ${cfg.frontRows} 排次数`,
      short: `每人坐前 ${cfg.frontRows} 排的周数；极差 = 最多 − 最少，目标 ≤ 3`,
      definition: `统计期内每人被安排在「前 ${cfg.frontRows} 排」的周数；「前排」按座位表第 1～${cfg.frontRows} 排计（来自约束配置 frontRows = ${cfg.frontRows}）。`,
      algorithm: `逐周检查座位排号，排号 ≤ ${cfg.frontRows} 则计 1 次并逐人累加；汇总卡的「极差」= 全班最多次数 − 最少次数。`,
      reading: '每人次数越接近越公平；极差目标 ≤ 3。',
    },
    {
      id: 'front-middle-back',
      name: '前/中/后排次数',
      short: `按 ${cfg.rows} 行三等分段，统计每人坐前/中/后段的周数`,
      definition: `把 ${cfg.rows} 行分为前/中/后三段（前、后段各 ${third} 行，其余为中段），统计每人座位落在各段的周数。`,
      algorithm: `座位排号 ≤ ${third} 记前段，≥ ${cfg.rows - third + 1} 记后段，其余记中段，逐周累加。`,
      reading: '三段周数越接近，说明前后轮换越均匀。',
    },
    {
      id: 'middle-col',
      name: '中间列次数',
      short: `坐中间列（${midLabel}）的周数`,
      definition: `统计期内每人座位位于「中间列」的周数；中间列 = 到教室左右中轴的距离不超过（列数−1)/4 的居中连续列（${cfg.cols} 列时为${midLabel}）。`,
      algorithm: '逐周检查座位列是否属于中间列集合，属于则计 1 次并累加。',
      reading: '与「前/中/后」一起判断左右维度是否均衡。',
    },
    {
      id: 'position-score',
      name: '平均位置分',
      short: '位置分 0～3 分、越低位置越好；取各周平均',
      definition:
        '位置分 = 行权重（0～2：第 1 排 0 分，最后一排 2 分）+ 列权重（0～1：正中列 0 分，最边列 1 分），分数越低位置越好；平均位置分 = 每人各周位置分之和 ÷ 统计周数。',
      algorithm: '行权重 = 排（从 0 计）÷（行数−1）× 2；列权重 = 列到中轴的距离 ÷ 中轴到边列的距离。',
      reading:
        '全班平均位置分的理论基准约为 1.5（行权重均值 1 + 列权重均值 0.5）；个人平均分越接近全班均值越公平，明显更低说明坐好位置偏多。',
    },
    {
      id: 'variance',
      name: '位置分 Σ偏差²',
      short: '各人累计位置分与平均的偏差平方和，越小越公平',
      definition: '每人「累计位置分」与全班平均累计位置分之差的平方和（= 方差 × 人数），正是生成引擎最小化的目标。',
      algorithm: 'Σ（每人累计分 − 全班平均累计分）²，即 Σ累计分² −（Σ累计分）² ÷ 人数。',
      reading: '越小越公平，0 = 每人累计分完全相同；数值随人数与周数增长，只适合同一班级前后对比。',
    },
    {
      id: 'deskmate',
      name: '同桌超 2 次的对',
      short: '同桌次数 > 2 的两人组合数，目标为 0',
      definition: '统计期内两人成为同桌超过 2 次的组合数（同桌：行列模式 = 同排相邻且中间无过道，小组模式 = 同组全部成员）。',
      algorithm: '逐周记录每对同桌并累计次数，次数 > 2 的组合计入，并在「同桌超限报告」中逐对列出。',
      reading: '目标为 0；出现超限会给出具体组合与次数。',
    },
    {
      id: 'height',
      name: '身高序违背',
      short: '同列前排比后排高的次数（需开启身高规则）',
      definition: '开启「高个靠后」且行列模式下，同列中前排学生身高大于后排学生的座位对数（仅统计两人都填写了身高的对）。',
      algorithm: '逐周逐列比较相邻前后两个座位上学生的身高。',
      reading: '越小越好；未启用身高规则时不统计。',
    },
  ]
}

// CSV 表头注释行（不含 '# ' 前缀，由 csv.ts 统一加）
export function methodologyCommentLines(cls: ClassEntity): string[] {
  const meta = reportConfigMeta(cls)
  const lines = [
    '公平性统计报告 · 表头注释（解释每个数字的定义、算法与所用配置，非数据行）',
    `本报告统计所用配置：${configLabel(meta.current)}`,
    meta.generated
      ? `轮换结果生成时配置：${configLabel(meta.generated)}（${meta.stale ? '与当前配置不一致' : '与当前配置一致'}）`
      : '轮换结果生成时配置：未记录（数据由旧版本生成或外部导入），统计按当前配置口径',
  ]
  if (meta.stale) {
    lines.push('注意：生成轮换结果之后配置又修改过，本表数据出自早先那套配置口径，建议重新生成后再引用')
  }
  for (const m of metricDefs(meta.current)) {
    lines.push(`指标·${m.name}：${m.definition} 算法：${m.algorithm} 解读：${m.reading}`)
  }
  return lines
}
