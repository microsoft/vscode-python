// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IServiceContainer } from './types';

let container: IServiceContainer;
export function getServiceContainer(): IServiceContainer {
    return container;
}
export function setServiceContainer(serviceContainer: IServiceContainer): void {
    container = serviceContainer;
}
