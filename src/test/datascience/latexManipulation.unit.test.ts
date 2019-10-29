// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { expect } from 'chai';
import { fixLatexEquations } from '../../datascience-ui/interactive-common/latexManipulation';

// tslint:disable: max-func-body-length
suite('Data Science - LaTeX Manipulation', () => {
    const markdown1 = `\\begin{align}
\\nabla \\cdot \\vec{\\mathbf{E}} & = 4 \\pi \\rho \\\\
\\nabla \\times \\vec{\\mathbf{E}}\\, +\\, \\frac1c\\, \\frac{\\partial\\vec{\\mathbf{B}}}{\\partial t} & = \\vec{\\mathbf{0}} \\\\
\\nabla \\cdot \\vec{\\mathbf{B}} & = 0
\\end{align}
sample text`;

    const output1 = `
$$
\\begin{align}
\\nabla \\cdot \\vec{\\mathbf{E}} & = 4 \\pi \\rho \\\\
\\nabla \\times \\vec{\\mathbf{E}}\\, +\\, \\frac1c\\, \\frac{\\partial\\vec{\\mathbf{B}}}{\\partial t} & = \\vec{\\mathbf{0}} \\\\
\\nabla \\cdot \\vec{\\mathbf{B}} & = 0
\\end{align}
$$

sample text`;

    const markdown2 = `$\\begin{align*}
(a+b)^2 = a^2+2ab+b^2
\\end{align*}$
sample text
$\\begin{align*}
(a+b)^2 = a^2+2ab+b^2
\\end{align*}$
sample text`;

    const markdown3 = `\\begin{align*}
(a+b)^2 = a^2+2ab+b^2
\\end{align*}
sample text
\\begin{align*}
(a+b)^2 = a^2+2ab+b^2
\\end{align*}
sample text
\\begin{align*}
(a+b)^2 = a^2+2ab+b^2
\\end{align*}
sample text

sample text
\\begin{align*}
(a+b)^2 = a^2+2ab+b^2
\\end{align*}`;

    const output3 = `
$$
\\begin{align*}
(a+b)^2 = a^2+2ab+b^2
\\end{align*}
$$

sample text

$$
\\begin{align*}
(a+b)^2 = a^2+2ab+b^2
\\end{align*}
$$

sample text

$$
\\begin{align*}
(a+b)^2 = a^2+2ab+b^2
\\end{align*}
$$

sample text

sample text

$$
\\begin{align*}
(a+b)^2 = a^2+2ab+b^2
\\end{align*}
$$
`;

    test('Latex - Equations don\'t have $$', () => {
        const result = fixLatexEquations(markdown1);
        expect(result).to.be.equal(output1, 'Result is incorrect');
    });

    test('Latex - Equations have $', () => {
        const result = fixLatexEquations(markdown2);
        expect(result).to.be.equal(markdown2, 'Result is incorrect');
    });

    test('Latex - Multiple equations don\'t have $$', () => {
        const result = fixLatexEquations(markdown3);
        expect(result).to.be.equal(output3, 'Result is incorrect');
    });
});
