import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Link } from '../router'
import { useStore } from '../store'
import { computeFairness } from '../lib/fairness'
import { downloadCSV, fairnessCSV } from '../lib/csv'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Download,
  FileClock,
  HelpCircle,
  Info,
  Layers,
} from 'lucide-react'
import {
  avgScoreRangeHint,
  caliberLines,
  colFrontRowsDef,
  colMiddleColDef,
  COL_AVG_DEF,
  COL_DESKCOUNT_DEF,
  COL_HEIGHT_DEF,
  COL_NAME_DEF,
  COL_THIRDS_DEF,
  COL_TOPDESK_DEF,
  COL_VISION_DEF,
  COL_WARN_DEF,
  DESKMATE_DEF,
  FRONT_RANGE_DEF,
  HARD_DEF,
  HEIGHT_DEF,
  type MetricDef,
  VARIANCE_DEF,
  WEEKS_DEF,
} from '../lib/metrics'

// 小问号：悬停/聚焦显示该项的定义与算法
function DefTip({ def, good }: { def: string; good?: string }) {
  return (
    <span className="def-tip" tabIndex={0} role="button" aria-label="指标说明">
      <HelpCircle size={13} />
      <span className="def-pop" role="tooltip">
        {def}
        {good && <b>{good}</b>}
      </span>
    </span>
  )
}

function MetricCard({
  testid,
  value,
  bad,
  good,
  warn,
  metric,
  labelOverride,
}: {
  testid: string
  value: ReactNode
  bad?: boolean
  good?: boolean
  warn?: boolean
  metric: MetricDef
  labelOverride?: ReactNode
}) {
  return (
    <div className="card stat">
      <span className={`stat-num ${bad ? 'bad' : ''}${good ? 'good' : ''}${warn ? 'warn' : ''}`} data-testid={testid}>
        {value}
      </span>
      <span className="stat-label">
        {labelOverride ?? metric.label} <DefTip def={metric.def} good={metric.good} />
      </span>
      {metric.good && <span className="stat-good">{metric.good}</span>}
    </div>
  )
}

