import { useEffect, useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import LoadingScreen from "./components/LoadingScreen";
import Sidebar from "./components/Sidebar";
import OverviewTab from "./components/OverviewTab";
import AppsTab from "./components/AppsTab";
import HourlyTab from "./components/HourlyTab";
import WeeklyTab from "./components/WeeklyTab";
import SettingsTab from "./components/SettingsTab";
import HistoryTab from "./components/HistoryTab";
import ReportsTab from "./components/ReportsTab";

declare global {
  interface Window {
    focusTrack?: {
      getAppVersion: () => Promise<string>;
      getDashboardSnapshot: (range?: string) => Promise<DashboardSnapshot>;
      getTrackingStatus: () => Promise<TrackingStatus | null>;
      toggleTracking: (start: boolean) => Promise<TrackingStatus | null>;
      getSettings: () => Promise<Record<string, string>>;
      saveSetting: (key: string, value: string) => Promise<boolean>;
      updateAppCategory: (appName: string, category: string) => Promise<boolean>;
      clearDatabase: () => Promise<boolean>;
      getLoginItemSettings: () => Promise<boolean>;
      setLoginItemSettings: (openAtLogin: boolean) => Promise<boolean>;
      getHistoryDates: () => Promise<{ days: string[]; months: string[] }>;
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

const PRODUCTIVE_APPS = new Set([
  "visual studio code",
  "code",
  "intellij idea",
  "webstorm",
  "pycharm",
  "terminal",
  "windows terminal",
  "postman",
  "notion"
]);

const DISTRACTING_APPS = new Set([
  "youtube",
  "netflix",
  "spotify",
  "discord",
  "facebook",
  "instagram",
  "twitter"
]);

const CATEGORY_COLORS: Record<string, string> = {
  Productive: "#10b981",
  Neutral: "#6b7280",
  Distracting: "#ef4444"
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
  if (totalSeconds === 0) return "0s";
  if (totalSeconds < 60) {
    return `${Math.max(0, Math.floor(totalSeconds))}s`;
  }

  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}m ${Math.floor(totalSeconds % 60)}s`;
  }
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatTooltipMinutes(value: unknown) {
  if (typeof value === "number") {
    return formatDuration(value);
  }
  return String(value);
}

function Dashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'apps' | 'hourly' | 'weekly' | 'reports' | 'history' | 'settings'>('overview');
  const [version, setVersion] = useState("loading...");
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(emptySnapshot);
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [autostart, setAutostart] = useState(false);
  
  // App usage view states
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState<'duration' | 'name'>('duration');
  const [expandedApps, setExpandedApps] = useState<Record<string, boolean>>({});
  const [activeRange, setActiveRange] = useState<'today' | 'weekly' | 'all'>('today');

  // Settings view states
  const [pollIntervalSec, setPollIntervalSec] = useState("5");
  const [idleThresholdSec, setIdleThresholdSec] = useState("60");

  // History view states
  const [historyDates, setHistoryDates] = useState<{ days: string[]; months: string[] }>({ days: [], months: [] });
  const [selectedHistoryDate, setSelectedHistoryDate] = useState("");
  const [historySnapshot, setHistorySnapshot] = useState<DashboardSnapshot>(emptySnapshot);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

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

    window.focusTrack
      .getLoginItemSettings()
      .then(setAutostart)
      .catch(() => setAutostart(false));

    window.focusTrack
      .getHistoryDates()
      .then((res) => {
        setHistoryDates(res);
        if (res.days && res.days.length > 0) {
          setSelectedHistoryDate(res.days[0]);
        }
      })
      .catch(console.error);
  }, []);

  // Refresh history dates list on tab activation
  useEffect(() => {
    if (activeTab === "history" && window.focusTrack) {
      window.focusTrack.getHistoryDates()
        .then(setHistoryDates)
        .catch(console.error);
    }
  }, [activeTab]);

  // Load selected history dates dashboard snapshots
  useEffect(() => {
    if (!window.focusTrack || !selectedHistoryDate || activeTab !== "history") {
      return;
    }

    setIsHistoryLoading(true);
    window.focusTrack.getDashboardSnapshot(selectedHistoryDate)
      .then(setHistorySnapshot)
      .catch(console.error)
      .finally(() => setIsHistoryLoading(false));
  }, [selectedHistoryDate, activeTab]);

  useEffect(() => {
    if (!window.focusTrack || activeTab === "history") {
      return;
    }

    const load = () => {
      const range = activeTab === 'weekly' ? 'weekly' : activeRange;
      
      Promise.all([
        window.focusTrack!.getDashboardSnapshot(range),
        window.focusTrack!.getTrackingStatus(),
        window.focusTrack!.getSettings()
      ])
        .then(([nextSnapshot, nextStatus, nextSettings]) => {
          setSnapshot(nextSnapshot);
          setTrackingStatus(nextStatus);
          setSettings(nextSettings);
          
          if (nextSettings.poll_interval_ms) {
            setPollIntervalSec(String(Number(nextSettings.poll_interval_ms) / 1000));
          }
          if (nextSettings.idle_threshold_seconds) {
            setIdleThresholdSec(nextSettings.idle_threshold_seconds);
          }

          setLoadError(nextStatus?.lastError ?? null);
        })
        .catch((error: unknown) => {
          setSnapshot(emptySnapshot);
          setTrackingStatus(null);
          setLoadError(
            error instanceof Error ? error.message : "Unable to load local activity data."
          );
        })
        .finally(() => {
          setIsLoading(false);
        });
    };

    load();
    const interval = window.setInterval(load, 1000);

    return () => window.clearInterval(interval);
  }, [activeTab, activeRange]);

  const getAppCategoryLocal = (appName: string) => {
    const key = `app_category:${appName.toLowerCase().trim()}`;
    if (settings && settings[key]) {
      return settings[key];
    }
    const normalized = appName.trim().toLowerCase();
    if (PRODUCTIVE_APPS.has(normalized)) return "Productive";
    if (DISTRACTING_APPS.has(normalized)) return "Distracting";
    return "Neutral";
  };

  const handleUpdateCategory = (appName: string, category: string) => {
    if (window.focusTrack) {
      window.focusTrack.updateAppCategory(appName, category)
        .then(() => {
          setSettings(prev => ({
            ...prev,
            [`app_category:${appName.toLowerCase().trim()}`]: category
          }));
        })
        .catch(console.error);
    }
  };

  const handleToggleTracking = () => {
    if (window.focusTrack && trackingStatus) {
      window.focusTrack.toggleTracking(!trackingStatus.isTracking)
        .then(setTrackingStatus)
        .catch(console.error);
    }
  };

  const handleToggleAutostart = () => {
    if (window.focusTrack) {
      window.focusTrack.setLoginItemSettings(!autostart)
        .then(setAutostart)
        .catch(console.error);
    }
  };

  const handleSaveSettings = () => {
    if (!window.focusTrack) return;
    const intervalMs = Math.max(1, Math.round(Number(pollIntervalSec))) * 1000;
    const idleSec = Math.max(10, Math.round(Number(idleThresholdSec)));

    Promise.all([
      window.focusTrack.saveSetting("poll_interval_ms", String(intervalMs)),
      window.focusTrack.saveSetting("idle_threshold_seconds", String(idleSec))
    ])
      .then(() => {
        alert("Settings saved successfully. Tracking settings refreshed!");
      })
      .catch(err => {
        alert("Error saving settings: " + (err instanceof Error ? err.message : String(err)));
      });
  };

  const handleClearDatabase = () => {
    if (!window.focusTrack) return;
    if (confirm("Are you absolutely sure you want to delete all activity tracking history? This action cannot be undone.")) {
      window.focusTrack.clearDatabase()
        .then(() => {
          alert("Database cleared successfully.");
        })
        .catch(err => {
          alert("Failed to clear database: " + (err instanceof Error ? err.message : String(err)));
        });
    }
  };

  const toggleExpandApp = (appName: string) => {
    setExpandedApps(prev => ({
      ...prev,
      [appName]: !prev[appName]
    }));
  };

  const handleDeleteOverride = (appName: string) => {
    if (window.focusTrack) {
      window.focusTrack.updateAppCategory(appName, "")
        .then(() => {
          setSettings(prev => {
            const next = { ...prev };
            delete next[`app_category:${appName.toLowerCase().trim()}`];
            return next;
          });
        })
        .catch(console.error);
    }
  };

  // Processing App Usage Data
  const appUsage = snapshot.topApps.map((item) => {
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

  // Compute Weekly Daily Trend
  const getWeeklyDailyTrend = () => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dailyMap = new Map<string, { label: string; dateStr: string; Productive: number; Neutral: number; Distracting: number; total: number }>();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayLabel = days[d.getDay()];
      dailyMap.set(dateStr, {
        label: dayLabel,
        dateStr,
        Productive: 0,
        Neutral: 0,
        Distracting: 0,
        total: 0
      });
    }

    snapshot.recentSessions.forEach(session => {
      const d = new Date(session.startTime);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      if (dailyMap.has(dateStr)) {
        const data = dailyMap.get(dateStr)!;
        const cat = getAppCategoryLocal(session.appName);
        
        data[cat as 'Productive' | 'Neutral' | 'Distracting'] += session.durationSeconds;
        data.total += session.durationSeconds;
      }
    });

    return [...dailyMap.values()];
  };

  const weeklyTrendData = getWeeklyDailyTrend();
  const productiveSec = categoriesMap.get("Productive") ?? 0;
  const distractingSec = categoriesMap.get("Distracting") ?? 0;
  const totalFocusDenominator = productiveSec + distractingSec;
  const focusScore = totalFocusDenominator > 0 ? Math.round((productiveSec / totalFocusDenominator) * 100) : 0;

  // Filtered and Sorted App List
  const processedDetailedApps = snapshot.topApps.map(item => {
    const sessions = snapshot.recentSessions.filter(s => s.appName === item.name);
    const windowMap = new Map<string, number>();
    
    sessions.forEach(s => {
      windowMap.set(s.windowTitle, (windowMap.get(s.windowTitle) ?? 0) + s.durationSeconds);
    });

    const windowTitles = [...windowMap.entries()]
      .map(([title, seconds]) => ({ title, seconds }))
      .sort((a, b) => b.seconds - a.seconds);

    const category = getAppCategoryLocal(item.name);

    return {
      name: item.name,
      seconds: item.seconds,
      category,
      windowTitles,
      sessionCount: sessions.length
    };
  })
  .filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.windowTitles.some(w => w.title.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = categoryFilter === "All" || app.category === categoryFilter;
    return matchesSearch && matchesCategory;
  })
  .sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    return b.seconds - a.seconds;
  });

  const appCategoriesOverrides = Object.entries(settings)
    .filter(([key]) => key.startsWith("app_category:") && key.split(":")[1])
    .map(([key, value]) => ({
      appName: key.replace("app_category:", ""),
      category: value
    }));

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
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setActiveRange={setActiveRange}
        version={version}
        trackingStatus={trackingStatus}
        loadError={loadError}
        formatDuration={formatDuration}
      />

      <main className="content">
        {activeTab === 'overview' && (
          <OverviewTab
            snapshot={snapshot}
            trackingStatus={trackingStatus}
            productiveSec={productiveSec}
            focusScore={focusScore}
            appUsage={appUsage}
            categoryUsageData={categoryUsageData}
            hasAppUsage={hasAppUsage}
            hasCategoryUsage={hasCategoryUsage}
            formatDuration={formatDuration}
            formatTooltipMinutes={formatTooltipMinutes}
          />
        )}

        {activeTab === 'apps' && (
          <AppsTab
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
            activeRange={activeRange}
            setActiveRange={setActiveRange}
            processedDetailedApps={processedDetailedApps}
            expandedApps={expandedApps}
            toggleExpandApp={toggleExpandApp}
            handleUpdateCategory={handleUpdateCategory}
            totalActiveTime={totalActiveTime}
            formatDuration={formatDuration}
          />
        )}

        {activeTab === 'hourly' && (
          <HourlyTab
            snapshot={snapshot}
            formatDuration={formatDuration}
            formatTooltipMinutes={formatTooltipMinutes}
          />
        )}

        {activeTab === 'weekly' && (
          <WeeklyTab
            weeklyTrendData={weeklyTrendData}
            formatDuration={formatDuration}
            formatTooltipMinutes={formatTooltipMinutes}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab
            historyDates={historyDates}
            selectedHistoryDate={selectedHistoryDate}
            setSelectedHistoryDate={setSelectedHistoryDate}
            historySnapshot={historySnapshot}
            isHistoryLoading={isHistoryLoading}
            formatDuration={formatDuration}
            formatTooltipMinutes={formatTooltipMinutes}
            getAppCategoryLocal={getAppCategoryLocal}
            handleUpdateCategory={handleUpdateCategory}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsTab
            formatDuration={formatDuration}
            formatTooltipMinutes={formatTooltipMinutes}
            getAppCategoryLocal={getAppCategoryLocal}
            handleUpdateCategory={handleUpdateCategory}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            trackingStatus={trackingStatus}
            handleToggleTracking={handleToggleTracking}
            pollIntervalSec={pollIntervalSec}
            setPollIntervalSec={setPollIntervalSec}
            idleThresholdSec={idleThresholdSec}
            setIdleThresholdSec={setIdleThresholdSec}
            handleSaveSettings={handleSaveSettings}
            handleClearDatabase={handleClearDatabase}
            autostart={autostart}
            handleToggleAutostart={handleToggleAutostart}
            appCategoriesOverrides={appCategoriesOverrides}
            handleDeleteOverride={handleDeleteOverride}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}
