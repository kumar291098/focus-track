import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

interface WeeklyTrendItem {
  label: string;
  dateStr: string;
  Productive: number;
  Neutral: number;
  Distracting: number;
  total: number;
}

interface WeeklyTabProps {
  weeklyTrendData: WeeklyTrendItem[];
  formatDuration: (secs: number) => string;
  formatTooltipMinutes: (value: unknown) => string;
}

export default function WeeklyTab({
  weeklyTrendData,
  formatDuration,
  formatTooltipMinutes
}: WeeklyTabProps) {
  return (
    <article className="panel wide">
      <div className="panel-header">
        <div>
          <p className="eyebrow">7-Day Trends</p>
          <h2>Weekly Focus Analysis</h2>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card-glass">
          <span>Weekly Total Time</span>
          <h3>{formatDuration(weeklyTrendData.reduce((acc, curr) => acc + curr.total, 0))}</h3>
        </div>
        <div className="stat-card-glass">
          <span>Weekly Productive</span>
          <h3>{formatDuration(weeklyTrendData.reduce((acc, curr) => acc + curr.Productive, 0))}</h3>
        </div>
        <div className="stat-card-glass">
          <span>Daily Average Time</span>
          <h3>{formatDuration(weeklyTrendData.reduce((acc, curr) => acc + curr.total, 0) / 7)}</h3>
        </div>
        <div className="stat-card-glass">
          <span>Weekly Focus Score</span>
          <h3>
            {(() => {
              const prod = weeklyTrendData.reduce((acc, curr) => acc + curr.Productive, 0);
              const dist = weeklyTrendData.reduce((acc, curr) => acc + curr.Distracting, 0);
              return prod + dist > 0 ? `${Math.round((prod / (prod + dist)) * 100)}%` : "0%";
            })()}
          </h3>
        </div>
      </div>

      <div className="chart-wrap" style={{ marginTop: '2rem' }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={weeklyTrendData}>
            <CartesianGrid stroke="#263447" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={formatTooltipMinutes} />
            <Tooltip formatter={formatTooltipMinutes} />
            <Bar dataKey="Productive" name="🟢 Productive" fill="#10b981" stackId="a" />
            <Bar dataKey="Neutral" name="🟡 Neutral" fill="#6b7280" stackId="a" />
            <Bar dataKey="Distracting" name="🔴 Distracting" fill="#ef4444" stackId="a" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
