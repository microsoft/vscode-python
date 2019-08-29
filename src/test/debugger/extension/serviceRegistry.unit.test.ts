// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:no-unnecessary-override no-invalid-template-strings max-func-body-length no-any

import { expect } from 'chai';
import * as typemoq from 'typemoq';
import { IExtensionSingleActivationService } from '../../../client/activation/types';
import { DebugAdapterActivator } from '../../../client/debugger/extension/adapter/activator';
import { DebugAdapterDescriptorFactory } from '../../../client/debugger/extension/adapter/factory';
import { DebuggerBanner } from '../../../client/debugger/extension/banner';
import { PythonDebugConfigurationService } from '../../../client/debugger/extension/configuration/debugConfigurationService';
import { LaunchJsonCompletionProvider } from '../../../client/debugger/extension/configuration/launch.json/completionProvider';
import { LaunchJsonUpdaterService } from '../../../client/debugger/extension/configuration/launch.json/updaterService';
import { DjangoLaunchDebugConfigurationProvider } from '../../../client/debugger/extension/configuration/providers/djangoLaunch';
import { FileLaunchDebugConfigurationProvider } from '../../../client/debugger/extension/configuration/providers/fileLaunch';
import { FlaskLaunchDebugConfigurationProvider } from '../../../client/debugger/extension/configuration/providers/flaskLaunch';
import { ModuleLaunchDebugConfigurationProvider } from '../../../client/debugger/extension/configuration/providers/moduleLaunch';
import { DebugConfigurationProviderFactory } from '../../../client/debugger/extension/configuration/providers/providerFactory';
import { PyramidLaunchDebugConfigurationProvider } from '../../../client/debugger/extension/configuration/providers/pyramidLaunch';
import { RemoteAttachDebugConfigurationProvider } from '../../../client/debugger/extension/configuration/providers/remoteAttach';
import { AttachConfigurationResolver } from '../../../client/debugger/extension/configuration/resolvers/attach';
import { LaunchConfigurationResolver } from '../../../client/debugger/extension/configuration/resolvers/launch';
import { IDebugConfigurationProviderFactory, IDebugConfigurationResolver } from '../../../client/debugger/extension/configuration/types';
import { ChildProcessAttachEventHandler } from '../../../client/debugger/extension/hooks/childProcessAttachHandler';
import { ChildProcessAttachService } from '../../../client/debugger/extension/hooks/childProcessAttachService';
import { IChildProcessAttachService, IDebugSessionEventHandlers } from '../../../client/debugger/extension/hooks/types';
import { registerTypes } from '../../../client/debugger/extension/serviceRegistry';
import {
    DebugConfigurationType,
    ExtensionSingleActivationServiceType,
    IDebugAdapterDescriptorFactory,
    IDebugConfigurationProvider,
    IDebugConfigurationService,
    IDebuggerBanner
} from '../../../client/debugger/extension/types';
import { IServiceManager } from '../../../client/ioc/types';

suite('Debugging - Service Registry', () => {
    test('Registrations', () => {
        const serviceManager = typemoq.Mock.ofType<IServiceManager>();

        [
            [IDebugConfigurationService, PythonDebugConfigurationService],
            [IDebuggerBanner, DebuggerBanner],
            [IChildProcessAttachService, ChildProcessAttachService],
            [IExtensionSingleActivationService, LaunchJsonCompletionProvider, ExtensionSingleActivationServiceType.jsonCompletionProvider],
            [IExtensionSingleActivationService, LaunchJsonUpdaterService, ExtensionSingleActivationServiceType.jsonUpdaterService],
            [IExtensionSingleActivationService, DebugAdapterActivator, ExtensionSingleActivationServiceType.debugAdapterActivator],
            [IDebugAdapterDescriptorFactory, DebugAdapterDescriptorFactory],
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
