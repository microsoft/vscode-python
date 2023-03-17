// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import * as path from 'path';
import * as fs from 'fs-extra';
import { l10n, WorkspaceFolder } from 'vscode';
import { DebugConfigStrings } from '../../../../common/utils/localize';
import { MultiStepInput } from '../../../../common/utils/multiStepInput';
import { sendTelemetryEvent } from '../../../../telemetry';
import { EventName } from '../../../../telemetry/constants';
import { DebuggerTypeName } from '../../../constants';
import { LaunchRequestArguments } from '../../../types';
import { DebugConfigurationState, DebugConfigurationType } from '../../types';
import { resolveVariables } from '../utils/common';

const workspaceFolderToken = '${workspaceFolder}';

export async function buildPyramidLaunchConfiguration(
    input: MultiStepInput<DebugConfigurationState>,
    state: DebugConfigurationState,
): Promise<void> {
    const iniPath = await getDevelopmentIniPath(state.folder);
    const defaultIni = `${workspaceFolderToken}${path.sep}development.ini`;
    let manuallyEnteredAValue: boolean | undefined;

    const config: Partial<LaunchRequestArguments> = {
        name: DebugConfigStrings.pyramid.snippet.name,
        type: DebuggerTypeName,
        request: 'launch',
        module: 'pyramid.scripts.pserve',
        args: [iniPath || defaultIni],
        pyramid: true,
        jinja: true,
        justMyCode: true,
    };

    if (!iniPath) {
        const selectedIniPath = await input.showInputBox({
            title: DebugConfigStrings.pyramid.enterDevelopmentIniPath.title,
            value: defaultIni,
            prompt: l10n.t(
                'Enter the path to development.ini ({0} points to the root of the current workspace folder)',
                workspaceFolderToken,
            ),
            validate: (value) => validateIniPath(state ? state.folder : undefined, defaultIni, value),
        });
        if (selectedIniPath) {
            manuallyEnteredAValue = true;
            config.args = [selectedIniPath];
        }
    }

    sendTelemetryEvent(EventName.DEBUGGER_CONFIGURATION_PROMPTS, undefined, {
        configurationType: DebugConfigurationType.launchPyramid,
        autoDetectedPyramidIniPath: !!iniPath,
        manuallyEnteredAValue,
    });
    Object.assign(state.config, config);
}

export async function validateIniPath(
    folder: WorkspaceFolder | undefined,
    defaultValue: string,
    selected?: string,
): Promise<string | undefined> {
    if (!folder) {
        return undefined;
    }
    const error = DebugConfigStrings.pyramid.enterDevelopmentIniPath.invalid;
    if (!selected || selected.trim().length === 0) {
        return error;
    }
    const resolvedPath = resolveVariables(selected, undefined, folder);
    if (resolvedPath) {
        if (selected !== defaultValue && !fs.pathExists(resolvedPath)) {
            return error;
        }
        if (!resolvedPath.trim().toLowerCase().endsWith('.ini')) {
            return error;
        }
    }
    return undefined;
}

export async function getDevelopmentIniPath(folder: WorkspaceFolder | undefined): Promise<string | undefined> {
    if (!folder) {
        return undefined;
    }
    const defaultLocationOfManagePy = path.join(folder.uri.fsPath, 'development.ini');
    if (await fs.pathExists(defaultLocationOfManagePy)) {
        return `${workspaceFolderToken}${path.sep}development.ini`;
    }
    return undefined;
}
