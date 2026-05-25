import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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

interface TrackingStatus {
  isTracking: boolean;
  pollIntervalMs: number;
  currentSession: {
    appName: string;
    windowTitle: string;
    startedAt: string;
    durationSeconds: number;
  } | null;
  lastError: string | null;
}

interface OverviewTabProps {
  snapshot: DashboardSnapshot;
  trackingStatus: TrackingStatus | null;
  productiveSec: number;
  focusScore: number;
  appUsage: Array<{ name: string; seconds: number; color: string; category: string }>;
  categoryUsageData: Array<{ name: string; value: number; color: string }>;
  hasAppUsage: boolean;
  hasCategoryUsage: boolean;
  formatDuration: (secs: number) => string;
  formatTooltipMinutes: (value: unknown) => string;
}

export default function OverviewTab({
  snapshot,
  trackingStatus,
  productiveSec,
  focusScore,
  appUsage,
  categoryUsageData,
  hasAppUsage,
  hasCategoryUsage,
  formatDuration,
  formatTooltipMinutes
}: OverviewTabProps) {
  return (
    <>
      <section className="hero-card">
        <div>
          <p className="eyebrow">Today Active Time</p>
          <h2>{formatDuration(snapshot.todayTotalSeconds)}</h2>
          <p className="hero-copy">
            Your focus dashboard refreshes in real-time. Switch between code editors, web browsers, and terminals to record your work automatically.
          </p>
        </div>

        <div className="hero-meta">
          <div className="metric-card accent">
            <span>Productive Time</span>
            <strong>{formatDuration(productiveSec)}</strong>
          </div>
          <div className="metric-card">
            <span>Focus Score</span>
            <strong className={`score-badge ${focusScore > 70 ? 'high' : focusScore > 40 ? 'med' : 'low'}`}>{focusScore}%</strong>
          </div>
          <div className="metric-card">
            <span>Total Sessions</span>
            <strong>{snapshot.sessionCount}</strong>
          </div>
        </div>
      </section>

      <section className="live-panel">
        <div>
          <p className="eyebrow">Foreground Session</p>
          <h3>{trackingStatus?.currentSession?.appName ?? "Inactive / Idle"}</h3>
          <p className="window-title-p">
            {trackingStatus?.currentSession?.windowTitle ?? "No active application detected on screen."}
          </p>
        </div>
        <div className="live-meta">
          <span>{trackingStatus?.isTracking ? "Current Duration" : "Tracking Paused"}</span>
          <strong>
            {formatDuration(trackingStatus?.currentSession?.durationSeconds ?? 0)}
          </strong>
        </div>
      </section>

      <section className="stats-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Top Apps</p>
              <h3>Daily usage</h3>
            </div>
          </div>

          <div className="chart-wrap">
            {hasAppUsage ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={appUsage.slice(0, 5)}>
                  <CartesianGrid stroke="#263447" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={formatTooltipMinutes} />
                  <Tooltip formatter={formatTooltipMinutes} />
                  <Bar dataKey="seconds" radius={[10, 10, 0, 0]}>
                    {appUsage.slice(0, 5).map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="Waiting for your first tracked app session." />
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Category Mix</p>
              <h3>Focus distribution</h3>
            </div>
          </div>

          <div className="chart-wrap">
            {hasCategoryUsage ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={categoryUsageData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={5}
                  >
                    {categoryUsageData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={formatTooltipMinutes} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="Categories appear after activity is recorded." />
            )}
          </div>

          <div className="legend">
            {categoryUsageData.map((item) => (
              <div key={item.name} className="legend-item">
                <span
                  className="legend-swatch"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.name}</span>
                <strong>{formatDuration(item.value)}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
