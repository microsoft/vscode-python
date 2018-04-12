// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as vscode from 'vscode';
import { StopWatch } from '../common/stopWatch';
import { IConfigurationService, Product } from '../common/types';
import { IServiceContainer } from '../ioc/types';
import { sendTelemetryWhenDone } from '../telemetry';
import { FORMAT } from '../telemetry/constants';
import { BaseFormatter } from './baseFormatter';

export class BlackFormatter extends BaseFormatter {
    constructor(serviceContainer: IServiceContainer) {
        super('black', Product.black, serviceContainer);
    }

    public formatDocument(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken, range?: vscode.Range): Thenable<vscode.TextEdit[]> {
        const stopWatch = new StopWatch();
        const settings = this.serviceContainer.get<IConfigurationService>(IConfigurationService).getSettings(document.uri);
        const hasCustomArgs = Array.isArray(settings.formatting.blackArgs) && settings.formatting.blackArgs.length > 0;
        const formatSelection = false; // range ? !range.isEmpty : false;

        const args = ['--diff'];
        // if (formatSelection) {
        // black does not support partial formatting, throw an error?
        //     // tslint:disable-next-line:no-non-null-assertion
        //     args.push(...['--lines', `${range!.start.line + 1}-${range!.end.line + 1}`]);
        // }
        // Yapf starts looking for config file starting from the file path.
        const fallbackFolder = this.getWorkspaceUri(document).fsPath;
        const cwd = this.getDocumentPath(document, fallbackFolder);
        const promise = super.provideDocumentFormattingEdits(document, options, token, args, cwd);
        //sendTelemetryWhenDone(FORMAT, promise, stopWatch, { tool: 'black', hasCustomArgs, formatSelection });
        return promise;
    }
}
