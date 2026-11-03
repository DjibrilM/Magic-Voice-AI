import "./init-env";
import { app, BrowserWindow, protocol } from "electron";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import path from "node:path";
import fs from "node:fs";
import { bootstrapCore } from "./core";

// Register custom protocol scheme for audio/media before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: "echo-media",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true,
    },
  },
]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

// Bootstrap all modular core services & controllers with dependency injection
export const core = bootstrapCore();

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    trafficLightPosition: { x: 14, y: 12 },
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
    },
  });

  // Forward renderer console logs to main terminal output for immediate visibility
  win.webContents.on("console-message", (event: any, ...args: any[]) => {
    if (typeof event === "object" && event !== null && "message" in event) {
      const src = event.sourceId ? path.basename(event.sourceId) : "renderer";
      console.log(`[Renderer ${src}:${event.lineNumber}] ${event.message}`);
    } else {
      const [_level, message, line, sourceId] = args;
      const src = sourceId ? path.basename(sourceId) : "renderer";
      console.log(`[Renderer ${src}:${line}] ${message}`);
    }
  });

  win.webContents.on("render-process-gone", (_event, details) => {
    console.error("[Renderer Crashed]:", details);
  });

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  // Handle echo-media:// protocol for high-performance direct streaming of audio files from disk
  protocol.handle("echo-media", async (request) => {
    try {
      const raw = request.url.replace(/^echo-media:\/\//, "");
      let filePath = decodeURIComponent(raw.startsWith("/") ? raw : "/" + raw);
      if (process.platform === "win32" && filePath.startsWith("/")) {
        filePath = filePath.slice(1);
      }
      if (!fs.existsSync(filePath)) {
        return new Response("Media not found", { status: 404 });
      }
      const total = fs.statSync(filePath).size;
      const contentType = filePath.endsWith(".mp3")
        ? "audio/mpeg"
        : filePath.endsWith(".wav")
          ? "audio/wav"
          : "application/octet-stream";
      const headers = new Headers({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Accept-Ranges": "bytes",
        "Content-Type": contentType,
      });

      // Explicit Range support so the media element knows true length & can seek
      const rangeHeader = request.headers.get("range");
      const match = rangeHeader ? /bytes=(\d*)-(\d*)/.exec(rangeHeader) : null;
      let start = 0;
      let end = total - 1;
      let status = 200;
      if (match && (match[1] !== "" || match[2] !== "")) {
        if (match[1] === "") {
          start = Math.max(0, total - parseInt(match[2], 10));
        } else {
          start = parseInt(match[1], 10);
          if (match[2] !== "") end = Math.min(end, parseInt(match[2], 10));
        }
        if (start >= total || start > end) {
          headers.set("Content-Range", `bytes */${total}`);
          return new Response(null, { status: 416, headers });
        }
        status = 206;
        headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
      }
      headers.set("Content-Length", String(end - start + 1));

      if (request.method === "HEAD") {
        return new Response(null, { status, headers });
      }
      const stream = Readable.toWeb(
        fs.createReadStream(filePath, { start, end }),
      ) as unknown as ReadableStream;
      return new Response(stream, { status, headers });
    } catch (err) {
      console.error("[echo-media protocol] Error loading media:", err);
      return new Response("Error loading media", { status: 500 });
    }
  });

  createWindow();
});

console.log("Electron:", process.versions.electron);
console.log("Chromium:", process.versions.chrome);

