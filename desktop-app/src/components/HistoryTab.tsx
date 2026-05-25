import { useState } from "react";
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
import AppIcon from "./IconResolver";
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

interface HistoryTabProps {
  historyDates: { days: string[]; months: string[] };
  selectedHistoryDate: string;
  setSelectedHistoryDate: (date: string) => void;
  historySnapshot: DashboardSnapshot;
  isHistoryLoading: boolean;
  formatDuration: (secs: number) => string;
  formatTooltipMinutes: (value: unknown) => string;
  getAppCategoryLocal: (appName: string) => string;
  handleUpdateCategory: (appName: string, category: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Productive: "#10b981",
  Neutral: "#6b7280",
  Distracting: "#ef4444"
};

export default function HistoryTab({
  historyDates,
  selectedHistoryDate,
  setSelectedHistoryDate,
  historySnapshot,
  isHistoryLoading,
  formatDuration,
  formatTooltipMinutes,
  getAppCategoryLocal,
  handleUpdateCategory
}: HistoryTabProps) {
  const [viewMode, setViewMode] = useState<'days' | 'months'>('days');

  const datesList = viewMode === 'days' ? historyDates.days : historyDates.months;

  // Process history top apps
  const appUsage = historySnapshot.topApps.map((item) => {
    const category = getAppCategoryLocal(item.name);
    return {
      name: item.name,
      seconds: item.seconds,
      color: category === "Productive" ? "#10b981" : category === "Distracting" ? "#ef4444" : "#f59e0b",
      category
    };
  });

  const categoriesMap = new Map<string, number>([
    ["Productive", 0],
    ["Neutral", 0],
    ["Distracting", 0]
  ]);

  let totalActiveTime = 0;
  appUsage.forEach(app => {
    totalActiveTime += app.seconds;
    categoriesMap.set(app.category, (categoriesMap.get(app.category) ?? 0) + app.seconds);
  });

  const categoryUsageData = [...categoriesMap.entries()].map(([name, value]) => ({
    name,
    value,
    color: CATEGORY_COLORS[name]
  }));

  const hasAppUsage = appUsage.some((item) => item.seconds > 0);
  const hasCategoryUsage = categoryUsageData.some((item) => item.value > 0);
  const hasHourlyUsage = historySnapshot.hourlyUsage.some(h => h.seconds > 0);

  const productiveSec = categoriesMap.get("Productive") ?? 0;
  const distractingSec = categoriesMap.get("Distracting") ?? 0;
  const totalFocusDenominator = productiveSec + distractingSec;
  const focusScore = totalFocusDenominator > 0 ? Math.round((productiveSec / totalFocusDenominator) * 100) : 0;

  // Format date heading label
  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return "Select a date";
    if (dateStr.length === 7) {
      const [year, month] = dateStr.split("-");
      const d = new Date(Number(year), Number(month) - 1, 1);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
    } else {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
  };

  return (
    <div className="history-tab-layout" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '2rem', height: 'calc(100vh - 6rem)', overflow: 'hidden' }}>
      
      {/* Left panel: list selector */}
      <div className="history-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderRight: '1px solid var(--border-glass)', paddingRight: '1.5rem', height: '100%', overflowY: 'auto' }}>
        <p className="eyebrow">History Browser</p>
        
        <div className="range-selector" style={{ width: '100%', display: 'flex' }}>
          <button 
            className={`range-btn ${viewMode === 'days' ? 'active' : ''}`} 
            style={{ flex: 1, textAlign: 'center' }} 
            onClick={() => { 
              setViewMode('days'); 
              if (historyDates.days.length > 0) setSelectedHistoryDate(historyDates.days[0]); 
            }}
          >
            Days
          </button>
          <button 
            className={`range-btn ${viewMode === 'months' ? 'active' : ''}`} 
            style={{ flex: 1, textAlign: 'center' }} 
            onClick={() => { 
              setViewMode('months'); 
              if (historyDates.months.length > 0) setSelectedHistoryDate(historyDates.months[0]); 
            }}
          >
            Months
          </button>
        </div>

