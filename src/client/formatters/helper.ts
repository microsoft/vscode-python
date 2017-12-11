// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { injectable } from 'inversify';
import 'reflect-metadata';
import { IFormattingSettings } from '../common/configSettings';
import { Product } from '../common/types';
import { FormatterId, FormatterSettingsPropertyNames, IFormatterHelper } from './types';

@injectable()
export class FormatterHelper implements IFormatterHelper {
    public translateToId(formatter: Product): FormatterId {
        switch (formatter) {
            case Product.autopep8: return 'autopep8';
            case Product.yapf: return 'yapf';
            default: {
                throw new Error(`Unrecognized Formatter '${formatter}'`);
            }
        }
    }
    public getSettingsPropertyNames(formatter: Product): FormatterSettingsPropertyNames {
        const id = this.translateToId(formatter);
        return {
            argsName: `${id}Args` as keyof IFormattingSettings,
            pathName: `${id}Path` as keyof IFormattingSettings
        };
    }
}