export function Fairness({ classId }: { classId: string }) {
  const { getClass } = useStore()
  const cls = getClass(classId)
  const report = useMemo(() => (cls ? computeFairness(cls) : null), [cls])

  if (!cls || !report) {
    return (
      <div className="page">
        <p>班级不存在。</p>
        <Link to="/">返回</Link>
      </div>
    )
  }

  const nameById = new Map(cls.students.map((s) => [s.id, s.name]))
  const maxWeeks = Math.max(1, report.totalWeeks)
  const caliber = report.caliber
  const primarySnap = caliber.primary.snap

  const exportCsv = () => downloadCSV(`${cls.name}-公平性统计.csv`, fairnessCSV(cls, report))

  return (
    <div className="page page-wide">
      <div className="page-head">
        <Link className="back" to="/">
          <ArrowLeft size={14} /> 班级列表
        </Link>
        <h1>{cls.name} · 公平性报告</h1>
        <nav className="tabs">
          <Link className="tab" to={`/class/${cls.id}/setup`}>
            座位与学生
          </Link>
          <Link className="tab" to={`/class/${cls.id}/rotations`}>
            轮换结果
          </Link>
          <span className="tab tab-active">公平性报告</span>
          <Link className="tab" to={`/class/${cls.id}/print`}>
            打印
          </Link>
        </nav>
      </div>

      {/* 报告口径：这份数字是在哪套配置、哪套算法下算出来的 */}
      <section className="card caliber-card" data-testid="report-caliber">
        <h3>
          <Info size={16} /> 本报告的统计口径（数字从哪来）
        </h3>
        <ul className="caliber-lines" data-testid="caliber-lines">
          {caliberLines(caliber.primary).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>

        {!caliber.legacy && !caliber.currentMatches && (
          <div className="stale-banner" data-testid="caliber-stale">
            <AlertTriangle size={15} />
            <div>
              <b>配置已改动：以下统计按生成时的早先配置计算，不是按当前配置。</b>
              <ul>
                {caliber.diffs.map((d) => (
                  <li key={d.field}>
                    {d.label}：{d.oldV} → 现已改为 {d.newV}
                  </li>
                ))}
              </ul>
              <span className="muted small">
                历史周次保留原口径可看出「早先那套算法」的结果；到「轮换结果」页用当前配置重新生成后，本提示才会消失。
              </span>
            </div>
          </div>
        )}

        {caliber.legacy && (
          <div className="stale-banner stale-soft" data-testid="caliber-legacy">
            <FileClock size={15} />
            <span>
              这些周次由早期版本生成，当时未记录配置；下列数字按班级<b>当前</b>配置（{cls.layout.rows} 排 ×{' '}
              {cls.layout.cols} 列、前 {cls.constraints.frontRows} 排）回溯计算。重新生成后会改为按生成时口径统计。
            </span>
          </div>
        )}

        {caliber.mixed && (
          <details className="mixed-caliber" data-testid="caliber-mixed">
            <summary>
              <Layers size={14} /> 这些周次分 {caliber.groups.length} 批生成，使用了不同口径（点击查看每批配置）
            </summary>
            <div className="mixed-groups">
              {caliber.groups.map((g) => (
                <div key={g.key} className={`mixed-group ${g === caliber.primary ? 'is-primary' : ''}`}>
                  <b>
                    {g === caliber.primary ? '主口径 · ' : ''}第 {g.weeks[0]}～{g.weeks[g.weeks.length - 1]} 周（共{' '}
                    {g.weeks.length} 周）
                  </b>
                  <ul>
                    {caliberLines(g).map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      <div className="explainer card">
        <h3>
          <BarChart3 size={16} /> 公平性依据（可向家长解释）
        </h3>
        <p>
          <b>位置分</b> = 前后排权重(0~2，越小越靠前) + 中间度权重(0~1，越小越靠中间)，<b>分数越低位置越好</b>。
          引擎在满足硬约束（视力/听力/行动不便/固定座位/必须分开）的前提下，最小化「每人累计位置分与平均分之差的平方和」，
          使<b>每个人坐好位置的机会均等</b>；同时统计每人「前 {report.frontRows} 排」的次数，次数极差越小越公平。
          各项数字旁边都有 <HelpCircle size={12} style={{ verticalAlign: '-2px' }} /> 图标，悬停可看定义与算法。
        </p>
        <p className="muted small">{avgScoreRangeHint(report.layoutRows, report.layoutCols)}</p>
      </div>

      {report.totalWeeks === 0 ? (
        <div className="empty-hint">
          <p>还没有生成轮换结果。先到「轮换结果」页生成。</p>
          <Link className="btn btn-primary" to={`/class/${cls.id}/rotations`}>
            去生成
          </Link>
        </div>
      ) : (
        <>
          <div className="summary-cards" data-testid="summary-cards">
            <MetricCard testid="fair-weeks" value={report.totalWeeks} metric={WEEKS_DEF} />
            <MetricCard
              testid="fair-hard"
              value={report.hardViolations.length === 0 ? '0 ✓' : report.hardViolations.length}
              bad={report.hardViolations.length > 0}
              good={report.hardViolations.length === 0}
              metric={HARD_DEF}
            />
            <MetricCard
              testid="fair-range"
              value={report.frontRowsRange}
              warn={report.frontRowsRange > 3}
              metric={FRONT_RANGE_DEF}
              labelOverride={
                <>
                  前 {report.frontRows} 排次数极差 <DefTip def={FRONT_RANGE_DEF.def} good={FRONT_RANGE_DEF.good} />
                </>
              }
            />
            <MetricCard testid="fair-variance" value={report.variance.toFixed(1)} metric={VARIANCE_DEF} />
            <MetricCard
              testid="fair-desk"
              value={report.deskmateOverLimit.length}
              warn={report.deskmateOverLimit.length > 0}
              metric={DESKMATE_DEF}
            />
            <MetricCard
              testid="fair-height"
              value={report.heightViolations}
              metric={HEIGHT_DEF}
              labelOverride={
                <>
                  身高序违背{primarySnap && !primarySnap.heightRule ? '（未启用）' : ''}{' '}
                  <DefTip def={HEIGHT_DEF.def} good={HEIGHT_DEF.good} />
                </>
              }
            />
          </div>

          {report.hardViolations.length > 0 && (
            <div className="card error-card">
              <h3>
                <AlertTriangle size={16} /> 违反明细（仅手工改动历史数据时可能出现）
              </h3>
              <ul>
                {report.hardViolations.slice(0, 10).map((v, i) => (
                  <li key={i}>{v.detail}</li>
                ))}
              </ul>
            </div>
          )}

          {report.deskmateOverLimit.length > 0 && (
            <div className="card warn-card">
              <h3>
                同桌超限报告{' '}
                <span className="muted small">
                  （{DESKMATE_DEF.def}）
                </span>
              </h3>
              <p>
                {report.deskmateOverLimit.map((d) => `${d.a}–${d.b}（${d.count} 次）`).join('、')}
              </p>
            </div>
          )}

          <section className="card">
            <h2 className="with-action">
              逐人统计（{cls.students.length} 人）
              <span className="spacer" />
              <button className="btn btn-primary" data-testid="export-csv" onClick={exportCsv}>
                <Download size={15} /> 导出 CSV（表头含口径与算法说明）
              </button>
            </h2>
            {report.totalWeeks > 0 && (
              <div className="bar-chart" data-testid="bar-chart">
                {report.rows.map((r) => (
                  <div key={r.student.id} className="bar-row" data-testid="bar-row">
                    <span className="bar-name">{r.student.name}</span>
                    <span className="bar-track">
                      <span className="bar-seg bar-front" style={{ width: `${(r.frontCount / maxWeeks) * 100}%` }} />
                      <span className="bar-seg bar-middle" style={{ width: `${(r.middleCount / maxWeeks) * 100}%` }} />
                      <span className="bar-seg bar-back" style={{ width: `${(r.backCount / maxWeeks) * 100}%` }} />
                    </span>
                    <span className="bar-nums">
                      前{r.frontCount} 中{r.middleCount} 后{r.backCount}
                    </span>
                  </div>
                ))}
                <div className="legend">
                  <em className="bar-front" /> 前排(前 {report.frontThird} 排)
                  <em className="bar-middle" /> 中排
                  <em className="bar-back" /> 后排(后 {report.frontThird} 排)
                  <DefTip def={COL_THIRDS_DEF} />
                </div>
              </div>
            )}
            <div className="table-wrap">
              <table className="table" data-testid="fairness-table">
                <thead>
                  <tr>
                    <th>
                      姓名 <DefTip def={COL_NAME_DEF} />
                    </th>
                    <th>
                      身高 <DefTip def={COL_HEIGHT_DEF} />
                    </th>
                    <th>
                      视力 <DefTip def={COL_VISION_DEF} />
                    </th>
                    <th>
                      前 {report.frontRows} 排次数 <DefTip def={colFrontRowsDef(report.frontRows)} />
                    </th>
                    <th>
                      前/中/后 <DefTip def={COL_THIRDS_DEF} />
                    </th>
                    <th>
                      中间列次数 <DefTip def={colMiddleColDef(report.layoutCols)} />
                    </th>
                    <th>
                      平均位置分 <DefTip def={COL_AVG_DEF} good={avgScoreRangeHint(report.layoutRows, report.layoutCols)} />
                    </th>
                    <th>
                      最常同桌 <DefTip def={COL_TOPDESK_DEF} />
                    </th>
                    <th>
                      同桌次数 <DefTip def={COL_DESKCOUNT_DEF} />
                    </th>
                    <th>
                      警告 <DefTip def={COL_WARN_DEF} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => {
                    const top = r.deskmates[0]
                    return (
                      <tr key={r.student.id} data-testid="fairness-row">
                        <td>{r.student.name}</td>
                        <td>{r.student.heightCm ?? '—'}</td>
                        <td>{r.student.vision === 'none' ? '—' : r.student.vision === 'front_required' ? '需前排' : '需中间'}</td>
                        <td>{r.frontRowsCount}</td>
                        <td>
                          {r.frontCount}/{r.middleCount}/{r.backCount}
                        </td>
                        <td>{r.middleColCount}</td>
                        <td>{r.avgScore.toFixed(2)}</td>
                        <td>{top ? (nameById.get(top.studentId) ?? '') : '—'}</td>
                        <td>{top?.count ?? 0}</td>
                        <td>{r.maxDeskmateRepeat > 2 ? <span className="warn-text">同桌超限</span> : <CheckCircle2 size={13} className="good" />}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
