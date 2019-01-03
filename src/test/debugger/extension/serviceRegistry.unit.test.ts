// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-unnecessary-override no-invalid-template-strings max-func-body-length no-any

import { expect } from 'chai';
import * as typemoq from 'typemoq';
import { DebuggerBanner } from '../../../client/debugger/extension/banner';
import { ConfigurationProviderUtils } from '../../../client/debugger/extension/configuration/configurationProviderUtils';
import { PythonDebugConfigurationService } from '../../../client/debugger/extension/configuration/debugConfigurationService';
import { DjangoLaunchDebugConfigurationProvider } from '../../../client/debugger/extension/configuration/providers/djangoLaunch';
import { FileLaunchDebugConfigurationProvider } from '../../../client/debugger/extension/configuration/providers/fileLaunch';
import { FlaskLaunchDebugConfigurationProvider } from '../../../client/debugger/extension/configuration/providers/flaskLaunch';
import { ModuleLaunchDebugConfigurationProvider } from '../../../client/debugger/extension/configuration/providers/moduleLaunch';
import { DebugConfigurationProviderFactory } from '../../../client/debugger/extension/configuration/providers/providerFactory';
import { PyramidLaunchDebugConfigurationProvider } from '../../../client/debugger/extension/configuration/providers/pyramidLaunch';
import { RemoteAttachDebugConfigurationProvider } from '../../../client/debugger/extension/configuration/providers/remoteAttach';
import { AttachConfigurationResolver } from '../../../client/debugger/extension/configuration/resolvers/attach';
import { LaunchConfigurationResolver } from '../../../client/debugger/extension/configuration/resolvers/launch';
import { IConfigurationProviderUtils, IDebugConfigurationProviderFactory, IDebugConfigurationResolver } from '../../../client/debugger/extension/configuration/types';
import { ChildProcessAttachEventHandler } from '../../../client/debugger/extension/hooks/childProcessAttachHandler';
import { ChildProcessAttachService } from '../../../client/debugger/extension/hooks/childProcessAttachService';
import { IChildProcessAttachService, IDebugSessionEventHandlers } from '../../../client/debugger/extension/hooks/types';
import { registerTypes } from '../../../client/debugger/extension/serviceRegistry';
import { DebugConfigurationType, IDebugConfigurationProvider, IDebugConfigurationService, IDebuggerBanner } from '../../../client/debugger/extension/types';
import { IServiceManager } from '../../../client/ioc/types';

suite('Debugging - Service Registry', () => {
    test('Registrations', () => {
        const serviceManager = typemoq.Mock.ofType<IServiceManager>();

        [
            [IDebugConfigurationService, PythonDebugConfigurationService],
            [IConfigurationProviderUtils, ConfigurationProviderUtils],
            [IDebuggerBanner, DebuggerBanner],
            [IChildProcessAttachService, ChildProcessAttachService],
            [IDebugSessionEventHandlers, ChildProcessAttachEventHandler],
            [IDebugConfigurationResolver, LaunchConfigurationResolver, 'launch'],
            [IDebugConfigurationResolver, AttachConfigurationResolver, 'attach'],
            [IDebugConfigurationProviderFactory, DebugConfigurationProviderFactory],
            [IDebugConfigurationProvider, FileLaunchDebugConfigurationProvider, DebugConfigurationType.launchFile],
            [IDebugConfigurationProvider, DjangoLaunchDebugConfigurationProvider, DebugConfigurationType.launchDjango],
            [IDebugConfigurationProvider, FlaskLaunchDebugConfigurationProvider, DebugConfigurationType.launchFlask],
            [IDebugConfigurationProvider, RemoteAttachDebugConfigurationProvider, DebugConfigurationType.remoteAttach],
            [IDebugConfigurationProvider, ModuleLaunchDebugConfigurationProvider, DebugConfigurationType.launchModule],
            [IDebugConfigurationProvider, PyramidLaunchDebugConfigurationProvider, DebugConfigurationType.launchPyramid]
        ].forEach(mapping => {
            if (mapping.length === 2) {
                serviceManager
                    .setup(s => s.addSingleton(typemoq.It.isValue(mapping[0] as any), typemoq.It.isAny()))
                    .callback((_, cls) => expect(cls).to.equal(mapping[1]))
                    .verifiable(typemoq.Times.once());
            } else {
                serviceManager
                    .setup(s => s.addSingleton(typemoq.It.isValue(mapping[0] as any), typemoq.It.isAny(), typemoq.It.isValue(mapping[2] as any)))
                    .callback((_, cls) => expect(cls).to.equal(mapping[1]))
                    .verifiable(typemoq.Times.once());
            }
        });

        registerTypes(serviceManager.object);
        serviceManager.verifyAll();
    });
});
