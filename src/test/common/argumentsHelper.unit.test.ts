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

suite('ArgumentsHelper tests', () => {
    let argumentsHelper: ArgumentsHelper;

    setup(() => {
        const logger: ILogger = mock(Logger);
        when(logger.logWarning(anyString())).thenReturn();
        const serviceContainer: IServiceContainer = mock(ServiceContainer);
        when(serviceContainer.get<ILogger>(ILogger)).thenReturn(instance(logger));

        argumentsHelper = new ArgumentsHelper(instance(serviceContainer));
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

    test('getPositionalArguments with unknown arguments with inline `option=value` syntax should return correct positional arguments', () => {
        const args = ['arg1', '--foo', 'arg2', 'bar=arg3', 'arg4'];
        const optionsWithArguments: string[] = [];
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
});
