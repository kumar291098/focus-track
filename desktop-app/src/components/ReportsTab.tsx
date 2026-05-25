import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import AppIcon from "./IconResolver";

interface TopAppItem {
  name: string;
  seconds: number;
}

interface RecentSessionItem {
  id: number;
  appName: string;
  windowTitle: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
}

interface DashboardSnapshot {
  todayTotalSeconds: number;
  sessionCount: number;
  topApps: TopAppItem[];
  hourlyUsage: Array<{ hour: string; seconds: number }>;
  categoryUsage: Array<{ name: string; seconds: number }>;
  recentSessions: RecentSessionItem[];
}

interface ReportsTabProps {
  formatDuration: (secs: number) => string;
  formatTooltipMinutes: (value: unknown) => string;
  getAppCategoryLocal: (appName: string) => string;
  handleUpdateCategory: (appName: string, category: string) => void;
}

export default function ReportsTab({
  formatDuration,
  formatTooltipMinutes,
  getAppCategoryLocal,
  handleUpdateCategory
}: ReportsTabProps) {
  const [rangeType, setRangeType] = useState<"today" | "weekly" | "monthly" | "custom">("weekly");
  
  // Custom range dates (default to 7 days ago until today)
  const getFormattedDate = (d: Date) => d.toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return getFormattedDate(d);
  });
  const [endDate, setEndDate] = useState(() => getFormattedDate(new Date()));
  
  const [selectedApp, setSelectedApp] = useState<string>("all");
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load report data when range changes
  useEffect(() => {
    if (!window.focusTrack) return;

    let queryRange = "weekly";
    if (rangeType === "today") {
      queryRange = "today";
    } else if (rangeType === "weekly") {
      queryRange = "weekly";
    } else if (rangeType === "monthly") {
      const now = new Date();
      queryRange = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    } else if (rangeType === "custom") {
      queryRange = `${startDate}:${endDate}`;
    }

    setIsLoading(true);
    setError(null);

    window.focusTrack.getDashboardSnapshot(queryRange)
      .then((res) => {
        setSnapshot(res as DashboardSnapshot);
        // Reset selected app if it's not in the new topApps list (unless it's 'all')
        if (selectedApp !== "all" && !res.topApps.some(app => app.name === selectedApp)) {
          setSelectedApp("all");
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load report data");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [rangeType, startDate, endDate]);

  if (isLoading && !snapshot) {
    return (
      <div className="panel wide" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
        <div className="spinner">Loading report data...</div>
      </div>
    );
  }

  // Pre-calculate report statistics
  const topAppsList = snapshot?.topApps ?? [];
  const recentSessions = snapshot?.recentSessions ?? [];

  // Filter sessions by selected app
  const appSessions = selectedApp === "all" 
    ? recentSessions 
    : recentSessions.filter(s => s.appName === selectedApp);

  const totalSeconds = appSessions.reduce((acc, s) => acc + s.durationSeconds, 0);
  const sessionCount = appSessions.length;

  // Group by day for the daily trend chart
  const getDailyTrendData = () => {
    const dailyMap = new Map<string, { Productive: number; Neutral: number; Distracting: number; total: number }>();
    
    // Sort sessions oldest first to build a timeline
    const sortedSessions = [...appSessions].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    
    sortedSessions.forEach(session => {
      const date = new Date(session.startTime);
      const dayLabel = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const cat = getAppCategoryLocal(session.appName);

      if (!dailyMap.has(dayLabel)) {
        dailyMap.set(dayLabel, { Productive: 0, Neutral: 0, Distracting: 0, total: 0 });
      }

      const data = dailyMap.get(dayLabel)!;
      data[cat as "Productive" | "Neutral" | "Distracting"] += session.durationSeconds;
      data.total += session.durationSeconds;
    });

    return [...dailyMap.entries()].map(([day, val]) => ({
      day,
      ...val
    }));
  };

  // Group by hour for the hourly distribution chart
  const getHourlyDistributionData = () => {
    const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
    const hourlyMap = new Map<string, number>(hours.map(h => [h, 0]));

    appSessions.forEach(session => {
      const hour = new Date(session.startTime).getHours();
      const label = `${String(hour).padStart(2, "0")}:00`;
      hourlyMap.set(label, (hourlyMap.get(label) ?? 0) + session.durationSeconds);
    });

    return [...hourlyMap.entries()].map(([hour, seconds]) => ({
      hour,
      Duration: Math.round(seconds / 60) // in minutes
    }));
  };

  const dailyTrendData = getDailyTrendData();
  const hourlyDistData = getHourlyDistributionData();

  // Find page/window title statistics for selected app
  const pageTitlesMap = new Map<string, number>();
  appSessions.forEach(s => {
    pageTitlesMap.set(s.windowTitle, (pageTitlesMap.get(s.windowTitle) ?? 0) + s.durationSeconds);
  });
  const pageTitles = [...pageTitlesMap.entries()]
    .map(([title, seconds]) => ({ title, seconds }))
    .sort((a, b) => b.seconds - a.seconds);

  // Compute Focus Score for current view
  const getFocusScore = () => {
    let prod = 0;
    let dist = 0;
    appSessions.forEach(s => {
      const cat = getAppCategoryLocal(s.appName);
      if (cat === "Productive") prod += s.durationSeconds;
      if (cat === "Distracting") dist += s.durationSeconds;
    });
    return prod + dist > 0 ? Math.round((prod / (prod + dist)) * 100) : null;
  };

  const currentFocusScore = getFocusScore();
  const selectedAppCategory = selectedApp !== "all" ? getAppCategoryLocal(selectedApp) : null;

  return (
    <article className="panel wide">
      <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <p className="eyebrow">Advanced Analytics</p>
          <h2>Custom Reports Console</h2>
        </div>
        
        {/* Date Range Options */}
        <div style={{ display: "flex", gap: "0.5rem", background: "rgba(14, 22, 38, 0.4)", padding: "0.25rem", borderRadius: "12px", border: "1px solid var(--border-glass)" }}>
          <button 
            className={`btn-control-toggle`} 
            style={{ padding: "0.4rem 0.8rem", borderRadius: "8px", fontSize: "0.8rem", background: rangeType === "today" ? "var(--btn-gradient)" : "transparent", border: 0 }}
            onClick={() => setRangeType("today")}
          >
            Today
          </button>
          <button 
            className={`btn-control-toggle`} 
            style={{ padding: "0.4rem 0.8rem", borderRadius: "8px", fontSize: "0.8rem", background: rangeType === "weekly" ? "var(--btn-gradient)" : "transparent", border: 0 }}
            onClick={() => setRangeType("weekly")}
          >
            Weekly
          </button>
          <button 
            className={`btn-control-toggle`} 
            style={{ padding: "0.4rem 0.8rem", borderRadius: "8px", fontSize: "0.8rem", background: rangeType === "monthly" ? "var(--btn-gradient)" : "transparent", border: 0 }}
            onClick={() => setRangeType("monthly")}
          >
            Monthly
          </button>
          <button 
            className={`btn-control-toggle`} 
            style={{ padding: "0.4rem 0.8rem", borderRadius: "8px", fontSize: "0.8rem", background: rangeType === "custom" ? "var(--btn-gradient)" : "transparent", border: 0 }}
            onClick={() => setRangeType("custom")}
          >
            Custom Range
          </button>
        </div>
      </div>

      {/* Custom Date Picker Inputs */}
      {rangeType === "custom" && (
        <div className="settings-row-glass" style={{ margin: "1rem 0", display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap", padding: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <label htmlFor="start-date-picker" style={{ fontSize: "0.75rem", opacity: 0.7, fontWeight: 600 }}>Start Date</label>
            <input 
              id="start-date-picker"
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              style={{ background: "rgba(7, 17, 31, 0.6)", border: "1px solid var(--border-glass)", padding: "0.4rem 0.8rem", borderRadius: "8px", color: "#fff" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <label htmlFor="end-date-picker" style={{ fontSize: "0.75rem", opacity: 0.7, fontWeight: 600 }}>End Date</label>
            <input 
              id="end-date-picker"
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              style={{ background: "rgba(7, 17, 31, 0.6)", border: "1px solid var(--border-glass)", padding: "0.4rem 0.8rem", borderRadius: "8px", color: "#fff" }}
            />
          </div>
          <div style={{ marginTop: "1rem" }}>
            <p style={{ fontSize: "0.8rem", color: "var(--text-glow)" }}>
              📅 Report Range: <strong>{startDate}</strong> to <strong>{endDate}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Select Which App Report */}
      <div className="settings-row-glass" style={{ margin: "1rem 0", display: "flex", gap: "1rem", alignItems: "center", padding: "1rem", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "200px" }}>
          <h4 style={{ margin: "0 0 0.2rem 0" }}>Report Target Application</h4>
          <p className="sidebar-copy">Select an application or website to view specific logs, pages, and daily trends.</p>
        </div>
        <div>
          <select
            aria-label="Select App for Report"
            value={selectedApp}
            onChange={(e) => setSelectedApp(e.target.value)}
            style={{ 
              background: "rgba(14, 22, 38, 0.8)", 
              border: "1px solid var(--border-glass)", 
              padding: "0.6rem 1.2rem", 
              borderRadius: "10px", 
              color: "#fff",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            <option value="all">📁 All Apps & Websites</option>
            {topAppsList.map(app => (
              <option key={app.name} value={app.name}>
                {app.name} ({formatDuration(app.seconds)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="settings-row-glass danger-border" style={{ margin: "1rem 0", color: "#ef4444" }}>
          {error}
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="stats-row" style={{ marginTop: "1.5rem" }}>
        <div className="stat-card-glass">
          <span>Total Usage Duration</span>
          <h3>{formatDuration(totalSeconds)}</h3>
        </div>
        <div className="stat-card-glass">
          <span>Active Sessions Count</span>
          <h3>{sessionCount} sessions</h3>
        </div>
        <div className="stat-card-glass">
          <span>Report Level Focus Score</span>
          <h3>{currentFocusScore !== null ? `${currentFocusScore}%` : "N/A"}</h3>
        </div>

        {selectedApp !== "all" && selectedAppCategory && (
          <div className="stat-card-glass">
            <span>Category & Settings</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.5rem" }}>
              <span className={`category-pill-select ${selectedAppCategory}`} style={{ width: "fit-content", display: "inline-block" }}>
                {selectedAppCategory === "Productive" ? "🟢 Productive" : selectedAppCategory === "Distracting" ? "🔴 Distracting" : "🟡 Neutral"}
              </span>
              <div style={{ display: "flex", gap: "0.2rem" }}>
                <button 
                  style={{ border: 0, background: "rgba(16, 185, 129, 0.1)", color: "#10b981", padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "0.7rem", cursor: "pointer", fontWeight: 600 }}
                  onClick={() => handleUpdateCategory(selectedApp, "Productive")}
                >
                  Prod
                </button>
                <button 
                  style={{ border: 0, background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "0.7rem", cursor: "pointer", fontWeight: 600 }}
                  onClick={() => handleUpdateCategory(selectedApp, "Neutral")}
                >
                  Neut
                </button>
                <button 
                  style={{ border: 0, background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", padding: "0.25rem 0.5rem", borderRadius: "4px", fontSize: "0.7rem", cursor: "pointer", fontWeight: 600 }}
                  onClick={() => handleUpdateCategory(selectedApp, "Distracting")}
                >
                  Dist
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Charts Side-by-Side */}
      {dailyTrendData.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "1.5rem", marginTop: "2rem" }}>
          
          {/* Daily Trend Chart */}
          <div className="option-card-glass" style={{ padding: "1.5rem" }}>
            <h4 style={{ marginBottom: "1rem" }}>📅 Daily Activity Progression</h4>
            <div className="chart-wrap" style={{ height: "260px" }}>
              <ResponsiveContainer width="100%" height="100%">
                {selectedApp === "all" ? (
                  <BarChart data={dailyTrendData}>
                    <CartesianGrid stroke="#263447" vertical={false} />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={formatTooltipMinutes} />
                    <Tooltip formatter={formatTooltipMinutes} />
                    <Bar dataKey="Productive" name="Productive" fill="#10b981" stackId="a" />
                    <Bar dataKey="Neutral" name="Neutral" fill="#6b7280" stackId="a" />
                    <Bar dataKey="Distracting" name="Distracting" fill="#ef4444" stackId="a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <AreaChart data={dailyTrendData}>
                    <defs>
                      <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={selectedAppCategory === "Productive" ? "#10b981" : selectedAppCategory === "Distracting" ? "#ef4444" : "#f59e0b"} stopOpacity={0.4}/>
                        <stop offset="95%" stopColor={selectedAppCategory === "Productive" ? "#10b981" : selectedAppCategory === "Distracting" ? "#ef4444" : "#f59e0b"} stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#263447" vertical={false} />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={formatTooltipMinutes} />
                    <Tooltip formatter={formatTooltipMinutes} />
                    <Area 
                      type="monotone" 
                      dataKey="total" 
                      name="Active Minutes" 
                      stroke={selectedAppCategory === "Productive" ? "#10b981" : selectedAppCategory === "Distracting" ? "#ef4444" : "#f59e0b"} 
                      fillOpacity={1} 
                      fill="url(#colorDuration)" 
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Hourly Rhythm Chart */}
          <div className="option-card-glass" style={{ padding: "1.5rem" }}>
            <h4 style={{ marginBottom: "1rem" }}>🕒 Hourly Distribution Heatmap</h4>
            <div className="chart-wrap" style={{ height: "260px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyDistData}>
                  <CartesianGrid stroke="#263447" vertical={false} />
                  <XAxis dataKey="hour" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip formatter={(val) => `${val} min`} />
                  <Bar dataKey="Duration" name="Duration (minutes)" fill="var(--text-glow)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Pages/Window Titles Breakdown */}
      <div style={{ marginTop: "2rem" }}>
        <h3>📄 Detailed Breakdown & Page History</h3>
        <p className="sidebar-copy" style={{ marginBottom: "1rem" }}>
          Specific tasks, tab titles, or documents visited inside {selectedApp === "all" ? "your system" : <strong>{selectedApp}</strong>} during the selected period.
        </p>

        <div className="app-list-container">
          {pageTitles.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", opacity: 0.6 }}>No tracking data recorded for this target.</div>
          ) : (
            <div className="app-table-grid" style={{ background: "rgba(14, 22, 38, 0.4)", borderRadius: "20px", padding: "1rem", border: "1px solid var(--border-glass)" }}>
              <div className="app-table-header" style={{ gridTemplateColumns: "auto 3fr 1fr", padding: "0.5rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span>Icon</span>
                <span>Page Window Title</span>
                <span style={{ textAlign: "right" }}>Spent Time</span>
              </div>
              
              {pageTitles.slice(0, 100).map((item, idx) => (
                <div key={idx} className="app-table-row" style={{ gridTemplateColumns: "auto 3fr 1fr", padding: "0.8rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                  <span style={{ display: "flex", alignItems: "center" }}>
                    <AppIcon appName={selectedApp === "all" ? item.title : selectedApp} size={20} />
                  </span>
                  <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.title}>
                    {item.title}
                  </span>
                  <span style={{ textAlign: "right", fontWeight: 600, color: "var(--text-glow)" }}>
                    {formatDuration(item.seconds)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
