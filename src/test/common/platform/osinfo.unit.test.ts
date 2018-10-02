// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as semver from 'semver';
import { getPathVariableName, getVirtualEnvBinName } from '../../../client/common/platform/osinfo';
import * as platform from '../../../client/common/utils/platform';
import { parseVersion } from '../../../client/common/utils/version';

export const WIN_10 = new platform.Info(
    platform.OSType.Windows,
    'x64',
    new semver.SemVer('10.0.1'));
export const MAC_HIGH_SIERRA = new platform.Info(
    platform.OSType.OSX,
    'x64',
    new semver.SemVer('10.13.1'));
export const UBUNTU_BIONIC = new platform.Info(
    platform.OSType.Linux,
    'x64',
    parseVersion('18.04'),
    //semver.coerce('18.04') || new semver.SemVer('0.0.0'),
    platform.OSDistro.Ubuntu);

// tslint:disable-next-line:max-func-body-length
suite('OS Info - helpers', () => {
    test('getPathVariableName - Windows', async () => {
        const result = getPathVariableName(WIN_10);

        expect(result).to.be.equal('Path', 'invalid value');
    });

    test('getPathVariableName - Mac', async () => {
        const result = getPathVariableName(MAC_HIGH_SIERRA);

        expect(result).to.be.equal('PATH', 'invalid value');
    });

    test('getPathVariableName - Linux', async () => {
        const result = getPathVariableName(UBUNTU_BIONIC);

        expect(result).to.be.equal('PATH', 'invalid value');
    });

    test('getVirtualEnvBinName - Windows', async () => {
        const result = getVirtualEnvBinName(WIN_10);

        expect(result).to.be.equal('scripts', 'invalid value');
    });

    test('getVirtualEnvBinName - Mac', async () => {
        const result = getVirtualEnvBinName(MAC_HIGH_SIERRA);

        expect(result).to.be.equal('bin', 'invalid value');
    });

    test('getVirtualEnvBinName - Linux', async () => {
        const result = getVirtualEnvBinName(UBUNTU_BIONIC);

        expect(result).to.be.equal('bin', 'invalid value');
    });
});
