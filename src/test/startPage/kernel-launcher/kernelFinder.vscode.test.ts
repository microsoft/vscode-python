// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { assert } from 'chai';
import { Uri, workspace } from 'vscode';
import { PYTHON_LANGUAGE } from '../../../client/common/constants';
import { IKernelFinder } from '../../../client/datascience/kernel-launcher/types';
import { IExtensionTestApi } from '../../common';
import { initialize } from '../../initialize';

// tslint:disable: no-any no-invalid-this
suite('DataScience - Kernels Finder', () => {
    let api: IExtensionTestApi;
    let kernelFinder: IKernelFinder;
    let resourceToUse: Uri;
    suiteSetup(async () => {
        api = await initialize();
        kernelFinder = api.serviceContainer.get<IKernelFinder>(IKernelFinder);
        resourceToUse = workspace.workspaceFolders![0].uri;
    });
    test('Can list all kernels', async () => {
        const kernelSpecs = await kernelFinder.listKernelSpecs(resourceToUse);
        assert.isArray(kernelSpecs);
        assert.isAtLeast(kernelSpecs.length, 1);
    });
    test('No kernel returned if query is not provided', async () => {
        const kernelSpec = await kernelFinder.findKernelSpec(resourceToUse);
        assert.isUndefined(kernelSpec);
    });
    test('No kernel returned if no matching kernel found for language', async () => {
        const kernelSpec = await kernelFinder.findKernelSpec(resourceToUse, {
            language_info: { name: 'foobar' },
            orig_nbformat: 4
        });
        assert.isUndefined(kernelSpec);
    });
    test('No kernel returned if no matching kernel found', async () => {
        const kernelSpec = await kernelFinder.findKernelSpec(resourceToUse, {
            kernelspec: { display_name: 'foobar', name: 'foobar' },
            orig_nbformat: 4
        });
        assert.isUndefined(kernelSpec);
    });
    test('No kernel returned if kernelspec metadata not provided', async () => {
        const kernelSpec = await kernelFinder.findKernelSpec(resourceToUse, {
            kernelspec: undefined,
            orig_nbformat: 4
        });
        assert.isUndefined(kernelSpec);
    });
    test('Can find a Python kernel based on language', async () => {
        const kernelSpec = await kernelFinder.findKernelSpec(resourceToUse, {
            language_info: { name: PYTHON_LANGUAGE },
            orig_nbformat: 4
        });
        assert.ok(kernelSpec);
        assert.equal(kernelSpec?.language, PYTHON_LANGUAGE);
    });
    test('Can find a Python kernel based on language (non-python-kernel)', async function () {
        if (!process.env.VSC_PYTHON_CI_NON_PYTHON_NB_TEST) {
            return this.skip();
        }

        const kernelSpec = await kernelFinder.findKernelSpec(resourceToUse, {
            language_info: { name: 'julia' },
            orig_nbformat: 4
        });
        assert.ok(kernelSpec);
        assert.equal(kernelSpec?.language, 'julia');
    });
    test('Can find a Julia kernel based on kernelspec (non-python-kernel)', async function () {
        if (!process.env.VSC_PYTHON_CI_NON_PYTHON_NB_TEST) {
            return this.skip();
        }
        const kernelSpecs = await kernelFinder.listKernelSpecs(resourceToUse);
        const juliaKernelSpec = kernelSpecs.find((item) => item.language === 'julia');
        assert.ok(juliaKernelSpec);

        const kernelSpec = await kernelFinder.findKernelSpec(resourceToUse, {
            kernelspec: juliaKernelSpec as any,
            orig_nbformat: 4
        });
        assert.ok(kernelSpec);
        assert.deepEqual(kernelSpec, juliaKernelSpec);
    });
});
