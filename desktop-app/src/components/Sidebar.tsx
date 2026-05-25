import codingHelpLogo from "../assets/codinghelp-logo.jpg";

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

interface SidebarProps {
  activeTab: 'overview' | 'apps' | 'hourly' | 'weekly' | 'reports' | 'history' | 'settings';
  setActiveTab: (tab: 'overview' | 'apps' | 'hourly' | 'weekly' | 'reports' | 'history' | 'settings') => void;
  setActiveRange: (range: 'today' | 'weekly' | 'all') => void;
  version: string;
  trackingStatus: TrackingStatus | null;
  loadError: string | null;
  formatDuration: (secs: number) => string;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  setActiveRange,
  version,
  trackingStatus,
  loadError,
  formatDuration
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div>
        <div className="brand-lockup">
          <img
            className="brand-logo"
            src={codingHelpLogo}
            alt="FocusTrack logo"
          />
          <div>
            <p className="eyebrow">Privacy First</p>
            <h1>FocusTrack</h1>
          </div>
        </div>
        <p className="eyebrow">Local First Analytics</p>
        <p className="sidebar-copy">
          Securely tracking your desktop activities. All data is stored locally on your machine in a lightweight SQLite database.
        </p>
      </div>

      <nav className="nav">
        <button 
          className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} 
          onClick={() => { setActiveTab('overview'); setActiveRange('today'); }}
        >
          <span className="nav-icon">📊</span> Today Overview
        </button>
        <button 
          className={`nav-item ${activeTab === 'apps' ? 'active' : ''}`} 
          onClick={() => setActiveTab('apps')}
        >
          <span className="nav-icon">💻</span> App Usage
        </button>
        <button 
          className={`nav-item ${activeTab === 'hourly' ? 'active' : ''}`} 
          onClick={() => setActiveTab('hourly')}
        >
          <span className="nav-icon">🕒</span> Hourly Activity
        </button>
        <button 
          className={`nav-item ${activeTab === 'weekly' ? 'active' : ''}`} 
          onClick={() => setActiveTab('weekly')}
        >
          <span className="nav-icon">📅</span> Weekly Report
        </button>
        <button 
          className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`} 
          onClick={() => setActiveTab('reports')}
        >
          <span className="nav-icon">📈</span> Custom Reports
        </button>
        <button 
          className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} 
          onClick={() => setActiveTab('history')}
        >
          <span className="nav-icon">🗓️</span> History Log
        </button>
        <button 
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} 
          onClick={() => setActiveTab('settings')}
        >
          <span className="nav-icon">⚙️</span> Settings
        </button>
      </nav>

      <div className="status-card">
        <span className="status-label">Tracker Status (v{version})</span>
        <div className="status-header">
          <span className={`status-indicator ${trackingStatus?.isTracking ? 'online' : 'offline'}`} />
          <strong>{trackingStatus?.isTracking ? "Active" : "Paused"}</strong>
        </div>
        <p>
          {trackingStatus?.isTracking
            ? `Polling active window every ${trackingStatus.pollIntervalMs / 1000}s`
            : "Tracker is currently paused"}
        </p>
        {trackingStatus?.currentSession && trackingStatus.isTracking ? (
          <div className="current-tracking-bubble">
            <span className="eyebrow">Active App</span>
            <p className="active-app-name" title={trackingStatus.currentSession.appName}>{trackingStatus.currentSession.appName}</p>
            <span className="active-app-time">{formatDuration(trackingStatus.currentSession.durationSeconds)}</span>
          </div>
        ) : null}
        {loadError ? <p className="error-text">Error: {loadError}</p> : null}
      </div>
    </aside>
  );
}
