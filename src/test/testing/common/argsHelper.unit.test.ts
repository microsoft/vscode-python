// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length no-any no-conditional-assignment no-increment-decrement no-invalid-this no-require-imports no-var-requires
import { expect, use } from 'chai';
import * as typeMoq from 'typemoq';
import { ILogger } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';
import { ArgumentsHelper } from '../../../client/testing/common/argumentsHelper';
import { IArgumentsHelper } from '../../../client/testing/types';
const assertArrays = require('chai-arrays');
use(assertArrays);

suite('Unit Tests - Arguments Helper', () => {
    let argsHelper: IArgumentsHelper;
    setup(() => {
        const serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        const logger = typeMoq.Mock.ofType<ILogger>();

        serviceContainer.setup(s => s.get(typeMoq.It.isValue(ILogger), typeMoq.It.isAny())).returns(() => logger.object);

        argsHelper = new ArgumentsHelper(serviceContainer.object);
    });

    test('Get Option Value', () => {
        const args = ['-abc', '1234', 'zys', '--root', 'value'];
        const value = argsHelper.getOptionValues(args, '--root');
        expect(value).to.not.be.array();
        expect(value).to.be.deep.equal('value');
    });
    test('Get Option Value when using =', () => {
        const args = ['-abc', '1234', 'zys', '--root=value'];
        const value = argsHelper.getOptionValues(args, '--root');
        expect(value).to.not.be.array();
        expect(value).to.be.deep.equal('value');
    });
    test('Get Option Values', () => {
        const args = ['-abc', '1234', 'zys', '--root', 'value1', '--root', 'value2'];
        const values = argsHelper.getOptionValues(args, '--root');
        expect(values).to.be.array();
        expect(values).to.be.lengthOf(2);
        expect(values).to.be.deep.equal(['value1', 'value2']);
    });
    test('Get Option Values when using =', () => {
        const args = ['-abc', '1234', 'zys', '--root=value1', '--root=value2'];
        const values = argsHelper.getOptionValues(args, '--root');
        expect(values).to.be.array();
        expect(values).to.be.lengthOf(2);
        expect(values).to.be.deep.equal(['value1', 'value2']);
    });
    test('Get Positional options', () => {
        const args = ['-abc', '1234', '--value-option', 'value1', '--no-value-option', 'value2'];
        const values = argsHelper.getPositionalArguments(args, ['--value-option', '-abc'], ['--no-value-option']);
        expect(values).to.be.array();
        expect(values).to.be.lengthOf(1);
        expect(values).to.be.deep.equal(['value2']);
    });
    test('Get multiple Positional options', () => {
        const args = ['-abc', '1234', '--value-option', 'value1', '--no-value-option', 'value2', 'value3'];
        const values = argsHelper.getPositionalArguments(args, ['--value-option', '-abc'], ['--no-value-option']);
        expect(values).to.be.array();
        expect(values).to.be.lengthOf(2);
        expect(values).to.be.deep.equal(['value2', 'value3']);
    });
    test('Get multiple Positional options and inline values', () => {
        const args = ['-abc=1234', '--value-option=value1', '--no-value-option', 'value2', 'value3'];
        const values = argsHelper.getPositionalArguments(args, ['--value-option', '-abc'], ['--no-value-option']);
        expect(values).to.be.array();
        expect(values).to.be.lengthOf(2);
        expect(values).to.be.deep.equal(['value2', 'value3']);
    });
    test('Get Positional options with trailing value option', () => {
        const args = ['-abc', '1234', '--value-option', 'value1', '--value-option', 'value2', 'value3'];
        const values = argsHelper.getPositionalArguments(args, ['--value-option', '-abc'], ['--no-value-option']);
        expect(values).to.be.array();
        expect(values).to.be.lengthOf(1);
        expect(values).to.be.deep.equal(['value3']);
    });
    test('Get multiple Positional options with trailing value option', () => {
        const args = ['-abc', '1234', '--value-option', 'value1', '--value-option', 'value2', 'value3', '4'];
        const values = argsHelper.getPositionalArguments(args, ['--value-option', '-abc'], ['--no-value-option']);
        expect(values).to.be.array();
        expect(values).to.be.lengthOf(2);
        expect(values).to.be.deep.equal(['value3', '4']);
    });
    test('Get Positional options with unknown args', () => {
        const args = ['-abc', '1234', '--value-option', 'value1', '--value-option', 'value2', 'value3', '4'];
        const values = argsHelper.getPositionalArguments(args, ['-abc'], ['--no-value-option']);
        expect(values).to.be.array();
        expect(values).to.be.lengthOf(4);
        expect(values).to.be.deep.equal(['value1', 'value2', 'value3', '4']);
    });
    test('Get Positional options with no options parameters', () => {
        const args = ['-abc', '1234', '--value-option', 'value1', '--value-option', 'value2', 'value3', '4'];
        const values = argsHelper.getPositionalArguments(args);
        expect(values).to.be.array();
        expect(values).to.be.lengthOf(5);
        expect(values).to.be.deep.equal(['1234', 'value1', 'value2', 'value3', '4']);
        expect(values).to.be.deep.equal(argsHelper.getPositionalArguments(args, [], []));
    });
    test('Filter to remove those with values', () => {
        const args = ['-abc', '1234', '--value-option', 'value1', '--value-option', 'value2', 'value3', '4'];
        const values = argsHelper.filterArguments(args, ['--value-option']);
        expect(values).to.be.array();
        expect(values).to.be.lengthOf(4);
        expect(values).to.be.deep.equal(['-abc', '1234', 'value3', '4']);
    });
    test('Filter to remove those without values', () => {
        const args = ['-abc', '1234', '--value-option', 'value1', '--no-value-option', 'value2', 'value3', '4'];
        const values = argsHelper.filterArguments(args, [], ['--no-value-option']);
        expect(values).to.be.array();
        expect(values).to.be.lengthOf(7);
        expect(values).to.be.deep.equal(['-abc', '1234', '--value-option', 'value1', 'value2', 'value3', '4']);
    });
    test('Filter to remove those with and without values', () => {
        const args = ['-abc', '1234', '--value-option', 'value1', '--value-option', 'value2', 'value3', '4'];
        const values = argsHelper.filterArguments(args, ['--value-option'], ['-abc']);
        expect(values).to.be.array();
        expect(values).to.be.lengthOf(3);
        expect(values).to.be.deep.equal(['1234', 'value3', '4']);
    });
});
