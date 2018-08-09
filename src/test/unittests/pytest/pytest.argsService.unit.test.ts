// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import * as typeMoq from 'typemoq';
import { ILogger } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { ArgumentsHelper } from '../../../client/unittests/common/argumentsHelper';
import { ArgumentsService as PyTestArgumentsService } from '../../../client/unittests/pytest/services/argsService';
import { IArgumentsHelper } from '../../../client/unittests/types';

suite('ArgsService: pytest', () => {
    let argumentsService: PyTestArgumentsService;

    suiteSetup(() => {
        const serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        const logger = typeMoq.Mock.ofType<ILogger>();

        serviceContainer
            .setup(s => s.get(typeMoq.It.isValue(ILogger), typeMoq.It.isAny()))
            .returns(() => logger.object);

        const argsHelper = new ArgumentsHelper(serviceContainer.object);

        serviceContainer
            .setup(s => s.get(typeMoq.It.isValue(IArgumentsHelper), typeMoq.It.isAny()))
            .returns(() => argsHelper);

        argumentsService = new PyTestArgumentsService(serviceContainer.object);
    });

    test('Test getting the test folder in pytest', () => {
        const dir = path.join('a', 'b', 'c');
        const args = ['anzy', '--one', '--rootdir', dir];
        const testDirs = argumentsService.getTestFolders(args);
        expect(testDirs).to.be.lengthOf(1);
        expect(testDirs[0]).to.equal(dir);
    });
    test('Test getting the test folder in pytest (with multiple dirs)', () => {
        const dir = path.join('a', 'b', 'c');
        const dir2 = path.join('a', 'b', '2');
        const args = ['anzy', '--one', '--rootdir', dir, '--rootdir', dir2];
        const testDirs = argumentsService.getTestFolders(args);
        expect(testDirs).to.be.lengthOf(2);
        expect(testDirs[0]).to.equal(dir);
        expect(testDirs[1]).to.equal(dir2);
    });
    test('Test getting the test folder in pytest (with multiple dirs in the middle)', () => {
        const dir = path.join('a', 'b', 'c');
        const dir2 = path.join('a', 'b', '2');
        const args = ['anzy', '--one', '--rootdir', dir, '--rootdir', dir2, '-xyz'];
        const testDirs = argumentsService.getTestFolders(args);
        expect(testDirs).to.be.lengthOf(2);
        expect(testDirs[0]).to.equal(dir);
        expect(testDirs[1]).to.equal(dir2);
    });
    test('Test getting the test folder in pytest (with single positional dir)', () => {
        const dir = path.join('a', 'b', 'c');
        const args = ['anzy', '--one', dir];
        const testDirs = argumentsService.getTestFolders(args);
        expect(testDirs).to.be.lengthOf(1);
        expect(testDirs[0]).to.equal(dir);
    });
    test('Test getting the test folder in pytest (with multiple positional dirs)', () => {
        const dir = path.join('a', 'b', 'c');
        const dir2 = path.join('a', 'b', '2');
        const args = ['anzy', '--one', dir, dir2];
        const testDirs = argumentsService.getTestFolders(args);
        expect(testDirs).to.be.lengthOf(2);
        expect(testDirs[0]).to.equal(dir);
        expect(testDirs[1]).to.equal(dir2);
    });
    test('Test getting the test folder in pytest (with multiple dirs excluding python files)', () => {
        const dir = path.join('a', 'b', 'c');
        const dir2 = path.join('a', 'b', '2');
        const args = ['anzy', '--one', dir, dir2, path.join(dir, 'one.py')];
        const testDirs = argumentsService.getTestFolders(args);
        expect(testDirs).to.be.lengthOf(2);
        expect(testDirs[0]).to.equal(dir);
        expect(testDirs[1]).to.equal(dir2);
    });
});
