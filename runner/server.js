// macランナー上で動く: スクショ配信 + タップ等の入力受付 + cloudflaredトンネル
const { execFile, spawn, execFileSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const { WebSocketServer } = require("ws");

const UDID = process.env.UDID, SESSION = process.env.SESSION;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (cmd, args) => new Promise((res) => execFile(cmd, args, () => res()));

let chain = Promise.resolve();
const idb = (...a) => (chain = chain.then(() => run("idb", [...a, "--udid", UDID])));

(async () => {
  spawn("idb_companion", ["--udid", UDID], { stdio: "ignore" });
  await sleep(4000);
  await run("idb", ["connect", "localhost", "10880"]);

  let sw = 393, sh = 852; // points (取得できなければ仮値)
  try {
    const d = JSON.parse(execFileSync("idb", ["describe", "--json", "--udid", UDID]).toString());
    sw = d.screen_dimensions.width_points; sh = d.screen_dimensions.height_points;
  } catch (e) { console.log("describe failed", e.message); }

  const server = http.createServer((q, s) => s.end("ok"));
  const wss = new WebSocketServer({ server });
  let stopped = false;
  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "info", w: sw, h: sh }));
    ws.on("message", async (m) => {
      const e = JSON.parse(m.toString());
      const X = (v) => String(Math.round(v * sw)), Y = (v) => String(Math.round(v * sh));
      if (e.type === "tap") idb("ui", "tap", X(e.x), Y(e.y));
      else if (e.type === "swipe") idb("ui", "swipe", X(e.x), Y(e.y), X(e.x2), Y(e.y2), "--duration", String(e.d || 0.3));
      else if (e.type === "text") idb("ui", "text", e.text);
      else if (e.type === "button") idb("ui", "button", e.name);
      else if (e.type === "stop") { stopped = true; process.exit(0); }
    });
  });
  server.listen(8080);

  const t = spawn("cloudflared", ["tunnel", "--url", "http://localhost:8080"]);
  const onData = (b) => {
    const m = b.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m && !onData.done) {
      onData.done = true;
      const content = Buffer.from(JSON.stringify({ url: m[0].replace("https", "wss") })).toString("base64");
      execFileSync("gh", ["api", "-X", "PUT", `repos/${process.env.GITHUB_REPOSITORY}/contents/sessions/${SESSION}.json`,
        "-f", "message=session", "-f", `content=${content}`]);
      console.log("session published");
    }
  };
  t.stdout.on("data", onData); t.stderr.on("data", onData);

  // フレームループ (simctl screenshot)
  while (!stopped) {
    if (wss.clients.size === 0) { await sleep(300); continue; }
    await run("xcrun", ["simctl", "io", UDID, "screenshot", "--type=jpeg", "/tmp/f.jpg"]);
    try {
      const buf = fs.readFileSync("/tmp/f.jpg");
      wss.clients.forEach((c) => c.readyState === 1 && c.send(buf));
    } catch (e) {}
  }
})();