        <div className="dates-scroller-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, overflowY: 'auto', paddingRight: '0.2rem' }}>
          {datesList.length > 0 ? (
            datesList.map((dateStr) => {
              const isActive = selectedHistoryDate === dateStr;
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedHistoryDate(dateStr)}
                  style={{
                    border: 0,
                    borderRadius: '12px',
                    padding: '0.75rem 1rem',
                    textAlign: 'left',
                    background: isActive ? 'var(--color-accent)' : 'rgba(255,255,255,0.02)',
                    color: isActive ? '#0b111e' : 'var(--text-main)',
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    fontSize: '0.9rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  className="history-date-item-btn"
                >
                  <span>{dateStr}</span>
                  <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>{viewMode === 'days' ? '📅' : '🗓️'}</span>
                </button>
              );
            })
          ) : (
            <p style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: '2rem', fontSize: '0.9rem' }}>No history records found.</p>
          )}
        </div>
      </div>

      {/* Right panel: details display */}
      <div className="history-details-container" style={{ height: '100%', overflowY: 'auto', paddingRight: '1rem' }}>
        {isHistoryLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '80%' }}>
            <div className="empty-orbit" />
            <p style={{ color: 'var(--text-muted)' }}>Retrieving historical records...</p>
          </div>
        ) : selectedHistoryDate ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Header Title */}
            <div>
              <p className="eyebrow">{viewMode === 'days' ? 'Day-wise Report' : 'Month-wise Report'}</p>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.2rem', fontWeight: 700 }}>
                {formatDateLabel(selectedHistoryDate)}
              </h2>
            </div>

            {/* Metrics cards */}
            <div className="stats-row">
              <div className="stat-card-glass">
                <span>Active Duration</span>
                <h3>{formatDuration(historySnapshot.todayTotalSeconds)}</h3>
              </div>
              <div className="stat-card-glass">
                <span>Productive Time</span>
                <h3 style={{ color: 'var(--color-productive)' }}>{formatDuration(productiveSec)}</h3>
              </div>
              <div className="stat-card-glass">
                <span>Focus Score</span>
                <h3 className={`score-badge ${focusScore > 70 ? 'high' : focusScore > 40 ? 'med' : 'low'}`}>{focusScore}%</h3>
              </div>
              <div className="stat-card-glass">
                <span>Sessions Count</span>
                <h3>{historySnapshot.sessionCount}</h3>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="stats-grid">
              {/* Top Apps List */}
              <article className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="panel-header">
                  <p className="eyebrow">Top Apps & Websites</p>
                  <h3>Time Breakdown</h3>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', flex: 1, overflowY: 'auto', maxHeight: '300px', paddingRight: '0.5rem' }}>
                  {hasAppUsage ? (
                    appUsage.slice(0, 15).map((app) => {
                      const pct = totalActiveTime > 0 ? Math.round((app.seconds / totalActiveTime) * 100) : 0;
                      return (
                        <div key={app.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                              <AppIcon appName={app.name} size={16} />
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }} title={app.name}>{app.name}</span>
                            </div>
                            <strong style={{ fontFamily: 'var(--font-heading)' }}>{formatDuration(app.seconds)}</strong>
                          </div>
                          <div style={{ height: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '99px', width: '100%', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: app.color, borderRadius: '99px' }} />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: '2rem' }}>No activity tracked.</p>
                  )}
                </div>
              </article>

              {/* Category mix */}
              <article className="panel">
                <div className="panel-header">
                  <p className="eyebrow">Focus Distribution</p>
                  <h3>Category Mix</h3>
                </div>

                <div className="chart-wrap" style={{ minHeight: '180px', height: '180px' }}>
                  {hasCategoryUsage ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryUsageData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={45}
                          outerRadius={70}
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
                    <EmptyChart message="No category mix available." />
                  )}
                </div>

                <div className="legend" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.6rem', marginTop: '0.5rem' }}>
                  {categoryUsageData.map((item) => (
                    <div key={item.name} className="legend-item" style={{ fontSize: '0.85rem' }}>
                      <span className="legend-swatch" style={{ backgroundColor: item.color }} />
                      <span>{item.name}</span>
                      <strong style={{ marginLeft: 'auto' }}>{formatDuration(item.value)}</strong>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            {/* Daily rhythm */}
            <article className="panel wide">
              <div className="panel-header">
                <p className="eyebrow">Rhythm Analytics</p>
                <h3>{viewMode === 'days' ? 'Hourly Activity Rhythm' : 'Average Monthly Hourly Rhythm'}</h3>
              </div>
              <div className="chart-wrap">
                {hasHourlyUsage ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={historySnapshot.hourlyUsage}>
                      <CartesianGrid stroke="#263447" vertical={false} />
                      <XAxis dataKey="hour" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={formatTooltipMinutes} />
                      <Tooltip formatter={formatTooltipMinutes} />
                      <Bar dataKey="seconds" fill="#2dd4bf" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart message="No hourly activity data." />
                )}
              </div>
            </article>

          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '80%', color: 'var(--text-dim)' }}>
            <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗓️</span>
            <strong>Select a history record</strong>
            <p style={{ maxWidth: '30ch', textAlign: 'center', marginTop: '0.5rem', fontSize: '0.85rem' }}>Select any date or month from the history panel on the left to review metrics.</p>
          </div>
        )}
      </div>

    </div>
  );
}
