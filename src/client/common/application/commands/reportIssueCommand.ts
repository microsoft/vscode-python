// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';

import { inject, injectable } from 'inversify';
import { IExtensionSingleActivationService } from '../../../activation/types';
import { ICommandManager } from '../types';
import { EXTENSION_ROOT_DIR } from '../../../constants';

/**
 * Allows the user to report an issue related to the Python extension using our template.
 */
@injectable()
export class ReportIssueCommandHandler implements IExtensionSingleActivationService {
    constructor(@inject(ICommandManager) private readonly commandManager: ICommandManager) {}

    public async activate(): Promise<void> {
        this.commandManager.registerCommand('python.reportIssue', this.openReportIssue, this);
    }

    private templatePath = path.join(EXTENSION_ROOT_DIR, 'resources', 'report_issue_template.md');

    public openReportIssue(): void {
        const templ = this.getIssueTemplate();
        vscode.commands.executeCommand('workbench.action.openIssueReporter', {
            extensionId: 'ms-python.python',
            issueBody: templ,
        });
    }

    public getIssueTemplate(): string {
        const templ = fs.readFileSync(this.templatePath, 'utf8');
        return templ;
    }
}
