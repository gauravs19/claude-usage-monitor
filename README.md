<div align="center">
  <img src="https://raw.githubusercontent.com/gauravs19/claude-usage-monitor/main/icon.png" width="128" />
  <h1>Claude Usage Monitor</h1>
  <p>Real-time Claude Code token usage, subscription rate limits, and session efficiency directly in the VS Code status bar.</p>

  <p>
    <a href="https://marketplace.visualstudio.com/items?itemName=gauravs19.claude-usage-monitor"><img src="https://img.shields.io/visual-studio-marketplace/v/gauravs19.claude-usage-monitor.svg?label=vs%20marketplace" alt="VS Marketplace Version"></a>
    <a href="https://marketplace.visualstudio.com/items?itemName=gauravs19.claude-usage-monitor"><img src="https://img.shields.io/visual-studio-marketplace/i/gauravs19.claude-usage-monitor.svg" alt="Installs"></a>
    <a href="https://github.com/gauravs19/claude-usage-monitor/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License"></a>
  </p>
</div>

---

**Claude Code is a powerful AI coding agent, but it gives you zero ambient visibility into its activity.** You can't see how much of your context window is consumed, whether you're approaching your 5-hour or 7-day rate limits, or what it's costing you. You are flying blind. **This extension fixes that.**

## ✨ Features

- **👁️ Status Bar (Always Visible)**: Instantly see context window limits (`ctx`), rate limits (`5h` and `7d`), token counts, or live tool execution status. Alerts you in yellow or red if your metrics pass 60% or 80%.
- **📊 Interactive Dashboard**: Open a rich webview panel to see today's token in/out summary, detailed cost estimates, and tool distribution metrics.
- **⚡ Session History & Filtering**: Filter a 14-day history of sessions by workspace so you don't lose track of past contexts.
- **🧠 Efficiency Analytics**: Track your Bash Error Rate (to catch AI thrashing), Context Efficiency, and Action Ratio (Reading vs Writing).
- **🔒 100% Local & Private**: No telemetry. No external API calls. Everything is parsed locally from your `~/.claude` directory using hyper-efficient `fs.watch`.

---

## 🚀 Installation & Setup

**IMPORTANT:** Claude Usage Monitor requires a one-time configuration of your local Claude Code hooks so it can stream data to VS Code without impacting performance.

### 1. Install the Extension
Search for **"Claude Usage Monitor"** in the VS Code Extensions view, or install it directly from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=gauravs19.claude-usage-monitor).

### 2. Copy the Hook Scripts
Copy the extension's hook scripts to your local Claude configuration directory. Run these commands in your terminal (adjust the path to match your OS):
```bash
cp ~/.vscode/extensions/gauravs19.claude-usage-monitor-*/hooks/activity-logger.js ~/.claude/hooks/activity-logger.js
cp ~/.vscode/extensions/gauravs19.claude-usage-monitor-*/hooks/statusline-bridge.js ~/.claude/hooks/statusline-bridge.js
```

### 3. Update `settings.json`
Add the following property configurations to your `~/.claude/settings.json` file:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node $HOME/.claude/hooks/statusline-bridge.js"
  },
  "hooks": {
    "PreToolUse": [
      { "matcher": "", "hooks": [{ "type": "command", "command": "node $HOME/.claude/hooks/activity-logger.js", "async": true }] }
    ],
    "PostToolUse": [
      { "matcher": "", "hooks": [{ "type": "command", "command": "node $HOME/.claude/hooks/activity-logger.js", "async": true }] }
    ],
    "Stop": [
      { "matcher": "", "hooks": [{ "type": "command", "command": "node $HOME/.claude/hooks/activity-logger.js", "async": true }] }
    ]
  }
}
```

### 4. Reload VS Code
Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type **`Developer: Reload Window`**.

---

## 🛠️ Commands

You can trigger the dashboard at any time using the Command Palette:
* **`Claude Usage: Open Dashboard`**: Opens the webview metrics panel.
* **`Claude Usage: Refresh`**: Force a reload of all local session data.

---

## 💡 How It Works
It reads from three local data sources with zero external API calls:
* `~/.claude/projects/**/*.jsonl` - For session history and token counts.
* `~/.claude/activity.jsonl` - For live tool tracking.
* `~/.claude/statusline-live.json` - For metrics like context capacity and model info.

Data is parsed incrementally using `fs.watch` and tracks byte offsets, ensuring minimal CPU overhead while maintaining a real-time feed.

---

## ⚖️ License
MIT © [gauravs19](https://github.com/gauravs19)
