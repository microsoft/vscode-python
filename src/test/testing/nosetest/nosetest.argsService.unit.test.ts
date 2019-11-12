// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import * as typeMoq from 'typemoq';
import { ILogger } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { ArgumentsHelper } from '../../../client/testing/common/argumentsHelper';
import { ArgumentsService as NoseTestArgumentsService } from '../../../client/testing/nosetest/services/argsService';
import { IArgumentsHelper } from '../../../client/testing/types';

suite('ArgsService: nosetest', () => {
    let argumentsService: NoseTestArgumentsService;

    suiteSetup(() => {
        const serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        const logger = typeMoq.Mock.ofType<ILogger>();

        serviceContainer.setup(s => s.get(typeMoq.It.isValue(ILogger), typeMoq.It.isAny())).returns(() => logger.object);

        const argsHelper = new ArgumentsHelper(serviceContainer.object);

        serviceContainer.setup(s => s.get(typeMoq.It.isValue(IArgumentsHelper), typeMoq.It.isAny())).returns(() => argsHelper);

        argumentsService = new NoseTestArgumentsService(serviceContainer.object);
    });

    test('Test getting the test folder in nosetest', () => {
        const dir = path.join('a', 'b', 'c');
        const args = ['--one', '--three', dir];
        const testDirs = argumentsService.getTestFolders(args);
        expect(testDirs).to.be.lengthOf(1);
        expect(testDirs[0]).to.equal(dir);
    });
    test('Test getting the test folder in nosetest (with multiple dirs)', () => {
        const dir = path.join('a', 'b', 'c');
        const dir2 = path.join('a', 'b', '2');
        const args = ['anzy', '--one', '--three', dir, dir2];
        const testDirs = argumentsService.getTestFolders(args);
        expect(testDirs).to.be.lengthOf(3);
        expect(testDirs[0]).to.equal('anzy');
        expect(testDirs[1]).to.equal(dir);
        expect(testDirs[2]).to.equal(dir2);
    });
});
