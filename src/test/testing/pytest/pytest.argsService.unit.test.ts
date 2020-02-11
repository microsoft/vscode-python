// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as path from 'path';
import * as typeMoq from 'typemoq';
import { IServiceContainer } from '../../../client/ioc/types';
import { ArgumentsHelper } from '../../../client/testing/common/argumentsHelper';
import { ArgumentsService as PyTestArgumentsService } from '../../../client/testing/pytest/services/argsService';
import { IArgumentsHelper } from '../../../client/testing/types';

suite('ArgsService: pytest', () => {
    let argumentsService: PyTestArgumentsService;

    suiteSetup(() => {
        const serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();

        const argsHelper = new ArgumentsHelper();

        serviceContainer
            .setup(s => s.get(typeMoq.It.isValue(IArgumentsHelper), typeMoq.It.isAny()))
            .returns(() => argsHelper);

        argumentsService = new PyTestArgumentsService(serviceContainer.object);
    });

    test('Test getting the test folder in pytest', () => {
        const dir = path.join('a', 'b', 'c');
        const args = ['--one', '--rootdir', dir];
        const testDirs = argumentsService.getTestFolders(args);
        expect(testDirs).to.be.lengthOf(1);
        expect(testDirs[0]).to.equal(dir);
    });
    test('Test getting the test folder in pytest (with folder before the arguments)', () => {
        const dir = path.join('a', 'b', 'c');
        const args = [dir, '--one', '--rootdir'];
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
        const args = ['--one', dir];
        const testDirs = argumentsService.getTestFolders(args);
        expect(testDirs).to.be.lengthOf(1);
        expect(testDirs[0]).to.equal(dir);
    });
    test('Test getting the test folder in pytest (with multiple positional dirs)', () => {
        const dir = path.join('a', 'b', 'c');
        const dir2 = path.join('a', 'b', '2');
        const args = ['--one', dir, dir2];
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
        expect(testDirs).to.be.lengthOf(3);
        expect(testDirs[0]).to.equal('anzy');
        expect(testDirs[1]).to.equal(dir);
        expect(testDirs[2]).to.equal(dir2);
    });
    test('Test getting the list of known options for pytest', () => {
        const knownOptions = argumentsService.getKnownOptions();
        expect(knownOptions.withArgs.length).to.not.equal(0);
        expect(knownOptions.withoutArgs.length).to.not.equal(0);
    });
    test('Test calling ArgumentsService.getOptionValue with the option followed by the value', () => {
        const knownOptionsWithValues = argumentsService.getKnownOptions().withArgs;
        knownOptionsWithValues.forEach(option => {
            const args = ['--foo', '--bar', 'arg1', option, 'value1'];
            expect(argumentsService.getOptionValue(args, option)).to.deep.equal('value1');
        });
    });
    test('Test calling ArgumentsService.getOptionValue with the inline option syntax', () => {
        const knownOptionsWithValues = argumentsService.getKnownOptions().withArgs;
        knownOptionsWithValues.forEach(option => {
            const args = ['--foo', '--bar', 'arg1', `${option}=value1`];
            expect(argumentsService.getOptionValue(args, option)).to.deep.equal('value1');
        });
    });
});
