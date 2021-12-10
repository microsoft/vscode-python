// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { Uri } from 'vscode';
import { ExecutionInfo, IConfigurationService, ILintingSettings, Product } from '../common/types';
import { ILinterInfo, LinterId } from './types';

export class LinterInfo implements ILinterInfo {
    private _id: LinterId;

    private _product: Product;

    private _configFileNames: string[];

    constructor(
        product: Product,
        id: LinterId,
        protected configService: IConfigurationService,
        configFileNames: string[] = [],
    ) {
        this._product = product;
        this._id = id;
        this._configFileNames = configFileNames;
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

    public get configFileNames(): string[] {
        return this._configFileNames;
    }

    public async enableAsync(enabled: boolean, resource?: Uri): Promise<void> {
        return this.configService.updateSetting(`linting.${this.enabledSettingName}`, enabled, resource);
    }

    public isEnabled(resource?: Uri): boolean {
        const settings = this.configService.getSettings(resource);
        const name = this.enabledSettingName as keyof ILintingSettings;
        return settings.linting[name] as boolean;
    }

    public pathName(resource?: Uri): string {
        const settings = this.configService.getSettings(resource);
        const name = this.pathSettingName as keyof ILintingSettings;
        return settings.linting[name] as string;
    }

    public linterArgs(resource?: Uri): string[] {
        const settings = this.configService.getSettings(resource);
        const name = this.argsSettingName as keyof ILintingSettings;
        const args = settings.linting[name];
        return Array.isArray(args) ? (args as string[]) : [];
    }

    public getExecutionInfo(customArgs: string[], resource?: Uri): ExecutionInfo {
        const execPath = this.pathName(resource);
        const args = this.linterArgs(resource).concat(customArgs);
        let moduleName: string | undefined;

        // If path information is not available, then treat it as a module,
        if (path.basename(execPath) === execPath) {
            moduleName = execPath;
        }

        return { execPath, moduleName, args, product: this.product };
    }
}
