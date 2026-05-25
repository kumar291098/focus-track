interface OverrideItem {
  appName: string;
  category: string;
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

interface SettingsTabProps {
  trackingStatus: TrackingStatus | null;
  handleToggleTracking: () => void;
  pollIntervalSec: string;
  setPollIntervalSec: (sec: string) => void;
  idleThresholdSec: string;
  setIdleThresholdSec: (sec: string) => void;
  handleSaveSettings: () => void;
  handleClearDatabase: () => void;
  autostart: boolean;
  handleToggleAutostart: () => void;
  appCategoriesOverrides: OverrideItem[];
  handleDeleteOverride: (appName: string) => void;
}

export default function SettingsTab({
  trackingStatus,
  handleToggleTracking,
  pollIntervalSec,
  setPollIntervalSec,
  idleThresholdSec,
  setIdleThresholdSec,
  handleSaveSettings,
  handleClearDatabase,
  autostart,
  handleToggleAutostart,
  appCategoriesOverrides,
  handleDeleteOverride
}: SettingsTabProps) {
  return (
    <article className="panel wide">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Preferences & Settings</p>
          <h2>Configuration Console</h2>
        </div>
      </div>

      <div className="settings-section">
        <h3>Tracking Control</h3>
        <div className="settings-row-glass">
          <div>
            <h4>Status: {trackingStatus?.isTracking ? "🟢 Online" : "🔴 Suspended"}</h4>
            <p className="sidebar-copy">Temporarily stop time tracking on the system. All current sessions will be immediately saved.</p>
          </div>
          <button 
            className={`btn-control-toggle ${trackingStatus?.isTracking ? 'danger' : 'success'}`} 
            onClick={handleToggleTracking}
          >
            {trackingStatus?.isTracking ? "Pause Tracking" : "Start Tracking"}
          </button>
        </div>

        <h3>System Integration</h3>
        <div className="settings-row-glass">
          <div>
            <h4>Autostart FocusTrack: {autostart ? "Enabled" : "Disabled"}</h4>
            <p className="sidebar-copy">Automatically launch FocusTrack when your computer starts up.</p>
          </div>
          <button 
            className={`btn-control-toggle ${autostart ? 'danger' : 'success'}`} 
            onClick={handleToggleAutostart}
          >
            {autostart ? "Disable Autostart" : "Enable Autostart"}
          </button>
        </div>

        <h3>Poll & Inactivity Thresholds</h3>
        <div className="settings-grid-options">
          <div className="option-card-glass">
            <label htmlFor="poll-interval-input">Window Poll Interval (seconds)</label>
            <p>How frequently FocusTrack checks for the active foreground window. Lower values provide finer detail but perform more read queries.</p>
            <input
              id="poll-interval-input"
              type="number"
              min="1"
              max="60"
              value={pollIntervalSec}
              onChange={(e) => setPollIntervalSec(e.target.value)}
            />
          </div>

          <div className="option-card-glass">
            <label htmlFor="idle-threshold-input">Away Idle Trigger (seconds)</label>
            <p>Inactivity duration before the tracker marks your state as "Idle / Away". Triggers when there is no keyboard/mouse input.</p>
            <input
              id="idle-threshold-input"
              type="number"
              min="10"
              max="3600"
              value={idleThresholdSec}
              onChange={(e) => setIdleThresholdSec(e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
          <button className="btn-action-save" onClick={handleSaveSettings}>Save Parameters</button>
        </div>

        {appCategoriesOverrides.length > 0 && (
          <>
            <h3>Custom App Categorizations</h3>
            <div className="app-list-container">
              <div className="app-table-grid" style={{ background: 'rgba(14, 22, 38, 0.4)', borderRadius: '20px', padding: '1rem', border: '1px solid var(--border-glass)' }}>
                <div className="app-table-header" style={{ gridTemplateColumns: '2fr 1fr 1fr', padding: '0.5rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span>App / Website</span>
                  <span>Category</span>
                  <span style={{ textAlign: 'right' }}>Action</span>
                </div>
                {appCategoriesOverrides.map((item) => (
                  <div key={item.appName} className="app-table-row" style={{ gridTemplateColumns: '2fr 1fr 1fr', padding: '0.8rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <span style={{ fontWeight: 500 }}>{item.appName}</span>
                    <span>
                      <span className={`category-pill-select ${item.category}`} style={{ display: 'inline-block', textAlign: 'center', width: 'auto' }}>
                        {item.category === "Productive" ? "🟢 Productive" : item.category === "Distracting" ? "🔴 Distracting" : "🟡 Neutral"}
                      </span>
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      <button 
                        style={{ border: 0, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                        onClick={() => handleDeleteOverride(item.appName)}
                      >
                        Reset
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <h3 style={{ marginTop: '2.5rem', color: '#ef4444' }}>Danger Zone</h3>
        <div className="settings-row-glass danger-border">
          <div>
            <h4 style={{ color: '#ef4444' }}>Clear All Database History</h4>
            <p className="sidebar-copy">Permanently delete all tracked app usage and system idle logs. Overrides and app categories will be kept, but activities are destroyed.</p>
          </div>
          <button className="btn-action-danger" onClick={handleClearDatabase}>Wipe Database</button>
        </div>
      </div>
    </article>
  );
}
