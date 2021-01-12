// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { DebugConfigStrings } from '../../../../common/utils/localize';
import { InputStep, MultiStepInput } from '../../../../common/utils/multiStepInput';
import { sendTelemetryEvent } from '../../../../telemetry';
import { EventName } from '../../../../telemetry/constants';
import { DebuggerTypeName } from '../../../constants';
import { AttachRequestArguments } from '../../../types';
import { DebugConfigurationState, DebugConfigurationType, IDebugConfigurationProvider } from '../../types';

const defaultHost = 'localhost';
const defaultPort = 5678;

@injectable()
export class RemoteAttachDebugConfigurationProvider implements IDebugConfigurationProvider {
    public async buildConfiguration(
        input: MultiStepInput<DebugConfigurationState>,
        state: DebugConfigurationState,
    ): Promise<InputStep<DebugConfigurationState> | void> {
        const config: Partial<AttachRequestArguments> = {
            name: DebugConfigStrings.attach.snippet.name(),
            type: DebuggerTypeName,
            request: 'attach',
            connect: {
                host: defaultHost,
                port: defaultPort,
            },
            pathMappings: [
                {
                    localRoot: '${workspaceFolder}',
                    remoteRoot: '.',
                },
            ],
        };

        const connect = config.connect!;
        connect.host = await input.showInputBox({
            title: DebugConfigStrings.attach.enterRemoteHost.title(),
            step: 1,
            totalSteps: 2,
            value: connect.host || defaultHost,
            prompt: DebugConfigStrings.attach.enterRemoteHost.prompt(),
            validate: (value) =>
                Promise.resolve(
                    value && value.trim().length > 0 ? undefined : DebugConfigStrings.attach.enterRemoteHost.invalid(),
                ),
        });
        if (!connect.host) {
            connect.host = defaultHost;
        }

        sendTelemetryEvent(EventName.DEBUGGER_CONFIGURATION_PROMPTS, undefined, {
            configurationType: DebugConfigurationType.remoteAttach,
            manuallyEnteredAValue: connect.host !== defaultHost,
        });
        Object.assign(state.config, config);
        return (_) => this.configurePort(input, state.config);
    }

    protected async configurePort(
        input: MultiStepInput<DebugConfigurationState>,
        config: Partial<AttachRequestArguments>,
    ) {
        const connect = config.connect || (config.connect = {});
        const port = await input.showInputBox({
            title: DebugConfigStrings.attach.enterRemotePort.title(),
            step: 2,
            totalSteps: 2,
            value: (connect.port || defaultPort).toString(),
            prompt: DebugConfigStrings.attach.enterRemotePort.prompt(),
            validate: (value) =>
                Promise.resolve(
                    value && /^\d+$/.test(value.trim())
                        ? undefined
                        : DebugConfigStrings.attach.enterRemotePort.invalid(),
                ),
        });
        if (port && /^\d+$/.test(port.trim())) {
            connect.port = parseInt(port, 10);
        }
        if (!connect.port) {
            connect.port = defaultPort;
        }
        sendTelemetryEvent(EventName.DEBUGGER_CONFIGURATION_PROMPTS, undefined, {
            configurationType: DebugConfigurationType.remoteAttach,
            manuallyEnteredAValue: connect.port !== defaultPort,
        });
    }
}
