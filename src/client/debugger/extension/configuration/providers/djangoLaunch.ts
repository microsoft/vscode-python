// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import { DebugConfigStrings } from '../../../../common/utils/localize';
import { MultiStepInput } from '../../../../common/utils/multiStepInput';
import { sendTelemetryEvent } from '../../../../telemetry';
import { EventName } from '../../../../telemetry/constants';
import { DebuggerTypeName } from '../../../constants';
import { LaunchRequestArguments } from '../../../types';
import { DebugConfigurationState, DebugConfigurationType } from '../../types';
import { resolveVariables } from '../utils/common';

const workspaceFolderToken = '${workspaceFolder}';

export async function buildDjangoLaunchDebugConfiguration(
    input: MultiStepInput<DebugConfigurationState>,
    state: DebugConfigurationState,
): Promise<void> {
    const program = await getManagePyPath(state.folder);
    let manuallyEnteredAValue: boolean | undefined;
    const defaultProgram = `${workspaceFolderToken}${path.sep}manage.py`;
    const config: Partial<LaunchRequestArguments> = {
        name: DebugConfigStrings.django.snippet.name,
        type: DebuggerTypeName,
        request: 'launch',
        program: program || defaultProgram,
        args: ['runserver'],
        django: true,
        justMyCode: true,
    };
    if (!program) {
        const selectedProgram = await input.showInputBox({
            title: DebugConfigStrings.django.enterManagePyPath.title,
            value: defaultProgram,
            prompt: DebugConfigStrings.django.enterManagePyPath.prompt,
            validate: (value) => validateManagePy(state.folder, defaultProgram, value),
        });
        if (selectedProgram) {
            manuallyEnteredAValue = true;
            config.program = selectedProgram;
        }
    }

    sendTelemetryEvent(EventName.DEBUGGER_CONFIGURATION_PROMPTS, undefined, {
        configurationType: DebugConfigurationType.launchDjango,
        autoDetectedDjangoManagePyPath: !!program,
        manuallyEnteredAValue,
    });

    Object.assign(state.config, config);
}

export async function validateManagePy(
    folder: vscode.WorkspaceFolder | undefined,
    defaultValue: string,
    selected?: string,
): Promise<string | undefined> {
    const error = DebugConfigStrings.django.enterManagePyPath.invalid;
    if (!selected || selected.trim().length === 0) {
        return error;
    }
    const resolvedPath = resolveVariables(selected, undefined, folder);
    if (resolvedPath) {
        if (selected !== defaultValue && !(await fs.pathExists(resolvedPath))) {
            return error;
        }
        if (!resolvedPath.trim().toLowerCase().endsWith('.py')) {
            return error;
        }
    }
    return undefined;
}

export async function getManagePyPath(folder: vscode.WorkspaceFolder | undefined): Promise<string | undefined> {
    if (!folder) {
        return undefined;
    }
    const defaultLocationOfManagePy = path.join(folder.uri.fsPath, 'manage.py');
    if (await fs.pathExists(defaultLocationOfManagePy)) {
        return `${workspaceFolderToken}${path.sep}manage.py`;
    }
    return undefined;
}
