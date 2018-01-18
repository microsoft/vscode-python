// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { ITerminalServiceFactory } from '../../../client/common/terminal/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { initialize } from '../../initialize';
import { UnitTestIocContainer } from '../../unittests/serviceRegistry';

// tslint:disable-next-line:max-func-body-length
suite('Terminal Service Factory', () => {
    let ioc: UnitTestIocContainer;
    suiteSetup(initialize);
    setup(() => {
        ioc = new UnitTestIocContainer();
        const interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        ioc.serviceManager.addSingletonInstance<IInterpreterService>(IInterpreterService, interpreterService.object);
        ioc.registerCommonTypes();
        ioc.registerPlatformTypes();
    });
    teardown(() => ioc.dispose());

    test('Ensure same instance of terminal service is returned', () => {
        const factory = ioc.serviceContainer.get<ITerminalServiceFactory>(ITerminalServiceFactory);
        const instance = factory.getTerminalService();
        const sameInstance = factory.getTerminalService() === instance;
        expect(sameInstance).to.equal(true, 'Instances are not the same');

        const differentInstance = factory.getTerminalService(undefined, 'New Title');
        const notTheSameInstance = differentInstance === instance;
        expect(notTheSameInstance).not.to.equal(true, 'Instances are the same');
    });

    test('Ensure different instance of terminal service is returned when title is provided', () => {
        const factory = ioc.serviceContainer.get<ITerminalServiceFactory>(ITerminalServiceFactory);
        const defaultInstance = factory.getTerminalService();
        const notSameAsDefaultInstance = factory.getTerminalService(undefined, 'New Title') === defaultInstance;
        expect(notSameAsDefaultInstance).to.not.equal(true, 'Instances are the same as default instance');

        const instance = factory.getTerminalService(undefined, 'New Title');
        const sameInstance = factory.getTerminalService(undefined, 'New Title') === instance;
        expect(sameInstance).to.equal(true, 'Instances are not the same');

        const differentInstance = factory.getTerminalService(undefined, 'Another New Title');
        const notTheSameInstance = differentInstance === instance;
        expect(notTheSameInstance).not.to.equal(true, 'Instances are the same');
    });
});
