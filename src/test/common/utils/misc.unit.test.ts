// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import { Disableable } from '../../../client/common/utils/misc';

suite('common utils - Disableable', () => {
    test('initial state', () => {
        const obj = new Disableable();

        const current = obj.isEnabled;

        assert.ok(current);
    });

    test('enable - currently disabled', () => {
        const obj = new Disableable();
        obj.disable();

        obj.enable();
        const current = obj.isEnabled;

        assert.ok(current);
    });

    test('enable - currently enabled', () => {
        const obj = new Disableable();

        obj.enable();
        const current = obj.isEnabled;

        assert.ok(current);
    });

    test('disable - currently enabled', () => {
        const obj = new Disableable();

        obj.disable();
        const current = obj.isEnabled;

        assert.equal(current, false);
    });

    test('disable - currently disabled', () => {
        const obj = new Disableable();
        obj.disable();

        obj.disable();
        const current = obj.isEnabled;

        assert.equal(current, false);
    });
});
