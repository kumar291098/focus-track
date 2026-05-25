import AppIcon from "./IconResolver";

interface AppDetailItem {
  name: string;
  seconds: number;
  category: string;
  windowTitles: Array<{ title: string; seconds: number }>;
  sessionCount: number;
}

interface AppsTabProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  categoryFilter: string;
  setCategoryFilter: (filter: string) => void;
  sortBy: 'duration' | 'name';
  setSortBy: (sort: 'duration' | 'name') => void;
  activeRange: 'today' | 'weekly' | 'all';
  setActiveRange: (range: 'today' | 'weekly' | 'all') => void;
  processedDetailedApps: AppDetailItem[];
  expandedApps: Record<string, boolean>;
  toggleExpandApp: (appName: string) => void;
  handleUpdateCategory: (appName: string, category: string) => void;
  totalActiveTime: number;
  formatDuration: (secs: number) => string;
}

export default function AppsTab({
  searchTerm,
  setSearchTerm,
  categoryFilter,
  setCategoryFilter,
  sortBy,
  setSortBy,
  activeRange,
  setActiveRange,
  processedDetailedApps,
  expandedApps,
  toggleExpandApp,
  handleUpdateCategory,
  totalActiveTime,
  formatDuration
}: AppsTabProps) {
  return (
    <article className="panel wide">
      <div className="panel-header-row">
        <div>
          <p className="eyebrow">Detailed Analysis</p>
          <h2>System & App Usage</h2>
        </div>
        <div className="filter-controls">
          <div className="range-selector">
            <button className={`range-btn ${activeRange === 'today' ? 'active' : ''}`} onClick={() => setActiveRange('today')}>Today</button>
            <button className={`range-btn ${activeRange === 'weekly' ? 'active' : ''}`} onClick={() => setActiveRange('weekly')}>Last 7 Days</button>
            <button className={`range-btn ${activeRange === 'all' ? 'active' : ''}`} onClick={() => setActiveRange('all')}>All Time</button>
          </div>
          
          <input
            type="text"
            placeholder="Search app or title..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          <select
            className="filter-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="All">All Categories</option>
            <option value="Productive">Productive Only</option>
            <option value="Neutral">Neutral Only</option>
            <option value="Distracting">Distracting Only</option>
          </select>

          <select
            className="filter-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'duration' | 'name')}
          >
            <option value="duration">Sort: Active Time</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>
      </div>

      <div className="app-list-container">
        {processedDetailedApps.length > 0 ? (
          <div className="app-table-grid">
            <div className="app-table-header">
              <span>App Name</span>
              <span>Category</span>
              <span>Sessions</span>
              <span>Time Spent</span>
              <span>Activity Share</span>
            </div>
            {processedDetailedApps.map((app) => {
              const pct = totalActiveTime > 0 ? Math.round((app.seconds / totalActiveTime) * 100) : 0;
              const isExpanded = !!expandedApps[app.name];
              return (
                <div key={app.name} className={`app-table-row-group ${isExpanded ? 'expanded' : ''}`}>
                  <div className="app-table-row" onClick={() => toggleExpandApp(app.name)}>
                    <div className="app-identity-col">
                      <span className="expand-chevron">{isExpanded ? "▼" : "▶"}</span>
                      <AppIcon appName={app.name} size={18} />
                      <span className="app-name-label">{app.name}</span>
                      {app.name === "Idle / Away" && <span className="idle-pill">Idle</span>}
                    </div>
                    
                    <div className="app-category-col" onClick={(e) => e.stopPropagation()}>
                      <select
                        className={`category-pill-select ${app.category}`}
                        value={app.category}
                        onChange={(e) => handleUpdateCategory(app.name, e.target.value)}
                      >
                        <option value="Productive">🟢 Productive</option>
                        <option value="Neutral">🟡 Neutral</option>
                        <option value="Distracting">🔴 Distracting</option>
                      </select>
                    </div>

                    <div className="app-sessions-col">{app.sessionCount}</div>

                    <div className="app-time-col"><strong>{formatDuration(app.seconds)}</strong></div>

                    <div className="app-pct-col">
                      <div className="progress-bar-container">
                        <div className={`progress-bar-fill ${app.category}`} style={{ width: `${pct}%` }} />
                        <span className="progress-label-pct">{pct}%</span>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="app-window-details-drawer">
                      <h4>Tracked window titles for this app:</h4>
                      <ul>
                        {app.windowTitles.map((w, idx) => (
                          <li key={idx} className="window-title-item">
                            <span className="window-title-text">{w.title}</span>
                            <span className="window-title-duration">{formatDuration(w.seconds)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-results">
            <p>No applications match your search query or filters.</p>
          </div>
        )}
      </div>
    </article>
  );
}
