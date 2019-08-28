'use strict';
import * as path from 'path';
import * as vscode from 'vscode';
import { Commands } from '../common/constants';
import { traceError } from '../common/logger';
import { sendTelemetryEvent } from '../telemetry';
import { EventName } from '../telemetry/constants';

export function activateUpdateSparkLibraryProvider(): vscode.Disposable {
    return vscode.commands.registerCommand(Commands.Update_SparkLibrary, updateSparkLibrary);
}

function updateSparkLibrary() {
    const pythonConfig = vscode.workspace.getConfiguration('python', null);
    const extraLibPath = 'autoComplete.extraPaths';
    // tslint:disable-next-line:no-invalid-template-strings
    const sparkHomePath = '${env:SPARK_HOME}';
    pythonConfig.update(extraLibPath, [path.join(sparkHomePath, 'python'),
    path.join(sparkHomePath, 'python/pyspark')]).then(() => {
        //Done
    }, reason => {
        vscode.window.showErrorMessage(`Failed to update ${extraLibPath}. Error: ${reason.message}`);
        traceError(reason);
    });
    vscode.window.showInformationMessage('Make sure you have SPARK_HOME environment variable set to the root path of the local spark installation!');
    sendTelemetryEvent(EventName.UPDATE_PYSPARK_LIBRARY);
}
