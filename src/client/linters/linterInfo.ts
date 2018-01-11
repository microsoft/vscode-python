// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Product } from '../common/types';
import { ILinterInfo, LinterId } from './types';
import { Linter } from './pep8Linter';

let linters: ILinterInfo[];

export function getLinterInfos(): ILinterInfo {
    if (!linters) {
        LinterInfo.linterIdMapping = new Map<Product, LinterId>();

        this.linterIdMapping.set(Product.flake8, 'flake8');
        this.linterIdMapping.set(Product.mypy, 'mypy');
        this.linterIdMapping.set(Product.pep8, 'pep8');
        this.linterIdMapping.set(Product.prospector, 'prospector');
        this.linterIdMapping.set(Product.pydocstyle, 'pydocstyle');
        this.linterIdMapping.set(Product.pylama, 'pylama');
        this.linterIdMapping.set(Product.pylint, 'pylint');
    }
}

export class LinterInfo implements ILinterInfo {

    private _id: LinterId;
    private _product: Product;

    constructor(product: Product) {
        LinterInfo.initialize();
        this._product = product;
        this._id = LinterInfo.linterIdMapping[product];
    }

    public get id(): LinterId {
        return this._id;
    }
    public get product(): Product {
        return this._product;
    }
}
