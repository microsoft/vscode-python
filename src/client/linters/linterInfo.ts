// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { ConfigurationTarget, Uri } from 'vscode';
import { updateSetting } from '../../test/common';
import { IPythonSettingsProvider } from '../common/configSettings';
import { ExecutionInfo, Product } from '../common/types';
import { ILinterInfo, LinterId } from './types';

export class LinterInfo implements ILinterInfo {
    private _id: LinterId;
    private _product: Product;
    private settingsProvider: IPythonSettingsProvider;

    constructor(product: Product, id: LinterId, settingsProvider: IPythonSettingsProvider) {
        this._product = product;
        this._id = id;
        this.settingsProvider = settingsProvider;
    }

    public get id(): LinterId {
        return this._id;
    }
    public get product(): Product {
        return this._product;
    }

    public get pathSettingName(): string {
        return `${this.id}Path`;
    }
    public get argsSettingName(): string {
        return `${this.id}Args`;
    }
    public get enabledSettingName(): string {
        return `${this.id}Enabled`;
    }

    public async enableAsync(enabled: boolean, resource?: Uri): Promise<void> {
        const settings = this.settingsProvider.getInstance(resource);
        return this.settingsProvider.updateSettingAsync(`linting.${this.enabledSettingName}`, enabled, resource);
    }
    public isEnabled(resource?: Uri): boolean {
        const settings = this.settingsProvider.getInstance(resource);
        return settings.linting[this.enabledSettingName] as boolean;
    }

    public pathName(resource?: Uri): string {
        const settings = this.settingsProvider.getInstance(resource);
        return settings.linting[this.pathSettingName] as string;
    }
    public linterArgs(resource?: Uri): string[] {
        const settings = this.settingsProvider.getInstance(resource);
        const args = settings.linting[this.argsSettingName];
        return Array.isArray(args) ? args as string[] : [];
    }
    public getExecutionInfo(customArgs: string[], resource?: Uri): ExecutionInfo {
        const execPath = this.pathName(resource);
        const args = this.linterArgs(resource).concat(customArgs);
        let moduleName: string | undefined;

        // If path information is not available, then treat it as a module,
        // Except for prospector as that needs to be run as an executable (its a python package).
        if (path.basename(execPath) === execPath) {
            moduleName = execPath;
        }

        return { execPath, moduleName, args, product: this.product };
    }
}
