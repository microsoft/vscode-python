// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import { WorkspaceConfiguration } from 'vscode';
import './common/extensions';
import { FileSystem } from './common/platform/fileSystem';
import { EXTENSION_ROOT_DIR } from './constants';
import { traceError } from './logging';

type VSCode = typeof import('vscode');

const setting = 'sourceMapsEnabled';

export class SourceMapSupport {
    private readonly config: WorkspaceConfiguration;
    constructor(private readonly vscode: VSCode) {
        this.config = this.vscode.workspace.getConfiguration('python.diagnostics', null);
    }
    public async initialize(): Promise<void> {
        if (!this.enabled) {
            return;
        }
        await this.enableSourceMaps(true);
        require('source-map-support').install();
        const localize = require('./common/utils/localize') as typeof import('./common/utils/localize');
        const disable = localize.Diagnostics.disableSourceMaps();
        this.vscode.window.showWarningMessage(localize.Diagnostics.warnSourceMaps(), disable).then((selection) => {
            if (selection === disable) {
                this.disable().ignoreErrors();
            }
        });
    }
    public get enabled(): boolean {
        return this.config.get<boolean>(setting, false);
    }
    public async disable(): Promise<void> {
        if (this.enabled) {
            await this.config.update(setting, false, this.vscode.ConfigurationTarget.Global);
        }
        await this.enableSourceMaps(false);
    }
    protected async enableSourceMaps(enable: boolean) {
        const extensionSourceFile = path.join(EXTENSION_ROOT_DIR, 'out', 'client', 'extension.js');
        const debuggerSourceFile = path.join(
            EXTENSION_ROOT_DIR,
            'out',
            'client',
            'debugger',
            'debugAdapter',
            'main.js',
        );
        await Promise.all([
            this.enableSourceMap(enable, extensionSourceFile),
            this.enableSourceMap(enable, debuggerSourceFile),
        ]);
    }
    protected async enableSourceMap(enable: boolean, sourceFile: string) {
        const sourceMapFile = `${sourceFile}.map`;
        const disabledSourceMapFile = `${sourceFile}.map.disabled`;
        if (enable) {
            await this.rename(disabledSourceMapFile, sourceMapFile);
        } else {
            await this.rename(sourceMapFile, disabledSourceMapFile);
        }
    }
    protected async rename(sourceFile: string, targetFile: string) {
        const fs = new FileSystem();
        if (await fs.fileExists(targetFile)) {
            return;
        }
        await fs.move(sourceFile, targetFile);
    }
}
export function initialize(vscode: VSCode = require('vscode')) {
    if (!vscode.workspace.getConfiguration('python.diagnostics', null).get('sourceMapsEnabled', false)) {
        new SourceMapSupport(vscode).disable().ignoreErrors();
        return;
    }
    new SourceMapSupport(vscode).initialize().catch((_ex) => {
        traceError('Failed to initialize source map support in extension');
    });
}
