import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export async function installHooks(context: vscode.ExtensionContext): Promise<boolean> {
  try {
    const homeDir = os.homedir();
    const claudeDir = path.join(homeDir, '.claude');
    const hooksDir = path.join(claudeDir, 'hooks');
    const settingsFile = path.join(claudeDir, 'settings.json');

    // Ensure directories exist
    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }

    // Source files from extension
    const extHooksDir = path.join(context.extensionPath, 'hooks');
    const extActivityLogger = path.join(extHooksDir, 'activity-logger.js');
    const extStatuslineBridge = path.join(extHooksDir, 'statusline-bridge.js');

    // Target files
    const targetActivityLogger = path.join(hooksDir, 'activity-logger.js');
    const targetStatuslineBridge = path.join(hooksDir, 'statusline-bridge.js');

    // Copy files
    fs.copyFileSync(extActivityLogger, targetActivityLogger);
    fs.copyFileSync(extStatuslineBridge, targetStatuslineBridge);

    // Update settings.json
    let settings: any = {};
    if (fs.existsSync(settingsFile)) {
      try {
        const content = fs.readFileSync(settingsFile, 'utf8');
        settings = JSON.parse(content);
      } catch (e) {
        // If settings.json is corrupted, we create a backup and make a new one
        fs.copyFileSync(settingsFile, settingsFile + '.backup');
      }
    }

    // Inject statusLine
    settings.statusLine = {
      type: "command",
      command: "node $HOME/.claude/hooks/statusline-bridge.js"
    };

    // Inject hooks
    const loggerHookCmd = { "type": "command", "command": "node $HOME/.claude/hooks/activity-logger.js", "async": true };
    const hookConfig = { "matcher": "", "hooks": [loggerHookCmd] };

    if (!settings.hooks) settings.hooks = {};
    
    ['PreToolUse', 'PostToolUse', 'Stop'].forEach(event => {
      if (!settings.hooks[event]) settings.hooks[event] = [];
      const hasHook = settings.hooks[event].some((h: any) => 
        h.hooks && h.hooks.some((cmd: any) => cmd.command?.includes('activity-logger.js'))
      );
      if (!hasHook) {
        settings.hooks[event].push(hookConfig);
      }
    });

    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));

    vscode.window.showInformationMessage('Claude Usage Monitor: Hooks automatically installed successfully!');
    return true;
  } catch (error: any) {
    vscode.window.showErrorMessage('Claude Usage Monitor: Failed to auto-install hooks. ' + error.message);
    return false;
  }
}
