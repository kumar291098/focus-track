import codingHelpLogo from "../assets/codinghelp-logo.jpg";
import { useEffect, useState } from "react";

export default function LoadingScreen({
  title,
  message,
  tone = "loading"
}: {
  title: string;
  message: string;
  tone?: "loading" | "error";
}) {
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Initializing FocusTrack...");

  useEffect(() => {
    if (tone === "error") return;

    // Simulate progress from 0% to 100% over 2.5 seconds
    const startTime = Date.now();
    const duration = 2500; 

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const computed = Math.min(Math.floor((elapsed / duration) * 100), 99);
      setProgress(computed);

      // Update status messages dynamically in sync with progress
      if (computed < 20) {
        setStatusMessage("Connecting to system database...");
      } else if (computed < 45) {
        setStatusMessage("Initializing SQLite schemas...");
      } else if (computed < 70) {
        setStatusMessage("Starting background window tracker...");
      } else if (computed < 90) {
        setStatusMessage("Loading today's tracked sessions...");
      } else {
        setStatusMessage("Finalizing dashboard view...");
      }
    }, 50);

    return () => clearInterval(interval);
  }, [tone]);

  // Sync step states to specific percentage thresholds
  const step1Active = progress >= 0;
  const step1Done = progress > 35;
  
  const step2Active = progress >= 35;
  const step2Done = progress > 70;
  
  const step3Active = progress >= 70;
  const step3Done = progress >= 95;

  return (
    <main className={`loading-screen ${tone}`}>
      {/* Premium ambient glows */}
      <div className="boot-glow-1"></div>
      <div className="boot-glow-2"></div>

      <div className="loading-card">
        <div className="loading-logo-container">
          <img className="loading-logo" src={codingHelpLogo} alt="FocusTrack logo" />
          <div className="pulse-ring" />
          <div className="pulse-ring ring-delay-1" />
          <div className="pulse-ring ring-delay-2" />
        </div>
        <p className="eyebrow loading-brand-tag">FocusTrack v1.0.1</p>
        <h1 className="loading-title">{title}</h1>
        <p className="loading-desc">{message}</p>
        
        {tone === "loading" && (
          <>
            {/* Interactive Progress Bar */}
            <div className="progress-interactive-container">
              <div className="progress-interactive-header">
                <span className="progress-interactive-status">{statusMessage}</span>
                <span className="progress-interactive-percent">{progress}%</span>
              </div>
              <div className="progress-interactive-bar">
                <div 
                  className="progress-interactive-fill" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>

            {/* List of Tasks */}
            <div className="loading-steps">
              <div className={`step-item ${step1Active ? 'active' : ''} ${step1Done ? 'done' : ''}`}>
                <span className="step-bullet">{step1Done ? "✓" : "⚡"}</span>
                <span className="step-text">Starting desktop tracker</span>
              </div>
              <div className={`step-item ${step2Active ? 'active' : ''} ${step2Done ? 'done' : ''}`}>
                <span className="step-bullet">{step2Done ? "✓" : step2Active ? "⚡" : "○"}</span>
                <span className="step-text">Opening SQLite database</span>
              </div>
              <div className={`step-item ${step3Active ? 'active' : ''} ${step3Done ? 'done' : ''}`}>
                <span className="step-bullet">{step3Done ? "✓" : step3Active ? "⚡" : "○"}</span>
                <span className="step-text">Preparing focus dashboard</span>
              </div>
            </div>
          </>
        )}

        {tone === "error" && (
          <div className="loading-error-action">
            <span className="error-icon">⚠️</span>
            <p>Please launch the desktop tracker application first, or check the terminal logs.</p>
          </div>
        )}
      </div>
    </main>
  );
}
