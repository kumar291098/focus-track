import codingHelpLogo from "../assets/codinghelp-logo.jpg";

export default function LoadingScreen({
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
        <img className="loading-logo" src={codingHelpLogo} alt="FocusTrack logo" />
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
