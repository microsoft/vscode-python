// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { inject, injectable } from 'inversify';
import * as path from 'path';
import * as vscode from 'vscode';
import { DataScience } from '../../common/utils/localize';

import { EXTENSION_ROOT_DIR, UseCustomEditorApi } from '../constants';
import { traceError } from '../logger';
import { IFileSystem } from '../platform/types';
import { noop } from '../utils/misc';
import { CustomEditorProvider, IApplicationEnvironment, ICommandManager, ICustomEditorService } from './types';

@injectable()
export class CustomEditorService implements ICustomEditorService {
    constructor(
        @inject(ICommandManager) private commandManager: ICommandManager,
        @inject(UseCustomEditorApi) private readonly useCustomEditorApi: boolean,
        @inject(IApplicationEnvironment) private readonly appEnvironment: IApplicationEnvironment,
        @inject(IFileSystem) private readonly fileSystem: IFileSystem
    ) {
        this.verifyPackageJson().catch((e) => traceError(`Error rewriting package json: `, e));
    }

    public registerCustomEditorProvider(
        viewType: string,
        provider: CustomEditorProvider,
        options?: {
            readonly webviewOptions?: vscode.WebviewPanelOptions;
            readonly supportsMultipleEditorsPerDocument?: boolean;
        }
    ): vscode.Disposable {
        if (this.useCustomEditorApi) {
            // tslint:disable-next-line: no-any
            return (vscode.window as any).registerCustomEditorProvider(viewType, provider, options);
        } else {
            return { dispose: noop };
        }
    }

    public async openEditor(file: vscode.Uri, viewType: string): Promise<void> {
        if (this.useCustomEditorApi) {
            await this.commandManager.executeCommand('vscode.openWith', file, viewType);
        }
    }

    private async verifyPackageJson(): Promise<void> {
        // Double check the package json has the necessary entries for contributing a custom editor. Note
        // we have to actually read it because appEnvironment.packageJson is the webpacked version
        const packageJson = JSON.parse(await this.fileSystem.readFile(path.join(EXTENSION_ROOT_DIR, 'package.json')));
        if (this.useCustomEditorApi && !packageJson.contributes?.customEditors) {
            return this.addCustomEditors(packageJson);
        } else if (!this.useCustomEditorApi && packageJson.contributes.customEditors) {
            return this.removeCustomEditors();
        }
    }

    // tslint:disable-next-line: no-any
    private async addCustomEditors(currentPackageJson: any) {
        // tslint:disable-next-line:no-require-imports no-var-requires
        const _mergeWith = require('lodash/mergeWith') as typeof import('lodash/mergeWith');
        const improvedContents = await this.fileSystem.readFile(path.join(EXTENSION_ROOT_DIR, 'customEditor.json'));
        const improved = _mergeWith({ ...currentPackageJson }, JSON.parse(improvedContents), (l, r) => {
            if (Array.isArray(l) && Array.isArray(r)) {
                return [...l, ...r];
            }
        });
        await this.fileSystem.writeFile(
            path.join(EXTENSION_ROOT_DIR, 'package.json'),
            JSON.stringify(improved, null, 4)
        );
        this.commandManager.executeCommand('python.reloadVSCode', DataScience.reloadCustomEditor());
    }
    private async removeCustomEditors() {
        // Note, to put it back, use the shipped version. This packageJson is required into the product
        // so it's packed by webpack into the source.
        const original = { ...this.appEnvironment.packageJson };
        await this.fileSystem.writeFile(
            path.join(EXTENSION_ROOT_DIR, 'package.json'),
            JSON.stringify(original, null, 4)
        );
        this.commandManager.executeCommand('python.reloadVSCode', DataScience.reloadCustomEditor());
    }
}
