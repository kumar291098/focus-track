interface AppIconProps {
  appName: string;
  className?: string;
  size?: number;
}

export default function AppIcon({ appName, className = "", size = 20 }: AppIconProps) {
  const normalized = appName.toLowerCase().trim();

  // 1. Check if website domain is inside parentheses (e.g., "Google Chrome (github.com)")
  const match = appName.match(/\(([^)]+)\)/);
  if (match && match[1]) {
    const domain = match[1].trim();
    // Load favicon from Google service
    return (
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
        alt={`${domain} icon`}
        className={className}
        style={{ width: size, height: size, borderRadius: '4px', objectFit: 'cover', display: 'inline-block', verticalAlign: 'middle' }}
        onError={(e) => {
          // Fallback to globe emoji if image fails
          const img = e.target as HTMLImageElement;
          const span = document.createElement('span');
          span.textContent = '🌐';
          span.style.fontSize = `${size * 0.85}px`;
          span.style.display = 'inline-block';
          span.style.verticalAlign = 'middle';
          img.parentNode?.replaceChild(span, img);
        }}
      />
    );
  }

  // 2. Map standard apps to beautiful visual emoji indicators
  let emoji = "📦"; // Default app
  
  if (normalized.includes("visual studio code") || normalized.includes("code") || normalized.includes("idea") || normalized.includes("webstorm") || normalized.includes("pycharm")) {
    emoji = "💻"; // Coding editors
  } else if (normalized.includes("terminal") || normalized.includes("powershell") || normalized.includes("cmd") || normalized.includes("bash")) {
    emoji = "⚡"; // Terminal
  } else if (normalized.includes("spotify") || normalized.includes("music") || normalized.includes("itunes")) {
    emoji = "🎵"; // Audio
  } else if (normalized.includes("discord") || normalized.includes("slack") || normalized.includes("teams") || normalized.includes("telegram") || normalized.includes("whatsapp")) {
    emoji = "💬"; // Chat
  } else if (normalized.includes("browser") || normalized.includes("chrome") || normalized.includes("edge") || normalized.includes("brave") || normalized.includes("firefox")) {
    emoji = "🌐"; // Browser fallback
  } else if (normalized.includes("idle") || normalized.includes("away")) {
    emoji = "💤"; // Inactivity
  } else if (normalized.includes("notion") || normalized.includes("word") || normalized.includes("excel") || normalized.includes("office") || normalized.includes("notes")) {
    emoji = "📝"; // Productivity documents
  } else if (normalized.includes("postman") || normalized.includes("insomnia") || normalized.includes("fiddler")) {
    emoji = "🚀"; // Developer tools
  } else if (normalized.includes("settings") || normalized.includes("control panel") || normalized.includes("system")) {
    emoji = "⚙️"; // Configuration
  } else if (normalized.includes("explorer") || normalized.includes("finder") || normalized.includes("files")) {
    emoji = "📁"; // Files
  }

  return (
    <span className="app-icon-emoji" style={{ fontSize: `${size * 0.85}px`, display: 'inline-block', verticalAlign: 'middle', width: size, height: size, textAlign: 'center', lineHeight: `${size}px` }}>
      {emoji}
    </span>
  );
}
