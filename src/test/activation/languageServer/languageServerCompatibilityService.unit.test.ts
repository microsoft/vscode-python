// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { expect } from 'chai';
import * as typeMoq from 'typemoq';
import { LanguageServerCompatibilityService } from '../../../client/activation/languageServer/languageServerCompatibilityService';
import { ILanguageServerCompatibilityService } from '../../../client/activation/types';
import { IDotNetCompatibilityService } from '../../../client/common/dotnet/types';

suite('Language Server Support', () => {
    let compatService: typeMoq.IMock<IDotNetCompatibilityService>;
    let service: ILanguageServerCompatibilityService;
    setup(() => {
        compatService = typeMoq.Mock.ofType<IDotNetCompatibilityService>();
        service = new LanguageServerCompatibilityService(compatService.object);
    });
    test('Not supported if there are errors ', async () => {
        compatService.setup((c) => c.isSupported()).returns(() => Promise.reject(new Error('kaboom')));
        const supported = await service.isSupported();
        expect(supported).to.equal(false, 'incorrect');
    });
    test('Not supported if there are not errors ', async () => {
        compatService.setup((c) => c.isSupported()).returns(() => Promise.resolve(false));
        const supported = await service.isSupported();
        expect(supported).to.equal(false, 'incorrect');
    });
    test('Support if there are not errors ', async () => {
        compatService.setup((c) => c.isSupported()).returns(() => Promise.resolve(true));
        const supported = await service.isSupported();
        expect(supported).to.equal(true, 'incorrect');
    });
});
