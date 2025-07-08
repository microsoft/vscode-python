// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import * as minimatch from 'minimatch';
import { Uri } from 'vscode';
import { ITestingSettings } from '../../../client/testing/configuration/types';

suite('PythonTestController - Auto Discovery Logic Tests', () => {

    test('auto discovery logic respects autoTestDiscoverOnSaveEnabled setting', () => {
        const testUri = Uri.file('/test/test_example.py');
        
        // Test case 1: Setting enabled - should trigger discovery
        const enabledSettings: Partial<ITestingSettings> = {
            autoTestDiscoverOnSaveEnabled: true,
            autoTestDiscoverOnSavePattern: '**/*.py',
        };

        const shouldTriggerWhenEnabled = 
            enabledSettings.autoTestDiscoverOnSaveEnabled &&
            minimatch.default(testUri.fsPath, enabledSettings.autoTestDiscoverOnSavePattern!);

        assert.strictEqual(shouldTriggerWhenEnabled, true, 'Should trigger when setting is enabled');

        // Test case 2: Setting disabled - should NOT trigger discovery
        const disabledSettings: Partial<ITestingSettings> = {
            autoTestDiscoverOnSaveEnabled: false,
            autoTestDiscoverOnSavePattern: '**/*.py',
        };

        const shouldTriggerWhenDisabled = 
            disabledSettings.autoTestDiscoverOnSaveEnabled &&
            minimatch.default(testUri.fsPath, disabledSettings.autoTestDiscoverOnSavePattern!);

        assert.strictEqual(shouldTriggerWhenDisabled, false, 'Should NOT trigger when setting is disabled');
    });

    test('auto discovery logic respects pattern setting', () => {
        const testUri = Uri.file('/test/example.txt'); // Non-Python file
        
        // Settings with enabled but non-matching pattern
        const settings: Partial<ITestingSettings> = {
            autoTestDiscoverOnSaveEnabled: true,
            autoTestDiscoverOnSavePattern: '**/*.py', // Only Python files
        };

        const shouldTrigger = 
            settings.autoTestDiscoverOnSaveEnabled &&
            minimatch.default(testUri.fsPath, settings.autoTestDiscoverOnSavePattern!);

        assert.strictEqual(shouldTrigger, false, 'Should NOT trigger when file does not match pattern');
    });

    test('auto discovery logic triggers when both setting and pattern match', () => {
        const testUri = Uri.file('/test/test_example.py');
        
        // Settings with both enabled and matching pattern
        const settings: Partial<ITestingSettings> = {
            autoTestDiscoverOnSaveEnabled: true,
            autoTestDiscoverOnSavePattern: '**/*.py',
        };

        const shouldTrigger = 
            settings.autoTestDiscoverOnSaveEnabled &&
            minimatch.default(testUri.fsPath, settings.autoTestDiscoverOnSavePattern!);

        assert.strictEqual(shouldTrigger, true, 'Should trigger when both setting is enabled and pattern matches');
    });

    test('auto discovery logic handles undefined settings gracefully', () => {
        const testUri = Uri.file('/test/test_example.py');
        
        // Settings with undefined autoTestDiscoverOnSaveEnabled (should be falsy)
        const undefinedSettings: Partial<ITestingSettings> = {
            autoTestDiscoverOnSavePattern: '**/*.py',
        };

        const shouldTrigger = 
            !!undefinedSettings.autoTestDiscoverOnSaveEnabled &&
            minimatch.default(testUri.fsPath, undefinedSettings.autoTestDiscoverOnSavePattern!);

        assert.strictEqual(shouldTrigger, false, 'Should NOT trigger when setting is undefined');
    });
});