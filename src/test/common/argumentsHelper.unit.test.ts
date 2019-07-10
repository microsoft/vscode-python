// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { anyString, instance, mock, when } from 'ts-mockito';
import { Logger } from '../../client/common/logger';
import { ILogger } from '../../client/common/types';
import { ServiceContainer } from '../../client/ioc/container';
import { IServiceContainer } from '../../client/ioc/types';
import { ArgumentsHelper } from '../../client/testing/common/argumentsHelper';

// tslint:disable-next-line: max-func-body-length
suite('ArgumentsHelper tests', () => {
    let argumentsHelper: ArgumentsHelper;

    setup(() => {
        const logger: ILogger = mock(Logger);
        when(logger.logWarning(anyString())).thenReturn();
        const serviceContainer: IServiceContainer = mock(ServiceContainer);
        when(serviceContainer.get<ILogger>(ILogger)).thenReturn(instance(logger));

        argumentsHelper = new ArgumentsHelper(instance(serviceContainer));
    });

    test('getOptionValues with an option should return the arg value after the option', () => {
        const args = ['arg1', '--foo', 'arg2'];
        const result = argumentsHelper.getOptionValues(args, '--foo');

        expect(result).to.be.a('string');
        expect(result).to.equal('arg2');
    });

    test('getOptionValues with a non-existent option should return nothing', () => {
        const args = ['arg1', '--foo', 'arg2'];
        const result = argumentsHelper.getOptionValues(args, '--bar');

        expect(result).to.be.a('undefined');
    });

    test('getOptionValues with an option followed by = should return the value part of the arg', () => {
        const args = ['arg1', '--foo=arg2', 'arg2'];
        const result = argumentsHelper.getOptionValues(args, '--foo');

        expect(result).to.be.a('string');
        expect(result).to.equal('arg2');
    });

    test('getOptionValues with an option repeated multiple times should return an array of values', () => {
        const args = ['arg1', '--foo', 'arg2', '--bar', '--foo', 'arg3'];
        const result = argumentsHelper.getOptionValues(args, '--foo') as string[];

        expect(result).to.be.a('array');
        expect(result).to.have.length(2);
        expect(result[0]).to.equal('arg2');
        expect(result[1]).to.equal('arg3');
    });

    test('getPositionalArguments with both options parameters should return correct positional arguments', () => {
        const args = ['arg1', '--foo', 'arg2', '--bar', 'arg3', 'arg4'];
        const optionsWithArguments = ['--bar'];
        const optionsWithoutArguments = ['--foo'];
        const result = argumentsHelper.getPositionalArguments(args, optionsWithArguments, optionsWithoutArguments);

        expect(result).to.have.length(3);
        expect(result).to.deep.equal(['arg1', 'arg2', 'arg4']);
    });

    test('getPositionalArguments with optionsWithArguments with inline `option=value` syntax should return correct positional arguments', () => {
        const args = ['arg1', '--foo', 'arg2', '--bar=arg3', 'arg4'];
        const optionsWithArguments = ['--bar'];
        const optionsWithoutArguments = ['--foo'];
        const result = argumentsHelper.getPositionalArguments(args, optionsWithArguments, optionsWithoutArguments);

        expect(result).to.have.length(3);
        expect(result).to.deep.equal(['arg1', 'arg2', 'arg4']);
    });

    test('getPositionalArguments with no options parameter should be the same as passing empty arrays', () => {
        const args = ['arg1', '--foo', 'arg2', '--bar', 'arg3', 'arg4'];
        const optionsWithArguments: string[] = [];
        const optionsWithoutArguments: string[] = [];
        const result = argumentsHelper.getPositionalArguments(args, optionsWithArguments, optionsWithoutArguments);

        expect(result).to.deep.equal(argumentsHelper.getPositionalArguments(args));
        expect(result).to.have.length(4);
        expect(result).to.deep.equal(['arg1', 'arg2', 'arg3', 'arg4']);
    });

    test('filterArguments with both options parameters should return correct filtered arguments', () => {
        const args = ['arg1', '--foo', 'arg2', '--bar', 'arg3', 'arg4'];
        const optionsWithArguments = ['--bar'];
        const optionsWithoutArguments = ['--foo'];
        const result = argumentsHelper.filterArguments(args, optionsWithArguments, optionsWithoutArguments);

        expect(result).to.have.length(3);
        expect(result).to.deep.equal(['arg1', 'arg2', 'arg4']);
    });

    test('filterArguments with optionsWithArguments with inline `option=value` syntax should return correct filtered arguments', () => {
        const args = ['arg1', '--foo', 'arg2', '--bar=arg3', 'arg4'];
        const optionsWithArguments = ['--bar'];
        const optionsWithoutArguments = ['--foo'];
        const result = argumentsHelper.filterArguments(args, optionsWithArguments, optionsWithoutArguments);

        expect(result).to.have.length(3);
        expect(result).to.deep.equal(['arg1', 'arg2', 'arg4']);
    });

    test('filterArguments should ignore wildcard args', () => {
        const args = ['arg1', '--foo', 'arg2', '--bar', 'arg3', 'arg4'];
        const optionsWithArguments = ['--bar'];
        const optionsWithoutArguments = ['--fo*'];
        const result = argumentsHelper.filterArguments(args, optionsWithArguments, optionsWithoutArguments);

        expect(result).to.have.length(3);
        expect(result).to.deep.equal(['arg1', 'arg2', 'arg4']);
    });

    test('filterArguments with no options parameter should be the same as passing empty arrays', () => {
        const args = ['arg1', '--foo', 'arg2', '--bar', 'arg3', 'arg4'];
        const optionsWithArguments: string[] = [];
        const optionsWithoutArguments: string[] = [];
        const result = argumentsHelper.filterArguments(args, optionsWithArguments, optionsWithoutArguments);

        expect(result).to.deep.equal(argumentsHelper.filterArguments(args));
        expect(result).to.have.length(6);
        expect(result).to.deep.equal(args);
    });
});
