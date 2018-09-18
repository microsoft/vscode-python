// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { SemVer } from 'semver';
import * as typeMoq from 'typemoq';
import { IHttpClient } from '../../client/activation/types';
import { NugetRepo } from '../../client/common/nugetRepo';
import { IServiceContainer } from '../../client/ioc/types';

suite('Nuget Repo', () => {
    let serviceContainer: typeMoq.IMock<IServiceContainer>;
    let httpClient: typeMoq.IMock<IHttpClient>;
    let nugetRepo: NugetRepo;
    setup(() => {
        serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        httpClient = typeMoq.Mock.ofType<IHttpClient>();
        serviceContainer.setup(c => c.get(typeMoq.It.isValue(IHttpClient))).returns(() => httpClient.object);

        nugetRepo = new NugetRepo(serviceContainer.object);
    });

    test('Get all package versions', async () => {
        const packageBaseAddress = 'a';
        const packageName = 'b';
        const resp = { versions: ['1.1.1', '1.2.1'] };
        const expectedUri = `${packageBaseAddress}/${packageName.toLowerCase().trim()}/index.json`;

        httpClient
            .setup(h => h.getJSON(typeMoq.It.isValue(expectedUri)))
            .returns(() => Promise.resolve(resp))
            .verifiable(typeMoq.Times.once());

        const versions = await nugetRepo.getVersions(packageBaseAddress, packageName);

        httpClient.verifyAll();
        expect(versions).to.be.lengthOf(2);
        expect(versions.map(item => item.raw)).to.deep.equal(resp.versions);
    });

    test('Get package uri', async () => {
        const packageBaseAddress = 'a';
        const packageName = 'b';
        const version = '1.1.3';
        const expectedUri = `${packageBaseAddress}/${packageName}/${version}/${packageName}.${version}.nupkg`;

        const packageUri = nugetRepo.getNugetPackageUri(packageBaseAddress, packageName, new SemVer(version));

        httpClient.verifyAll();
        expect(packageUri).to.equal(expectedUri);
    });

    test('Get latest version (with major version provided)', async () => {
        const packageBaseAddress = 'a';
        const packageName = 'b';
        const version = '2.5.4';

        const versions = ['1.1.1', '1.2.1', '2.2.2', '2.5.4', '2.9.5-release', '2.7.4-beta', '2.0.2', '3.5.4'];
        nugetRepo.getVersions = () => Promise.resolve(versions.map(v => new SemVer(v)));
        nugetRepo.getNugetPackageUri = () => 'uri';

        const info = await nugetRepo.getLatestVersion(packageBaseAddress, packageName, 2);

        expect(info.uri).to.equal('uri');
        expect(info.package).to.equal(packageName);
        expect(info.version.raw).to.equal(version);
    });

    test('Get latest version (without major version provided)', async () => {
        const packageBaseAddress = 'a';
        const packageName = 'b';
        const version = '3.5.4';

        const versions = ['1.1.1', '1.2.1', '2.2.2', '2.5.4', '2.9.5-release', '2.7.4-beta', '2.0.2', '3.5.4', '5.9.5-release', '3.7.4-beta'];
        nugetRepo.getVersions = () => Promise.resolve(versions.map(v => new SemVer(v)));
        nugetRepo.getNugetPackageUri = () => 'uri';

        const info = await nugetRepo.getLatestVersion(packageBaseAddress, packageName);

        expect(info.uri).to.equal('uri');
        expect(info.package).to.equal(packageName);
        expect(info.version.raw).to.equal(version);
    });
});
