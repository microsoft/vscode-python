// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

"use strict";

import { IServiceManager } from "../ioc/types";
import { SortImportsEditingProvider } from "./importSortProvider";
import { ISortImportsEditingProvider } from "./types";

export function registerTypes(serviceManager: IServiceManager) {
    serviceManager.addSingleton<ISortImportsEditingProvider>(
        ISortImportsEditingProvider,
        SortImportsEditingProvider
    );
}
