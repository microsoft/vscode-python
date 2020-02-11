// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { parse } from 'semver';
import { NugetService } from '../../../client/common/nuget/nugetService';

suite('Nuget Service', () => {
    test('Identifying release versions', async () => {
        const service = new NugetService();

        expect(service.isReleaseVersion(parse('0.1.1')!)).to.be.equal(true, 'incorrect');
        expect(service.isReleaseVersion(parse('0.1.1-1')!)).to.be.equal(false, 'incorrect');
        expect(service.isReleaseVersion(parse('0.1.1-release')!)).to.be.equal(false, 'incorrect');
        expect(service.isReleaseVersion(parse('0.1.1-preview')!)).to.be.equal(false, 'incorrect');
    });

    test('Get package version', async () => {
        const service = new NugetService();
        expect(service.getVersionFromPackageFileName('Something-xyz.0.0.1.nupkg').compare(parse('0.0.1')!)).to.equal(
            0,
            'incorrect'
        );
        expect(
            service.getVersionFromPackageFileName('Something-xyz.0.0.1.1234.nupkg').compare(parse('0.0.1-1234')!)
        ).to.equal(0, 'incorrect');
        expect(
            service.getVersionFromPackageFileName('Something-xyz.0.0.1-preview.nupkg').compare(parse('0.0.1-preview')!)
        ).to.equal(0, 'incorrect');
    });
});
