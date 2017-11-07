import { EventEmitter } from 'events';
import { ConfigurationTarget, Disposable, Uri, workspace, WorkspaceFolder } from 'vscode';
import { PythonSettings } from '../common/configSettings';

type settingsToMonitor = 'linting';

export class ConfigSettingMonitor extends EventEmitter implements Disposable {
    private oldSettings = new Map<string, string>();
    // tslint:disable-next-line:no-any
    private timeout?: any;
    constructor(private settingToMonitor: settingsToMonitor) {
        super();
        this.initializeSettings();
        // tslint:disable-next-line:no-void-expression
        PythonSettings.getInstance().on('change', () => this.onConfigChange());
    }
    public dispose() {
        if (this.timeout) {
            // tslint:disable-next-line:no-unsafe-any
            clearTimeout(this.timeout);
        }
    }
    private onConfigChange() {
        if (this.timeout) {
            // tslint:disable-next-line:no-unsafe-any
            clearTimeout(this.timeout);
        }
        this.timeout = setTimeout(() => {
            this.timeout = undefined;
            this.checkChangesToSettingsInWorkspace();
            this.checkChangesToSettingsInWorkspaceFolders();
        }, 1000);
    }
    private initializeSettings() {
        if (!Array.isArray(workspace.workspaceFolders)) {
            return;
        }
        if (workspace.workspaceFolders.length === 1) {
            const key = this.getWorkspaceKey();
            const currentValue = JSON.stringify(PythonSettings.getInstance()[this.settingToMonitor]);
            this.oldSettings.set(key, currentValue);
        } else {
            workspace.workspaceFolders.forEach(wkspaceFolder => {
                const key = this.getWorkspaceFolderKey(wkspaceFolder.uri);
                const currentValue = JSON.stringify(PythonSettings.getInstance(wkspaceFolder.uri)[this.settingToMonitor]);
                this.oldSettings.set(key, currentValue);
            });
        }
    }
    private checkChangesToSettingsInWorkspace() {
        if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length === 0) {
            return;
        }
        const newValue = JSON.stringify(PythonSettings.getInstance()[this.settingToMonitor]);
        this.checkChangesAndNotifiy(ConfigurationTarget.Workspace, workspace.workspaceFolders[0].uri, newValue);
    }
    private checkChangesToSettingsInWorkspaceFolders() {
        if (!Array.isArray(workspace.workspaceFolders) || workspace.workspaceFolders.length <= 1) {
            return;
        }
        // tslint:disable-next-line:no-void-expression
        workspace.workspaceFolders.forEach(folder => this.checkChangesToSettingsInWorkspaceFolder(folder));
    }
    private checkChangesToSettingsInWorkspaceFolder(workspaceFolder: WorkspaceFolder) {
        const newValue = JSON.stringify(PythonSettings.getInstance(workspaceFolder.uri)[this.settingToMonitor]);
        this.checkChangesAndNotifiy(ConfigurationTarget.WorkspaceFolder, workspaceFolder.uri, newValue);
    }
    private checkChangesAndNotifiy(configTarget: ConfigurationTarget, uri: Uri, newValue: string) {
        const key = configTarget === ConfigurationTarget.Workspace ? this.getWorkspaceKey() : this.getWorkspaceFolderKey(uri);
        if (this.oldSettings.has(key)) {
            const oldValue = this.oldSettings.get(key);
            if (oldValue !== newValue) {
                this.oldSettings.set(key, newValue);
                this.emit('change', configTarget, uri);
            }
        } else {
            this.oldSettings.set(key, newValue);
        }
    }
    private getWorkspaceKey() {
        // tslint:disable-next-line:no-non-null-assertion
        return workspace.workspaceFolders[0]!.uri.fsPath;
    }
    private getWorkspaceFolderKey(wkspaceFolder: Uri) {
        return `${ConfigurationTarget.WorkspaceFolder}:${wkspaceFolder.fsPath}`;
    }
}
