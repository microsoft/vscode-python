// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { expect } from 'chai';
import { Uri } from 'vscode';
import { buildErrorNodeOptions } from '../../../../client/testing/testController/common/utils';

suite('buildErrorNodeOptions - missing module detection', () => {
    const workspaceUri = Uri.file('/test/workspace');

    test('Should detect pytest ModuleNotFoundError and show missing module label', () => {
        const errorMessage =
            'Traceback (most recent call last):\n  File "<string>", line 1, in <module>\n    import pytest\nModuleNotFoundError: No module named \'pytest\'';

        const result = buildErrorNodeOptions(workspaceUri, errorMessage, 'pytest');

        expect(result.label).to.equal('Missing Module: pytest [workspace]');
        expect(result.error).to.equal(
            "The module 'pytest' is not installed in the selected Python environment. Please install it to enable test discovery.",
        );
    });

    test('Should detect pytest ImportError and show missing module label', () => {
        const errorMessage = 'ImportError: No module named pytest';

        const result = buildErrorNodeOptions(workspaceUri, errorMessage, 'pytest');

        expect(result.label).to.equal('Missing Module: pytest [workspace]');
        expect(result.error).to.equal(
            "The module 'pytest' is not installed in the selected Python environment. Please install it to enable test discovery.",
        );
    });

    test('Should detect other missing modules and show module name in label', () => {
        const errorMessage =
            "bob\\test_bob.py:3: in <module>\n    import requests\nE   ModuleNotFoundError: No module named 'requests'\n=========================== short test summary info";

        const result = buildErrorNodeOptions(workspaceUri, errorMessage, 'pytest');

        expect(result.label).to.equal('Missing Module: requests [workspace]');
        expect(result.error).to.equal(
            "The module 'requests' is not installed in the selected Python environment. Please install it to enable test discovery.",
        );
    });

    test('Should detect missing module with double quotes', () => {
        const errorMessage = 'ModuleNotFoundError: No module named "numpy"';

        const result = buildErrorNodeOptions(workspaceUri, errorMessage, 'pytest');

        expect(result.label).to.equal('Missing Module: numpy [workspace]');
        expect(result.error).to.equal(
            "The module 'numpy' is not installed in the selected Python environment. Please install it to enable test discovery.",
        );
    });

    test('Should use generic error for non-module-related errors', () => {
        const errorMessage = 'Some other error occurred';

        const result = buildErrorNodeOptions(workspaceUri, errorMessage, 'pytest');

        expect(result.label).to.equal('pytest Discovery Error [workspace]');
        expect(result.error).to.equal('Some other error occurred');
    });

    test('Should detect missing module for unittest errors', () => {
        const errorMessage = "ModuleNotFoundError: No module named 'pandas'";

        const result = buildErrorNodeOptions(workspaceUri, errorMessage, 'unittest');

        expect(result.label).to.equal('Missing Module: pandas [workspace]');
        expect(result.error).to.equal(
            "The module 'pandas' is not installed in the selected Python environment. Please install it to enable test discovery.",
        );
    });

    test('Should use generic error for unittest non-module errors', () => {
        const errorMessage = 'Some other error occurred';

        const result = buildErrorNodeOptions(workspaceUri, errorMessage, 'unittest');

        expect(result.label).to.equal('Unittest Discovery Error [workspace]');
        expect(result.error).to.equal('Some other error occurred');
    });

    test('Should use project name in label when projectName is provided', () => {
        const errorMessage = 'Some error occurred';

        const result = buildErrorNodeOptions(workspaceUri, errorMessage, 'unittest', 'my-project');

        expect(result.label).to.equal('Unittest Discovery Error [my-project]');
        expect(result.error).to.equal('Some error occurred');
    });

    test('Should use project name in label for pytest when projectName is provided', () => {
        const errorMessage = 'Some error occurred';

        const result = buildErrorNodeOptions(workspaceUri, errorMessage, 'pytest', 'ada');

        expect(result.label).to.equal('pytest Discovery Error [ada]');
        expect(result.error).to.equal('Some error occurred');
    });

    test('Should use folder name when projectName is undefined', () => {
        const errorMessage = 'Some error occurred';

        const result = buildErrorNodeOptions(workspaceUri, errorMessage, 'unittest', undefined);

        expect(result.label).to.equal('Unittest Discovery Error [workspace]');
    });
});
