// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { getOptionValues } from '../../../../client/testing/testController/common/argumentsHelper';

suite('Argument Helper Tests - getOptionValues', () => {
    interface ITestData {
        args: string[];
        option: string;
        expected: string[];
    }
    const testData: ITestData[] = [
        {
            args: [],
            option: '--one',
            expected: [],
        },
        {
            args: ['--one', '1'],
            option: '--one',
            expected: ['1'],
        },
        {
            args: ['--one', '1', '--end'],
            option: '--one',
            expected: ['1'],
        },
        {
            args: ['--zero', '--one', '1', '--end'],
            option: '--one',
            expected: ['1'],
        },
        {
            args: ['--zero', '--one=1', '--end'],
            option: '--one',
            expected: ['1'],
        },
        {
            args: ['--zero', '--many=1', '--many=2', '--many=3', '--end'],
            option: '--many',
            expected: ['1', '2', '3'],
        },
        {
            args: ['--zero', '--spaces', '1 2 3', '--end'],
            option: '--spaces',
            expected: ['1 2 3'],
        },
    ];

    testData.forEach((data) => {
        test(`getOptionValues([${data.args}],'${data.option}')`, () => {
            assert.deepStrictEqual(getOptionValues(data.args, data.option), data.expected);
        });
    });
});
