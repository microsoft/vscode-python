// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Product } from '../types';

export const ProductNames = new Map<Product, string>();
ProductNames.set(Product.autopep8, 'autopep8');
ProductNames.set(Product.bandit, 'bandit');
ProductNames.set(Product.black, 'black');
ProductNames.set(Product.flake8, 'flake8');
ProductNames.set(Product.mypy, 'mypy');
ProductNames.set(Product.pycodestyle, 'pycodestyle');
ProductNames.set(Product.pylama, 'pylama');
ProductNames.set(Product.prospector, 'prospector');
ProductNames.set(Product.pydocstyle, 'pydocstyle');
ProductNames.set(Product.pylint, 'pylint');
ProductNames.set(Product.pytest, 'pytest');
ProductNames.set(Product.yapf, 'yapf');
ProductNames.set(Product.tensorboard, 'tensorboard');
ProductNames.set(Product.torchProfilerInstallName, 'torch-tb-profiler');
ProductNames.set(Product.torchProfilerImportName, 'torch_tb_profiler');
ProductNames.set(Product.jupyter, 'jupyter');
ProductNames.set(Product.notebook, 'notebook');
ProductNames.set(Product.ipykernel, 'ipykernel');
ProductNames.set(Product.nbconvert, 'nbconvert');
ProductNames.set(Product.kernelspec, 'kernelspec');
ProductNames.set(Product.pandas, 'pandas');
