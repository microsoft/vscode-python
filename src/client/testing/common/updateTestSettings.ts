// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import { applyEdits, Edit, findNodeAtLocation, FormattingOptions, getNodeValue, modify, parseTree } from 'jsonc-parser';
import * as path from 'path';
import { IExtensionActivationService, LanguageServerType } from '../../activation/types';
import { IApplicationEnvironment, IWorkspaceService } from '../../common/application/types';
import '../../common/extensions';
import { traceDecorators, traceError } from '../../common/logger';
import { IFileSystem } from '../../common/platform/types';
import { Resource } from '../../common/types';
import { swallowExceptions } from '../../common/utils/decorators';

// tslint:disable-next-line:no-suspicious-comment
// TODO: rename the class since it is not used just for test settings
@injectable()
export class UpdateTestSettingService implements IExtensionActivationService {
    constructor(
        @inject(IFileSystem) private readonly fs: IFileSystem,
        @inject(IApplicationEnvironment) private readonly application: IApplicationEnvironment,
        @inject(IWorkspaceService) private readonly workspace: IWorkspaceService
    ) {}
    public async activate(resource: Resource): Promise<void> {
        this.updateTestSettings(resource).ignoreErrors();
    }
    @traceDecorators.error('Failed to update test settings')
    public async updateTestSettings(resource: Resource): Promise<void> {
        const filesToBeFixed = await this.getFilesToBeFixed(resource);
        await Promise.all(filesToBeFixed.map((file) => this.fixSettingInFile(file)));
    }
    public getSettingsFiles(resource: Resource): string[] {
        const settingsFiles: string[] = [];
        if (this.application.userSettingsFile) {
            settingsFiles.push(this.application.userSettingsFile);
        }
        const workspaceFolder = this.workspace.getWorkspaceFolder(resource);
        if (workspaceFolder) {
            settingsFiles.push(path.join(workspaceFolder.uri.fsPath, '.vscode', 'settings.json'));
        }
        return settingsFiles;
    }
    public async getFilesToBeFixed(resource: Resource): Promise<string[]> {
        const files = this.getSettingsFiles(resource);
        const result = await Promise.all(
            files.map(async (file) => {
                const needsFixing = await this.doesFileNeedToBeFixed(file);
                return { file, needsFixing };
            })
        );
        return result.filter((item) => item.needsFixing).map((item) => item.file);
    }
    // fixLanguageServerSetting provided for tests so not all tests have to
    // deal with potential whitespace changes.
    @swallowExceptions('Failed to update settings.json')
    public async fixSettingInFile(filePath: string, fixLanguageServerSetting = true): Promise<string> {
        let fileContents = await this.fs.readFile(filePath);

        const setting = new RegExp('"python\\.unitTest', 'g');
        fileContents = fileContents.replace(setting, '"python.testing');

        const setting_pytest_enabled = new RegExp('\\.pyTestEnabled"', 'g');
        const setting_pytest_args = new RegExp('\\.pyTestArgs"', 'g');
        const setting_pytest_path = new RegExp('\\.pyTestPath"', 'g');
        fileContents = fileContents.replace(setting_pytest_enabled, '.pytestEnabled"');
        fileContents = fileContents.replace(setting_pytest_args, '.pytestArgs"');
        fileContents = fileContents.replace(setting_pytest_path, '.pytestPath"');

        const setting_pep8_args = new RegExp('\\.(?<!auto)pep8Args', 'g');
        const setting_pep8_cat_severity = new RegExp('\\.pep8CategorySeverity\\.', 'g');
        const setting_pep8_enabled = new RegExp('\\.pep8Enabled', 'g');
        const setting_pep8_path = new RegExp('\\.(?<!auto)pep8Path', 'g');
        fileContents = fileContents.replace(setting_pep8_args, '.pycodestyleArgs');
        fileContents = fileContents.replace(setting_pep8_cat_severity, '.pycodestyleCategorySeverity.');
        fileContents = fileContents.replace(setting_pep8_enabled, '.pycodestyleEnabled');
        fileContents = fileContents.replace(setting_pep8_path, '.pycodestylePath');

        // tslint:disable-next-line:no-suspicious-comment
        // TODO: remove when python.jediEnabled is no longer in typical user settings.
        if (fixLanguageServerSetting) {
            fileContents = this.fixLanguageServerSettings(fileContents);
        }

        await this.fs.writeFile(filePath, fileContents);
        return fileContents;
    }

    public async doesFileNeedToBeFixed(filePath: string): Promise<boolean> {
        try {
            const contents = await this.fs.readFile(filePath);
            return (
                contents.indexOf('python.jediEnabled') > 0 ||
                contents.indexOf('python.unitTest.') > 0 ||
                contents.indexOf('.pyTest') > 0 ||
                contents.indexOf('.pep8') > 0
            );
        } catch (ex) {
            traceError('Failed to check if file needs to be fixed', ex);
            return false;
        }
    }

    private fixLanguageServerSettings(fileContent: string): string {
        // `python.jediEnabled` is deprecated:
        //   - `true` or missing then set to `languageServer: Jedi`.
        //   - `false` and `languageServer` is present, do nothing.
        //   - `false` and `languageServer` is NOT present, set `languageServer` to `Microsoft`.
        // `jediEnabled` is NOT removed since JSONC parser may also remove comments.
        const jediEnabledPath = ['python.jediEnabled'];
        const languageServerPath = ['python.languageServer'];

        try {
            const ast = parseTree(fileContent);
            const jediEnabledNode = findNodeAtLocation(ast, jediEnabledPath);
            const jediEnabled = jediEnabledNode ? getNodeValue(jediEnabledNode) : true;
            const languageServerNode = findNodeAtLocation(ast, languageServerPath);
            const formattingOptions: FormattingOptions = {
                tabSize: 4,
                insertSpaces: true
            };
            let edits: Edit[] = [];

            if (!jediEnabledNode || jediEnabled) {
                // `jediEnabled` is missing or is true. Default is true, so assume Jedi.
                edits = modify(fileContent, languageServerPath, LanguageServerType.Jedi, { formattingOptions });
            } else {
                // `jediEnabled` is false. if languageServer is missing, set it to Microsoft.
                if (!languageServerNode) {
                    edits = modify(fileContent, languageServerPath, LanguageServerType.Microsoft, {
                        formattingOptions
                    });
                }
            }

            fileContent = applyEdits(fileContent, edits);
            // tslint:disable-next-line:no-empty
        } catch {}
        return fileContent;
    }
}
