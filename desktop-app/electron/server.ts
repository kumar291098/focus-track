import http from "node:http";

interface WebActivity {
  domain: string;
  title: string;
  timestamp: number;
}

let latestActivity: WebActivity | null = null;
let server: http.Server | null = null;

export function startServer(port = 5012) {
  if (server) {
    return;
  }

  server = http.createServer((req, res) => {
    // Add CORS headers so chrome extension can send requests
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "POST" && req.url === "/activity") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", () => {
        try {
          const data = JSON.parse(body);
          if (data.url) {
            let domain = "";
            try {
              const urlObj = new URL(data.url);
              domain = urlObj.hostname;
              // strip www.
              if (domain.startsWith("www.")) {
                domain = domain.substring(4);
              }
            } catch (e) {
              domain = data.url;
            }

            latestActivity = {
              domain,
              title: data.title || "",
              timestamp: Date.now()
            };
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(port, () => {
    // Log message
  });
}

export function stopServer() {
  if (server) {
    server.close();
    server = null;
  }
}

export function getLatestWebActivity() {
  return latestActivity;
}
