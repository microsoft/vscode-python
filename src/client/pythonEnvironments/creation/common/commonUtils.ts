// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { Commands } from '../../../common/constants';
import { Common } from '../../../common/utils/localize';
import { executeCommand } from '../../../common/vscodeApis/commandApis';
import { showErrorMessage } from '../../../common/vscodeApis/windowApis';

export async function showErrorMessageWithLogs(message: string): Promise<void> {
    const result = await showErrorMessage(message, Common.openOutputPanel, Common.selectPythonInterpreter);
    if (result === Common.openOutputPanel) {
        await executeCommand(Commands.ViewOutput);
    } else if (result === Common.selectPythonInterpreter) {
        await executeCommand(Commands.Set_Interpreter);
    }
}
