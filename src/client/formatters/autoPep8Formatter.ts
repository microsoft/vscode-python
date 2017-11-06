'use strict';

import * as vscode from 'vscode';
import { PythonSettings } from '../common/configSettings';
import { Product } from '../common/installer';
import { sendTelemetryWhenDone } from '../telemetry';
import { FORMAT } from '../telemetry/constants';
import { StopWatch } from '../telemetry/stopWatch';
import { BaseFormatter } from './baseFormatter';

export class AutoPep8Formatter extends BaseFormatter {
    constructor(outputChannel: vscode.OutputChannel) {
        super('autopep8', Product.autopep8, outputChannel);
    }

    public formatDocument(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken, range?: vscode.Range): Thenable<vscode.TextEdit[]> {
        const stopWatch = new StopWatch();
        const settings = PythonSettings.getInstance(document.uri);
        const autopep8Path = settings.formatting.autopep8Path;
        const autoPep8Args = Array.isArray(settings.formatting.autopep8Args) ? settings.formatting.autopep8Args : [];
        const hasCustomArgs = autoPep8Args.length > 0;
        const formatSelection = range ? !range.isEmpty : false;

        autoPep8Args.push('--diff');
        if (formatSelection) {
            // tslint:disable-next-line:no-non-null-assertion
            autoPep8Args.push(...['--line-range', (range!.start.line + 1).toString(), (range!.end.line + 1).toString()]);
        }
        const promise = super.provideDocumentFormattingEdits(document, options, token, autopep8Path, autoPep8Args);
        sendTelemetryWhenDone(FORMAT, promise, stopWatch, { tool: 'autoppep8', hasCustomArgs, formatSelection });
        return promise;
    }
}
