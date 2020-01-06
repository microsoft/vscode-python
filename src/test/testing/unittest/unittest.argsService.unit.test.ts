// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import * as typeMoq from 'typemoq';
import { ILogger } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { ArgumentsHelper } from '../../../client/testing/common/argumentsHelper';
import { IArgumentsHelper } from '../../../client/testing/types';
import { ArgumentsService as UnittestArgumentsService } from '../../../client/testing/unittest/services/argsService';

suite('ArgsService: unittest', () => {
    let argumentsService: UnittestArgumentsService;

    suiteSetup(() => {
        const serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        const logger = typeMoq.Mock.ofType<ILogger>();

        serviceContainer.setup(s => s.get(typeMoq.It.isValue(ILogger), typeMoq.It.isAny())).returns(() => logger.object);

        const argsHelper = new ArgumentsHelper(serviceContainer.object);

        serviceContainer.setup(s => s.get(typeMoq.It.isValue(IArgumentsHelper), typeMoq.It.isAny())).returns(() => argsHelper);

        argumentsService = new UnittestArgumentsService(serviceContainer.object);
    });

    test('Test getting the test folder in unittest with -s', () => {
        const dir = path.join('a', 'b', 'c');
        const args = ['anzy', '--one', '--three', '-s', dir];
        const testDirs = argumentsService.getTestFolders(args);
        expect(testDirs).to.be.lengthOf(1);
        expect(testDirs[0]).to.equal(dir);
    });
    test('Test getting the test folder in unittest with -s in the middle', () => {
        const dir = path.join('a', 'b', 'c');
        const args = ['anzy', '--one', '--three', '-s', dir, 'some other', '--value', '1234'];
        const testDirs = argumentsService.getTestFolders(args);
        expect(testDirs).to.be.lengthOf(1);
        expect(testDirs[0]).to.equal(dir);
    });
    test('Test getting the test folder in unittest with --start-directory', () => {
        const dir = path.join('a', 'b', 'c');
        const args = ['anzy', '--one', '--three', '--start-directory', dir];
        const testDirs = argumentsService.getTestFolders(args);
        expect(testDirs).to.be.lengthOf(1);
        expect(testDirs[0]).to.equal(dir);
    });
    test('Test getting the test folder in unittest with --start-directory in the middle', () => {
        const dir = path.join('a', 'b', 'c');
        const args = ['anzy', '--one', '--three', '--start-directory', dir, 'some other', '--value', '1234'];
        const testDirs = argumentsService.getTestFolders(args);
        expect(testDirs).to.be.lengthOf(1);
        expect(testDirs[0]).to.equal(dir);
    });
});
