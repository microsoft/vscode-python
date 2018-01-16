// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as path from 'path';
import { Uri } from 'vscode';
import { PythonSettings } from '../common/configSettings';
import { ExecutionInfo, Product } from '../common/types';
import { ILinterInfo, LinterId } from './types';

export class LinterInfo implements ILinterInfo {
    private _id: LinterId;
    private _product: Product;

    constructor(product: Product, id: LinterId) {
        this._product = product;
        this._id = id;
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

    public pathName(resource?: Uri): string {
        const settings = PythonSettings.getInstance(resource);
        return settings.linting[this.pathSettingName] as string;
    }
    public linterArgs(resource?: Uri): string[] {
        const settings = PythonSettings.getInstance(resource);
        const args = settings.linting[this.argsSettingName];
        return Array.isArray(args) ? args as string[] : [];
    }
    public getExecutionInfo(customArgs: string[], resource?: Uri): ExecutionInfo {
        const execPath = this.pathName(resource);
        const args = this.linterArgs(resource).concat(customArgs);
        let moduleName: string | undefined;

        // If path information is not available, then treat it as a module,
        // Except for prospector as that needs to be run as an executable (its a python package).
        if (path.basename(execPath) === execPath && this.product !== Product.prospector) {
            moduleName = execPath;
        }

        return { execPath, moduleName, args, product: this.product };
    }
}
