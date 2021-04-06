// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { SemVer } from 'semver';
import * as typeMoq from 'typemoq';
import { NugetRepository } from '../../../client/common/nuget/nugetRepository';
import { IHttpClient } from '../../../client/common/types';
import { IServiceContainer } from '../../../client/ioc/types';

suite('Nuget on Nuget Repo', () => {
    let serviceContainer: typeMoq.IMock<IServiceContainer>;
    let httpClient: typeMoq.IMock<IHttpClient>;
    let nugetRepo: NugetRepository;
    setup(() => {
        serviceContainer = typeMoq.Mock.ofType<IServiceContainer>();
        httpClient = typeMoq.Mock.ofType<IHttpClient>();
        serviceContainer.setup((c) => c.get(typeMoq.It.isValue(IHttpClient))).returns(() => httpClient.object);

        nugetRepo = new NugetRepository(serviceContainer.object);
    });

    test('Get all package versions', async () => {
        const packageBaseAddress = 'a';
        const packageName = 'b';
        const resp = { versions: ['1.1.1', '1.2.1'] };
        const expectedUri = `${packageBaseAddress}/${packageName.toLowerCase().trim()}/index.json`;

        httpClient
            .setup((h) => h.getJSON(typeMoq.It.isValue(expectedUri)))
            .returns(() => Promise.resolve(resp))
            .verifiable(typeMoq.Times.once());

        const versions = await nugetRepo.getVersions(packageBaseAddress, packageName);

        httpClient.verifyAll();
        expect(versions).to.be.lengthOf(2);
        expect(versions.map((item) => item.raw)).to.deep.equal(resp.versions);
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

    test('Get packages', async () => {
        const versions = ['1.1.1', '1.2.1', '2.2.2', '2.5.4', '2.9.5-release', '2.7.4-beta', '2.0.2', '3.5.4'];
        nugetRepo.getVersions = () => Promise.resolve(versions.map((v) => new SemVer(v)));
        nugetRepo.getNugetPackageUri = () => 'uri';

        const packages = await nugetRepo.getPackages('packageName');

        expect(packages).to.be.lengthOf(versions.length);
        expect(packages.map((item) => item.version.raw)).to.be.deep.equal(versions);
        expect(packages.map((item) => item.uri)).to.be.deep.equal(versions.map(() => 'uri'));
        expect(packages.map((item) => item.package)).to.be.deep.equal(versions.map(() => 'packageName'));
    });
});
