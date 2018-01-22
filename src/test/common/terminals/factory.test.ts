// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import * as TypeMoq from 'typemoq';
import { Disposable } from 'vscode';
import { ITerminalManager } from '../../../client/common/application/types';
import { TerminalServiceFactory } from '../../../client/common/terminal/factory';
import { ITerminalHelper, ITerminalServiceFactory } from '../../../client/common/terminal/types';
import { IDisposableRegistry } from '../../../client/common/types';
import { IInterpreterService } from '../../../client/interpreter/contracts';
import { IServiceContainer } from '../../../client/ioc/types';
import { initialize } from '../../initialize';

// tslint:disable-next-line:max-func-body-length
suite('Terminal Service Factory', () => {
    let factory: ITerminalServiceFactory;
    let disposables: Disposable[] = [];
    suiteSetup(initialize);
    setup(() => {
        const serviceContainer = TypeMoq.Mock.ofType<IServiceContainer>();
        const interpreterService = TypeMoq.Mock.ofType<IInterpreterService>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IInterpreterService), TypeMoq.It.isAny())).returns(() => interpreterService.object);
        disposables = [];
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(IDisposableRegistry), TypeMoq.It.isAny())).returns(() => disposables);
        const terminalHelper = TypeMoq.Mock.ofType<ITerminalHelper>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ITerminalHelper), TypeMoq.It.isAny())).returns(() => terminalHelper.object);
        const terminalManager = TypeMoq.Mock.ofType<ITerminalManager>();
        serviceContainer.setup(c => c.get(TypeMoq.It.isValue(ITerminalManager), TypeMoq.It.isAny())).returns(() => terminalManager.object);
        factory = new TerminalServiceFactory(serviceContainer.object);
    });
    teardown(() => {
        disposables.forEach(disposable => {
            if (disposable) {
                disposable.dispose();
            }
        });
    });

    test('Ensure same instance of terminal service is returned', () => {
        const instance = factory.getTerminalService();
        const sameInstance = factory.getTerminalService() === instance;
        expect(sameInstance).to.equal(true, 'Instances are not the same');

        const differentInstance = factory.getTerminalService(undefined, 'New Title');
        const notTheSameInstance = differentInstance === instance;
        expect(notTheSameInstance).not.to.equal(true, 'Instances are the same');
    });

    test('Ensure different instance of terminal service is returned when title is provided', () => {
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
