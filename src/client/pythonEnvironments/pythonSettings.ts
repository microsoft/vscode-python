// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { Disposables, IDisposable } from '../common/utils/resourceLifecycle';

interface IPythonSettings {
    /**
     * An event that is emitted when a setting changes.
     */
    readonly onDidChange: vscode.Event<void>;
    /**
     * Returns the value for setting `python.<name>`.
     * @param name The name of the setting
     */
    get<T>(name: string): T | undefined;
}

class PythonSettings extends Disposables implements IPythonSettings {
    public static pythonSettings: PythonSettings | undefined;

    protected readonly changed = new vscode.EventEmitter<void>();

    constructor() {
        super();
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
                if (event.affectsConfiguration('python')) {
                    this.changed.fire();
                }
            }),
        );
    }

    public static getInstance(): PythonSettings {
        if (!PythonSettings.pythonSettings) {
            PythonSettings.pythonSettings = new PythonSettings();
        }
        return PythonSettings.pythonSettings;
    }

    // eslint-disable-next-line class-methods-use-this
    public get<T>(name: string): T | undefined {
        return vscode.workspace.getConfiguration('python').get(name);
    }

    public get onDidChange(): vscode.Event<void> {
        return this.changed.event;
    }
}

export function getPythonSettingsInstance() : IPythonSettings & IDisposable {
    return PythonSettings.getInstance();
}
