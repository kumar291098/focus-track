import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from "react";
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
import codingHelpLogo from "./assets/codinghelp-logo.jpg";

declare global {
  interface Window {
    focusTrack?: {
      getAppVersion: () => Promise<string>;
      getDashboardSnapshot: () => Promise<DashboardSnapshot>;
      getTrackingStatus: () => Promise<TrackingStatus | null>;
    };
  }
}

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

const APP_COLORS = ["#d66853", "#2c6e62", "#264653", "#e9c46a", "#8f5f2a"];
const CATEGORY_COLORS: Record<string, string> = {
  Productive: "#2c6e62",
  Neutral: "#e9c46a",
  Distracting: "#d66853"
};

const emptySnapshot: DashboardSnapshot = {
  todayTotalSeconds: 0,
  sessionCount: 0,
  topApps: [],
  hourlyUsage: Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, "0")}:00`,
    seconds: 0
  })),
  categoryUsage: [
    { name: "Productive", seconds: 0 },
    { name: "Neutral", seconds: 0 },
    { name: "Distracting", seconds: 0 }
  ],
  recentSessions: []
};

function formatDuration(totalSeconds: number) {
  if (totalSeconds < 60) {
    return `${Math.max(0, Math.floor(totalSeconds))}s`;
  }

  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatTooltipMinutes(value: unknown) {
  if (typeof value === "number") {
    return formatDuration(value);
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return typeof value === "string" ? value : "";
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("FocusTrack renderer crashed", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <LoadingScreen
          title="FocusTrack needs a quick restart"
          message={this.state.error.message}
          tone="error"
        />
      );
    }

    return this.props.children;
  }
}

function LoadingScreen({
  title,
  message,
  tone = "loading"
}: {
  title: string;
  message: string;
  tone?: "loading" | "error";
}) {
  return (
    <main className={`loading-screen ${tone}`}>
      <div className="loading-card">
        <img className="loading-logo" src={codingHelpLogo} alt="CodingHelp logo" />
        <div className="pulse-ring" />
        <p className="eyebrow">FocusTrack</p>
        <h1>{title}</h1>
        <p>{message}</p>
        <div className="loading-steps">
          <span>Starting desktop tracker</span>
          <span>Opening local SQLite database</span>
          <span>Preparing today dashboard</span>
        </div>
      </div>
    </main>
  );
}

function Dashboard() {
  const [version, setVersion] = useState("loading...");
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(emptySnapshot);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.focusTrack) {
      setVersion("dev-mode");
      setIsLoading(false);
      setLoadError("Desktop bridge is unavailable. Start FocusTrack through Electron or the installed app.");
      return;
    }

    window.focusTrack
      .getAppVersion()
      .then(setVersion)
      .catch(() => setVersion("unavailable"));
  }, []);

  useEffect(() => {
    if (!window.focusTrack) {
      return;
    }

    const load = () => {
      void Promise.all([
        window.focusTrack!.getDashboardSnapshot(),
        window.focusTrack!.getTrackingStatus()
      ])
        .then(([nextSnapshot, nextStatus]) => {
          setSnapshot(nextSnapshot);
          setTrackingStatus(nextStatus);
          setLoadError(nextStatus?.lastError ?? null);
        })
        .catch((error: unknown) => {
          setSnapshot(emptySnapshot);
          setTrackingStatus(null);
          setLoadError(
            error instanceof Error ? error.message : "Unable to load local activity data."
          );
        })
        .finally(() => setIsLoading(false));
    };

    load();
    const interval = window.setInterval(load, 5_000);

    return () => window.clearInterval(interval);
  }, []);

  const appUsage = snapshot.topApps.map((item, index) => ({
    name: item.name,
    seconds: item.seconds,
    color: APP_COLORS[index % APP_COLORS.length]
  }));

  const hourlyUsage = snapshot.hourlyUsage.map((item) => ({
    hour: item.hour,
    seconds: item.seconds
  }));

  const categories = snapshot.categoryUsage.map((item) => ({
    name: item.name,
    value: item.seconds,
    color: CATEGORY_COLORS[item.name] ?? "#8f5f2a"
  }));

  const topApp = appUsage[0];
  const hasAppUsage = appUsage.some((item) => item.seconds > 0);
  const hasHourlyUsage = hourlyUsage.some((item) => item.seconds > 0);
  const hasCategoryUsage = categories.some((item) => item.value > 0);

  if (isLoading) {
    return (
      <LoadingScreen
        title="Starting your focus dashboard"
        message="FocusTrack is connecting to the local tracker and preparing today's usage data."
      />
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <div className="brand-lockup">
            <img
              className="brand-logo"
              src={codingHelpLogo}
              alt="CodingHelp channel logo"
            />
            <div>
              <p className="eyebrow">CodingHelp Production</p>
              <h1>FocusTrack</h1>
            </div>
          </div>
          <p className="eyebrow">Local First Analytics</p>
          <p className="sidebar-copy">
            Privacy-focused activity insights for desktop work, starting with app
            usage tracking on your machine.
          </p>
        </div>

        <nav className="nav">
          <button className="nav-item active">Today Overview</button>
          <button className="nav-item">App Usage</button>
          <button className="nav-item">Hourly Activity</button>
          <button className="nav-item">Weekly Report</button>
          <button className="nav-item">Settings</button>
        </nav>

        <div className="status-card">
          <span className="status-label">Tracking status</span>
          <strong>v{version}</strong>
          <p>
            {trackingStatus?.isTracking
              ? `Polling every ${trackingStatus.pollIntervalMs / 1000}s`
              : "Tracker not running"}
          </p>
          {trackingStatus?.currentSession ? (
            <p>
              Now tracking: {trackingStatus.currentSession.appName} for{" "}
              {formatDuration(trackingStatus.currentSession.durationSeconds)}
            </p>
          ) : null}
          {trackingStatus?.lastError ? <p>Error: {trackingStatus.lastError}</p> : null}
          {loadError && !trackingStatus?.lastError ? <p>{loadError}</p> : null}
        </div>
      </aside>

      <main className="content">
        <section className="hero-card">
          <div>
            <p className="eyebrow">Today Summary</p>
            <h2>{formatDuration(snapshot.todayTotalSeconds)}</h2>
            <p className="hero-copy">
              {snapshot.sessionCount > 0
                ? "Your local activity is syncing into focustrack.db and this view refreshes automatically."
                : "Keep this app open for a few seconds, then switch between apps to build your first activity sessions."}
            </p>
          </div>

          <div className="hero-meta">
            <div className="metric-card accent">
              <span>Total Active Time</span>
              <strong>{formatDuration(snapshot.todayTotalSeconds)}</strong>
            </div>
            <div className="metric-card">
              <span>Most Used App</span>
              <strong>{topApp?.name ?? "No data yet"}</strong>
            </div>
            <div className="metric-card">
              <span>Sessions Today</span>
              <strong>{snapshot.sessionCount}</strong>
            </div>
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
                  <BarChart data={appUsage}>
                    <CartesianGrid stroke="#263447" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip formatter={formatTooltipMinutes} />
                    <Bar dataKey="seconds" radius={[10, 10, 0, 0]}>
                      {appUsage.map((entry) => (
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
                <h3>Focus quality</h3>
              </div>
            </div>

            <div className="chart-wrap">
              {hasCategoryUsage ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                    >
                      {categories.map((entry) => (
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
              {categories.map((item) => (
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

        <section className="bottom-grid">
          <article className="panel wide">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Hourly Activity</p>
                <h3>Work rhythm</h3>
              </div>
            </div>

            <div className="chart-wrap">
              {hasHourlyUsage ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={hourlyUsage}>
                    <CartesianGrid stroke="#263447" vertical={false} />
                    <XAxis dataKey="hour" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip formatter={formatTooltipMinutes} />
                    <Bar dataKey="seconds" fill="#2dd4bf" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="Hourly activity will fill in as FocusTrack observes app usage." />
              )}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Next Build Steps</p>
                <h3>Phase 1 MVP</h3>
              </div>
            </div>

            <ul className="task-list">
              <li>SQLite database is now created locally as `focustrack.db`</li>
              <li>Active window tracking is polling every 5 seconds</li>
              <li>Desktop sessions are being saved into `app_activity`</li>
              <li>Next up is idle detection and weekly reporting</li>
            </ul>
          </article>
        </section>
      </main>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="empty-chart">
      <div className="empty-orbit" />
      <strong>No activity yet</strong>
      <p>{message}</p>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}

export default App;
