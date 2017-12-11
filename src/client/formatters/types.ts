// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { IFormattingSettings } from '../common/configSettings';
import { Product } from '../common/types';

export const IFormatterHelper = Symbol('IFormatterHelper');

export type FormatterId = 'autopep8' | 'yapf';

export type FormatterSettingsPropertyNames = {
    argsName: keyof IFormattingSettings;
    pathName: keyof IFormattingSettings;
};

export interface IFormatterHelper {
    translateToId(formatter: Product): FormatterId;
    getSettingsPropertyNames(formatter: Product): FormatterSettingsPropertyNames;
}
