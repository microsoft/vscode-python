// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import * as vscode from 'vscode';
import { IApplicationShell } from '../common/application/types';
import { Product } from '../common/installer/productInstaller';
import { IConfigurationService } from '../common/types';
import { noop } from '../common/utils/misc';
import { StopWatch } from '../common/utils/stopWatch';
import { IServiceContainer } from '../ioc/types';
import { sendTelemetryWhenDone } from '../telemetry';
import { EventName } from '../telemetry/constants';
import { BaseFormatter } from './baseFormatter';

export class BlackFormatter extends BaseFormatter {
    constructor(serviceContainer: IServiceContainer) {
        super('black', Product.black, serviceContainer);
    }

    public async formatDocument(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken,
        range?: vscode.Range,
    ): Promise<vscode.TextEdit[]> {
        const stopWatch = new StopWatch();
        const settings = this.serviceContainer
            .get<IConfigurationService>(IConfigurationService)
            .getSettings(document.uri);
        const hasCustomArgs = Array.isArray(settings.formatting.blackArgs) && settings.formatting.blackArgs.length > 0;
        const formatSelection = range ? !range.isEmpty : false;

        if (formatSelection) {
            const shell = this.serviceContainer.get<IApplicationShell>(IApplicationShell);
            // Black does not support partial formatting on purpose.
            shell.showErrorMessage('Black does not support the "Format Selection" command').then(noop, noop);
            return [];
        }

        const blackArgs = ['--diff', '--quiet'];

        if (path.extname(document.fileName) === '.pyi') {
            blackArgs.push('--pyi');
        }

        const promise = super.provideDocumentFormattingEdits(document, options, token, blackArgs);
        sendTelemetryWhenDone(EventName.FORMAT, promise, stopWatch, { tool: 'black', hasCustomArgs, formatSelection });
        return promise;
    }
}
