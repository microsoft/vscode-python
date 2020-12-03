// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as sinon from 'sinon';
import * as platformAPI from '../../client/common/utils/platform';

type CleanupFunc = () => void;

export function setOSType(osType: platformAPI.OSType): CleanupFunc {
    if (platformAPI.getOSType() === osType) {
        return () => undefined;
    }
    const stub = sinon.stub(platformAPI, 'getOSType');
    stub.returns(osType);
    return () => stub.restore();
}

export function setWindows(): CleanupFunc {
    return setOSType(platformAPI.OSType.Windows);
}

export function setNonWindows(): CleanupFunc {
    return setOSType(platformAPI.OSType.Unknown);
}
