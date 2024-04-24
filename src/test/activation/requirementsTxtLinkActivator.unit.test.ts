// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import { generatePyPiLink } from '../../client/activation/requirementsTxtLinkActivator';

/** *
requests [security] >= 2.8.1, == 2.8.* ; python_version < "2.7"
urllib3 @ https://github.com/urllib3/urllib3/archive/refs/tags/1.26.8.zip

# It is possible to refer to other requirement files or constraints files.
-r other-requirements.txt
-c constraints.txt

# It is possible to refer to specific local distribution paths.
./downloads/numpy-1.9.2-cp34-none-win32.whl

# It is possible to refer to URLs.
http://wxpython.org/Phoenix/snapshot-builds/wxPython_Phoenix-3.0.3.dev1820+49a8884-cp34-none-win_amd64.whl

 */

suite('Link to PyPi in requiements test', () => {
    test('Check if all possible project name are matched', () => {
        const rows = [
            ['pytest', 'pytest'],
            ['pytest-cov', 'pytest-cov'],
            ['pytest_cov', 'pytest_cov'],
            ['pytest_cov[an_extra]', 'pytest_cov'],
            ['pytest == 0.6.1', 'pytest'],
            ['pytest== 0.6.1', 'pytest'],
            ['requests [security] >= 2.8.1, == 2.8.* ; python_version < "2.7"', 'requests'],
            ['# a comment', null],
            ['', null],
        ];

        rows.forEach(([input, expected]) => {
            expect(RequirementsTxtLinkActivator.generatePyPiLink(input)).equal(expected ? `https://pypi.org/project/${expected}/`: null);
        });
    });
});
