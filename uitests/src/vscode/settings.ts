// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as fs from 'fs-extra';
import { applyEdits, modify, parse } from 'jsonc-parser';
import * as path from 'path';
import { noop } from '../helpers';
import { sleep } from '../helpers/misc';
import { ConfigurationTarget, IApplication, ISettings } from '../types';

// tslint:disable: max-func-body-length no-invalid-template-strings no-http-string no-invalid-this no-multiline-string member-access no-any radix no-shadowed-variable no-unnecessary-callback-wrapper member-ordering no-constant-condition prefer-const no-increment-decrement no-single-line-block-comment prefer-object-spread no-function-expression no-string-literal

const modifyOptions = { formattingOptions: { tabSize: 4, insertSpaces: true } };
type CrudSetting = {
    type: 'user' | 'workspaceFolder';
    remove?: string[];
    workspaceFolder?: string;
    update?: { [key: string]: string | number | boolean | void };
};

export class Settings implements ISettings {
    private readonly app: IApplication;
    constructor(app: IApplication) {
        this.app = app;
    }
    public async removeSetting(setting: string, scope: ConfigurationTarget): Promise<void> {
        const content = await this.getSettingsContent(scope);
        if (!content) {
            return;
        }
        if (this.app.isAlive) {
            const type = scope === ConfigurationTarget.Global ? 'user' : 'workspaceFolder';
            const workspaceFolder = scope === ConfigurationTarget.Global ? undefined : this.app.workspacePathOrFolder;
            await this.sendCommandToBootstrap({ type, remove: [setting], workspaceFolder });
        } else {
            const edits = modify(content, [setting], void 0, modifyOptions);
            await this.saveSettingsContent(applyEdits(content, edits), scope);
        }
    }
    public async updateSetting(setting: string, value: string | boolean | number | void, scope: ConfigurationTarget): Promise<void> {
        let content = await this.getSettingsContent(scope);
        if (!content) {
            content = '{}';
        }
        if (this.app.isAlive) {
            const type = scope === ConfigurationTarget.Global ? 'user' : 'workspaceFolder';
            const workspaceFolder = scope === ConfigurationTarget.Global ? undefined : this.app.workspacePathOrFolder;
            await this.sendCommandToBootstrap({ type, update: { [setting]: value }, workspaceFolder });
        } else {
            const edits = modify(content, [setting], value, modifyOptions);
            await this.saveSettingsContent(applyEdits(content, edits), scope);
        }
    }
    public async getSetting<T>(setting: string, scope: ConfigurationTarget): Promise<T | undefined> {
        const content = await this.getSettingsContent(scope);
        return content ? (this.getJson(content)[setting] as T) : undefined;
    }
    /**
     * Let the bootstrap extension update the settings. This way VSC will be aware of it and extensions
     * will get the right values.If we update the file directly then VSC might not get notified immediately.
     *   We'll let the bootstrap extension update the settings and delete the original file.
     * When the file has been deleted we know the settings have been updated and VSC is aware of the updates.
     *
     * @private
     * @param {*} context
     * @param {*} crud_settings
     * @memberof Settings
     */
    private async sendCommandToBootstrap(crudSettings: CrudSetting) {
        const instructionsFile = path.join(this.app.extensionsPath, 'settingsToUpdate.txt');
        const errorFile = path.join(this.app.extensionsPath, 'settingsToUpdate_error.txt');
        await fs.remove(errorFile).catch(noop);
        await fs.writeFile(instructionsFile, JSON.stringify(crudSettings, undefined, 4));

        await this.app.quickopen.runCommand('Smoke: Update Settings');
        // uitests.vscode.application.capture_screen(context)
        // Wait for 5 seconds for settings to get updated.
        // If file has been deleted then yes it has been udpated, else error
        for (let _ of [1, 2, 3, 4, 5]) {
            if (await fs.pathExists(instructionsFile)) {
                await sleep(500);
                continue;
            }
            return;
        }

        let errorMessage = '';
        if (await fs.pathExists(errorFile)) {
            errorMessage += await fs.readFile(errorFile);
        }
        if (await fs.pathExists(instructionsFile)) {
            errorMessage += await fs.readFile(instructionsFile);
        }
        throw new Error(`Settings not updated by Bootstrap\n ${errorMessage}`);
    }

    private async getSettingsContent(scope: ConfigurationTarget): Promise<string | undefined> {
        const jsonFile = scope === ConfigurationTarget.Global ? this.app.userSettingsFilePath : path.join(this.app.workspacePathOrFolder, '.vscode', 'settings.json');
        if (!(await fs.pathExists(jsonFile))) {
            return;
        }
        return fs.readFile(jsonFile, 'utf8');
    }

    private async saveSettingsContent(content: string, scope: ConfigurationTarget): Promise<void> {
        const jsonFile = scope === ConfigurationTarget.Global ? this.app.userSettingsFilePath : path.join(this.app.workspacePathOrFolder, '.vscode', 'settings.json');
        await fs.mkdirp(path.dirname(jsonFile)).catch(noop);
        return fs.writeFile(jsonFile, content, 'utf8');
    }

    private getJson(content: string): any {
        return parse(content, undefined, { allowTrailingComma: true, disallowComments: false });
    }
}
