import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import { money, moneyShort } from '../lib/format'

// Validated chart palette (light surface #fffdf8): navy, gold, green.
export const SERIES = { navy: '#2f5aa8', gold: '#b07d12', green: '#2a8a63', grid: '#efe7d6', axis: '#64748b', neg: '#c2410c' }

const tooltipStyle = {
  contentStyle: { borderRadius: 10, border: '1px solid #e7dcc4', fontSize: 12, boxShadow: '0 4px 16px rgba(15,29,56,.08)' },
  labelStyle: { color: '#15294d', fontWeight: 600 },
}
const axisProps = { stroke: SERIES.axis, fontSize: 11, tickLine: false, axisLine: false }

export function IncomeExpenseChart({ data }: { data: { label: string; income: number; expenses: number }[] }) {
  return (
    <div className="h-64" role="img" aria-label="Monthly income and expenses bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={SERIES.grid} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis tickFormatter={moneyShort} width={56} {...axisProps} />
          <Tooltip formatter={(v) => money(Number(v))} cursor={{ fill: '#fbf7ee' }} {...tooltipStyle} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar isAnimationActive={false} dataKey="income" name="Income" fill={SERIES.navy} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar isAnimationActive={false} dataKey="expenses" name="Expenses" fill={SERIES.gold} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SavingsBarChart({ data }: { data: { label: string; savings: number }[] }) {
  return (
    <div className="h-52" role="img" aria-label="Monthly savings bar chart. Bars below zero mean you spent more than you earned.">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={SERIES.grid} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis tickFormatter={moneyShort} width={56} {...axisProps} />
          <ReferenceLine y={0} stroke="#94a3b8" />
          <Tooltip formatter={(v) => money(Number(v))} cursor={{ fill: '#fbf7ee' }} {...tooltipStyle} />
          <Bar isAnimationActive={false} dataKey="savings" name="Savings" radius={[4, 4, 4, 4]} maxBarSize={28}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.savings < 0 ? SERIES.neg : SERIES.green} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CategoryChart({ data }: { data: { name: string; amount: number }[] }) {
  const h = Math.max(140, data.length * 34 + 20)
  return (
    <div style={{ height: h }} role="img" aria-label="Spending by category bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke={SERIES.grid} />
          <XAxis type="number" tickFormatter={moneyShort} {...axisProps} />
          <YAxis type="category" dataKey="name" width={130} {...axisProps} tick={{ fontSize: 11, fill: '#334155' }} />
          <Tooltip formatter={(v) => money(Number(v))} cursor={{ fill: '#fbf7ee' }} {...tooltipStyle} />
          <Bar isAnimationActive={false} dataKey="amount" name="Spent" fill={SERIES.navy} radius={[0, 4, 4, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PlannedPaidChart({ data }: { data: { name: string; planned: number; paid: number }[] }) {
  const h = Math.max(160, data.length * 40 + 40)
  return (
    <div style={{ height: h }} role="img" aria-label="Wedding budget planned versus paid by category">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" barGap={2} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke={SERIES.grid} />
          <XAxis type="number" tickFormatter={moneyShort} {...axisProps} />
          <YAxis type="category" dataKey="name" width={150} {...axisProps} tick={{ fontSize: 11, fill: '#334155' }} />
          <Tooltip formatter={(v) => money(Number(v))} cursor={{ fill: '#fbf7ee' }} {...tooltipStyle} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          <Bar isAnimationActive={false} dataKey="planned" name="Planned" fill={SERIES.navy} radius={[0, 4, 4, 0]} maxBarSize={14} />
          <Bar isAnimationActive={false} dataKey="paid" name="Paid" fill={SERIES.gold} radius={[0, 4, 4, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SavingsTrackChart({ data }: { data: { label: string; target: number; actual: number | null }[] }) {
  return (
    <div className="h-64" role="img" aria-label="Cumulative wedding savings: target versus actual">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={SERIES.grid} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis tickFormatter={moneyShort} width={56} {...axisProps} />
          <Tooltip formatter={(v) => (v === null ? '—' : money(Number(v)))} {...tooltipStyle} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
          <Line isAnimationActive={false} type="monotone" dataKey="target" name="Cumulative target" stroke={SERIES.gold} strokeWidth={2} strokeDasharray="6 4" dot={false} />
          <Line isAnimationActive={false} type="monotone" dataKey="actual" name="Cumulative saved" stroke={SERIES.navy} strokeWidth={2} dot={{ r: 4, fill: SERIES.navy, stroke: '#fff', strokeWidth: 2 }} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
