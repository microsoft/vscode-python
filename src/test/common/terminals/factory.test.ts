// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import { ITerminalServiceFactory } from '../../../client/common/terminal/types';
import { initialize } from '../../initialize';
import { UnitTestIocContainer } from '../../unittests/serviceRegistry';

// tslint:disable-next-line:max-func-body-length
suite('Terminal Service Factory', () => {
    let ioc: UnitTestIocContainer;
    suiteSetup(initialize);
    setup(() => {
        ioc = new UnitTestIocContainer();
        ioc.registerCommonTypes();
        ioc.registerPlatformTypes();
    });
    teardown(() => ioc.dispose());

    test('Ensure same instance of terminal service is returned', () => {
        const factory = ioc.serviceContainer.get<ITerminalServiceFactory>(ITerminalServiceFactory);
        const instance = factory.getTerminalService();
        const sameInstance = factory.getTerminalService() === instance;
        expect(sameInstance).to.equal(true, 'Instances are not the same');

        const differentInstance = factory.getTerminalService('New Title');
        const notTheSameInstance = differentInstance === instance;
        expect(notTheSameInstance).not.to.equal(true, 'Instances are the same');
    });

    test('Ensure different instance of terminal service is returned when title is provided', () => {
        const factory = ioc.serviceContainer.get<ITerminalServiceFactory>(ITerminalServiceFactory);
        const instance = factory.getTerminalService('New Title');
        const sameInstance = factory.getTerminalService('New Title') === instance;
        expect(sameInstance).to.not.equal(true, 'Instances are the same');

        const differentInstance = factory.getTerminalService('Another New Title');
        const notTheSameInstance = differentInstance === instance;
        expect(notTheSameInstance).not.to.equal(true, 'Instances are the same');
    });
});
