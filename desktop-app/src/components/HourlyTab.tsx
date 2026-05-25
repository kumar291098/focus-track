import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import EmptyChart from "./EmptyChart";

interface DashboardSnapshot {
  todayTotalSeconds: number;
  sessionCount: number;
  topApps: Array<{ name: string; seconds: number }>;
  hourlyUsage: Array<{ hour: string; seconds: number }>;
  categoryUsage: Array<{ name: string; seconds: number }>;
  recentSessions: Array<{
    id: number;
    appName: string;
    windowTitle: string;
    startTime: string;
    endTime: string;
    durationSeconds: number;
  }>;
}

interface HourlyTabProps {
  snapshot: DashboardSnapshot;
  formatDuration: (secs: number) => string;
  formatTooltipMinutes: (value: unknown) => string;
}

export default function HourlyTab({
  snapshot,
  formatDuration,
  formatTooltipMinutes
}: HourlyTabProps) {
  return (
    <article className="panel wide">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Hourly Distribution</p>
          <h2>Today Activity Rhythm</h2>
        </div>
      </div>

      <div className="chart-wrap">
        {snapshot.hourlyUsage.some(h => h.seconds > 0) ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={snapshot.hourlyUsage}>
              <CartesianGrid stroke="#263447" vertical={false} />
              <XAxis dataKey="hour" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={formatTooltipMinutes} />
              <Tooltip formatter={formatTooltipMinutes} />
              <Bar dataKey="seconds" fill="#2dd4bf" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="Hourly activity will fill in as FocusTrack records your system usage." />
        )}
      </div>

      <div className="activity-heatmap-section">
        <p className="eyebrow">Timeline Intensity Matrix</p>
        <div className="activity-timeline-grid">
          {snapshot.hourlyUsage.map((hourData) => {
            const activityIntensity = Math.min(10, Math.ceil(hourData.seconds / 60)); // max intensity at 10+ mins active
            return (
              <div 
                key={hourData.hour} 
                className={`timeline-block intensity-${activityIntensity}`}
                title={`${hourData.hour} : ${formatDuration(hourData.seconds)} active`}
              >
                <span className="block-tooltip">{hourData.hour.split(':')[0]}h</span>
              </div>
            );
          })}
        </div>
        <div className="heatmap-legend">
          <span>Inactive</span>
          <div className="heatmap-legend-gradient" />
          <span>Highly Active</span>
        </div>
      </div>
    </article>
  );
}
