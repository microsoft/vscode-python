// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { injectable } from 'inversify';
import { Product, ProductType } from '../types';
import { IProductService } from './types';

@injectable()
export class ProductService implements IProductService {
    private ProductTypes = new Map<Product, ProductType>();

    constructor() {
        this.ProductTypes.set(Product.bandit, ProductType.Linter);
        this.ProductTypes.set(Product.flake8, ProductType.Linter);
        this.ProductTypes.set(Product.mypy, ProductType.Linter);
        this.ProductTypes.set(Product.pycodestyle, ProductType.Linter);
        this.ProductTypes.set(Product.prospector, ProductType.Linter);
        this.ProductTypes.set(Product.pydocstyle, ProductType.Linter);
        this.ProductTypes.set(Product.pylama, ProductType.Linter);
        this.ProductTypes.set(Product.pylint, ProductType.Linter);
        this.ProductTypes.set(Product.ctags, ProductType.WorkspaceSymbols);
        this.ProductTypes.set(Product.nosetest, ProductType.TestFramework);
        this.ProductTypes.set(Product.pytest, ProductType.TestFramework);
        this.ProductTypes.set(Product.unittest, ProductType.TestFramework);
        this.ProductTypes.set(Product.autopep8, ProductType.Formatter);
        this.ProductTypes.set(Product.black, ProductType.Formatter);
        this.ProductTypes.set(Product.yapf, ProductType.Formatter);
        this.ProductTypes.set(Product.rope, ProductType.RefactoringLibrary);
        this.ProductTypes.set(Product.jupyter, ProductType.DataScience);
        this.ProductTypes.set(Product.notebook, ProductType.DataScience);
        this.ProductTypes.set(Product.ipykernel, ProductType.DataScience);
        this.ProductTypes.set(Product.nbconvert, ProductType.DataScience);
        this.ProductTypes.set(Product.kernelspec, ProductType.DataScience);
        this.ProductTypes.set(Product.pandas, ProductType.DataScience);
        this.ProductTypes.set(Product.tensorboard, ProductType.DataScience);
        this.ProductTypes.set(Product.torchProfilerInstallName, ProductType.DataScience);
        this.ProductTypes.set(Product.torchProfilerImportName, ProductType.DataScience);
    }
    public getProductType(product: Product): ProductType {
        return this.ProductTypes.get(product)!;
    }
}
