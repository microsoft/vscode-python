// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

"use strict";

import { injectable } from "inversify";
import { IOSDotNetCompatibilityService } from "../types";

@injectable()
export class WindowsDotNetCompatibilityService
    implements IOSDotNetCompatibilityService {
    public async isSupported() {
        return true;
    }
}
