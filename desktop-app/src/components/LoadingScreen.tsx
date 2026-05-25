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
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (tone === "error") return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev < 2 ? prev + 1 : prev));
    }, 700);
    return () => clearInterval(interval);
  }, [tone]);

  return (
    <main className={`loading-screen ${tone}`}>
      <div className="loading-card">
        <div className="loading-logo-container">
          <img className="loading-logo" src={codingHelpLogo} alt="FocusTrack logo" />
          <div className="pulse-ring" />
          <div className="pulse-ring ring-delay-1" />
          <div className="pulse-ring ring-delay-2" />
        </div>
        <p className="eyebrow loading-brand-tag">FocusTrack v1.0.0</p>
        <h1 className="loading-title">{title}</h1>
        <p className="loading-desc">{message}</p>
        
        {tone === "loading" && (
          <div className="loading-steps">
            <div className={`step-item ${activeStep >= 0 ? 'active' : ''} ${activeStep > 0 ? 'done' : ''}`}>
              <span className="step-bullet">{activeStep > 0 ? "✓" : "⚡"}</span>
              <span className="step-text">Starting desktop tracker</span>
            </div>
            <div className={`step-item ${activeStep >= 1 ? 'active' : ''} ${activeStep > 1 ? 'done' : ''}`}>
              <span className="step-bullet">{activeStep > 1 ? "✓" : activeStep === 1 ? "⚡" : "○"}</span>
              <span className="step-text">Opening SQLite database</span>
            </div>
            <div className={`step-item ${activeStep >= 2 ? 'active' : ''}`}>
              <span className="step-bullet">{activeStep >= 2 ? "⚡" : "○"}</span>
              <span className="step-text">Preparing focus dashboard</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
