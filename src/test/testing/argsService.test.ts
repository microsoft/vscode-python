// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

// tslint:disable:max-func-body-length

import { fail } from 'assert';
import { expect } from 'chai';
import { spawnSync } from 'child_process';
import * as typeMoq from 'typemoq';
import { Product } from '../../client/common/types';
import { getNamesAndValues } from '../../client/common/utils/enum';
import { IServiceContainer } from '../../client/ioc/types';
import { ArgumentsHelper } from '../../client/testing/common/argumentsHelper';
import { UNIT_TEST_PRODUCTS } from '../../client/testing/common/constants';
import { ArgumentsService as NoseTestArgumentsService } from '../../client/testing/nosetest/services/argsService';
import { ArgumentsService as PyTestArgumentsService } from '../../client/testing/pytest/services/argsService';
import { IArgumentsHelper, IArgumentsService } from '../../client/testing/types';
import { ArgumentsService as UnitTestArgumentsService } from '../../client/testing/unittest/services/argsService';
import { PYTHON_PATH } from '../common';

suite('ArgsService: Common', () => {
    UNIT_TEST_PRODUCTS.forEach(product => {
        const productNames = getNamesAndValues(Product);
        const productName = productNames.find(item => item.value === product)!.name;
        suite(productName, () => {
            let argumentsService: IArgumentsService;
            let moduleName = '';
            let expectedWithArgs: string[] = [];
            let expectedWithoutArgs: string[] = [];

            setup(function() {
                // Take the spawning of process into account.
                // tslint:disable-next-line:no-invalid-this
                this.timeout(5000);
                const serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();

                const argsHelper = new ArgumentsHelper();

                serviceContainer.setup(s => s.get(typeMoq.It.isValue(IArgumentsHelper), typeMoq.It.isAny())).returns(() => argsHelper);

                switch (product) {
                    case Product.unittest: {
                        argumentsService = new UnitTestArgumentsService(serviceContainer.object);
                        moduleName = 'unittest';
                        break;
                    }
                    case Product.nosetest: {
                        argumentsService = new NoseTestArgumentsService(serviceContainer.object);
                        moduleName = 'nose';
                        break;
                    }
                    case Product.pytest: {
                        moduleName = 'pytest';
                        argumentsService = new PyTestArgumentsService(serviceContainer.object);
                        break;
                    }
                    default: {
                        throw new Error('Unrecognized Test Framework');
                    }
                }

                expectedWithArgs = getOptions(product, moduleName, true);
                expectedWithoutArgs = getOptions(product, moduleName, false);
            });

            test('Check for new/unrecognized options with values', () => {
                const options = argumentsService.getKnownOptions();
                const optionsNotFound = expectedWithArgs.filter(item => options.withArgs.indexOf(item) === -1);

                if (optionsNotFound.length > 0) {
                    fail('', optionsNotFound.join(', '), 'Options not found');
                }
            });
            test('Check for new/unrecognized options without values', () => {
                const options = argumentsService.getKnownOptions();
                const optionsNotFound = expectedWithoutArgs.filter(item => options.withoutArgs.indexOf(item) === -1);

                if (optionsNotFound.length > 0) {
                    fail('', optionsNotFound.join(', '), 'Options not found');
                }
            });
            test('Test getting value for an option with a single value', () => {
                for (const option of expectedWithArgs) {
                    const args = ['--some-option-with-a-value', '1234', '--another-value-with-inline=1234', option, 'abcd'];
                    const value = argumentsService.getOptionValue(args, option);
                    expect(value).to.equal('abcd');
                }
            });
            test('Test getting value for an option with a multiple value', () => {
                for (const option of expectedWithArgs) {
                    const args = ['--some-option-with-a-value', '1234', '--another-value-with-inline=1234', option, 'abcd', option, 'xyz'];
                    const value = argumentsService.getOptionValue(args, option);
                    expect(value).to.deep.equal(['abcd', 'xyz']);
                }
            });
            test('Test filtering of arguments', () => {
                const args: string[] = [];
                const knownOptions = argumentsService.getKnownOptions();
                const argumentsToRemove: string[] = [];
                const expectedFilteredArgs: string[] = [];
                // Generate some random arguments.
                for (let i = 0; i < 5; i += 1) {
                    args.push(knownOptions.withArgs[i], `Random Value ${i}`);
                    args.push(knownOptions.withoutArgs[i]);

                    if (i % 2 === 0) {
                        argumentsToRemove.push(knownOptions.withArgs[i], knownOptions.withoutArgs[i]);
                    } else {
                        expectedFilteredArgs.push(knownOptions.withArgs[i], `Random Value ${i}`);
                        expectedFilteredArgs.push(knownOptions.withoutArgs[i]);
                    }
                }

                const filteredArgs = argumentsService.filterArguments(args, argumentsToRemove);
                expect(filteredArgs).to.be.deep.equal(expectedFilteredArgs);
            });
        });
    });
});

function getOptions(product: Product, moduleName: string, withValues: boolean) {
    const result = spawnSync(PYTHON_PATH, ['-m', moduleName, '-h']);
    const output = result.stdout.toString();

    // Our regex isn't the best, so lets exclude stuff that shouldn't be captured.
    const knownOptionsWithoutArgs: string[] = [];
    const knownOptionsWithArgs: string[] = [];
    if (product === Product.pytest) {
        knownOptionsWithArgs.push(...['-c', '-p', '-r']);
    }

    if (withValues) {
        return getOptionsWithArguments(output)
            .concat(...knownOptionsWithArgs)
            .filter(item => knownOptionsWithoutArgs.indexOf(item) === -1)
            .sort();
    } else {
        return (
            getOptionsWithoutArguments(output)
                .concat(...knownOptionsWithoutArgs)
                .filter(item => knownOptionsWithArgs.indexOf(item) === -1)
                // In pytest, any option beginning with --log- is known to have args.
                .filter(item => (product === Product.pytest ? !item.startsWith('--log-') : true))
                .sort()
        );
    }
}

function getOptionsWithoutArguments(output: string) {
    return getMatches('\\s{1,}(-{1,2}[A-Za-z0-9-]+)(?:,|\\s{2,})', output);
}
function getOptionsWithArguments(output: string) {
    return getMatches('\\s{1,}(-{1,2}[A-Za-z0-9-]+)(?:=|\\s{0,1}[A-Z])', output);
}

// tslint:disable-next-line:no-any
function getMatches(pattern: any, str: string) {
    const matches: string[] = [];
    const regex = new RegExp(pattern, 'gm');
    let result: RegExpExecArray | null = regex.exec(str);
    while (result !== null) {
        if (result.index === regex.lastIndex) {
            regex.lastIndex += 1;
        }
        matches.push(result[1].trim());
        result = regex.exec(str);
    }
    return matches.sort().reduce<string[]>((items, item) => (items.indexOf(item) === -1 ? items.concat([item]) : items), []);
}
