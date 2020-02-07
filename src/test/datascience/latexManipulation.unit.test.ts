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

    const markdown4 = `
$$
\\begin{equation*}
\\mathbf{V}_1 \\times \\mathbf{V}_2 = \\begin{vmatrix}
\\mathbf{i} & \\mathbf{j} & \\mathbf{k} \\\\
\\frac{\\partial X}{\\partial u} & \\frac{\\partial Y}{\\partial u} & 0 \\\\
\\frac{\\partial X}{\\partial v} & \\frac{\\partial Y}{\\partial v} & 0
\\end{vmatrix}
\\end{equation*}
$$
`;

    const markdown5 = `
\\begin{equation*}
P(E)   = {n \\choose k} p^k (1-p)^{ n-k}
\\end{equation*}

This expression $\\sqrt{3x-1}+(1+x)^2$ is an example of a TeX inline equation in a [Markdown-formatted](https://daringfireball.net/projects/markdown/) sentence.
`;
    const output5 = `

$$
\\begin{equation*}
P(E)   = {n \\choose k} p^k (1-p)^{ n-k}
\\end{equation*}
$$


This expression $\\sqrt{3x-1}+(1+x)^2$ is an example of a TeX inline equation in a [Markdown-formatted](https://daringfireball.net/projects/markdown/) sentence.
`;

    const markdown6 = `$$
\\begin{aligned}
\\frac{\\partial}{\\partial\\omega_j}C(\\omega) &= \\frac1m\\sum_{i=1}^m\\varphi_j\\left(x^i\\right)\\left(\\varphi^T\\left(x^i\\right)\\omega-t^i\\right)
= 0
\\end{aligned}
$$
$$
\\begin{pmatrix}
\\varphi_j\\left(x^1\\right) & \\dots & \\varphi_j\\left(x^m\\right)
\\end{pmatrix}
\\begin{pmatrix}
\\varphi_1\\left(x^1\\right) & \\dots & \\varphi_n\\left(x^1\\right)\\\\
\\vdots & \\ddots & \\vdots\\\\
\\varphi_1\\left(x^m\\right) & \\dots & \\varphi_n\\left(x^m\\right)
\\end{pmatrix}
\\begin{pmatrix}
\\omega_1\\\\
\\vdots\\\\
\\omega_n
\\end{pmatrix}
=
\\begin{pmatrix}
\\varphi_j\\left(x^1\\right) & \\dots & \\varphi_j\\left(x^m\\right)
\\end{pmatrix}
\\begin{pmatrix}
t^1\\\\
\\vdots\\\\
t^m
\\end{pmatrix}
$$

Assuming that $T = (t^1, t^2, ..., t^m)^T$，$X = \\left(\\varphi(x^1), \\varphi(x^2), ..., \\varphi(x^m)\\right)^T$, then
$$
X^TX\\omega = X^TT
$$`;

    test("Latex - Equations don't have $$", () => {
        const result = fixLatexEquations(markdown1);
        expect(result).to.be.equal(output1, 'Result is incorrect');
    });

    test('Latex - Equations have $', () => {
        const result = fixLatexEquations(markdown2);
        expect(result).to.be.equal(markdown2, 'Result is incorrect');
    });

    test("Latex - Multiple equations don't have $$", () => {
        const result = fixLatexEquations(markdown3);
        expect(result).to.be.equal(output3, 'Result is incorrect');
    });

    test('Latex - All on the same line', () => {
        const line = '\\begin{matrix}1 & 0\\0 & 1\\end{matrix}';
        const after = '\n$$\n\\begin{matrix}1 & 0\\0 & 1\\end{matrix}\n$$\n';
        const result = fixLatexEquations(line);
        expect(result).to.be.equal(after, 'Result is incorrect');
    });

    test('Latex - Invalid', () => {
        const invalid = '\n\\begin{eq*}do stuff\\end{eq}';
        const result = fixLatexEquations(invalid);
        expect(result).to.be.equal(invalid, 'Result should not have changed');
    });

    test('Latex - $$ already present', () => {
        const result = fixLatexEquations(markdown4);
        expect(result).to.be.equal(markdown4, 'Result should not have changed');
    });

    test('Latex - Multiple types', () => {
        const result = fixLatexEquations(markdown5);
        expect(result).to.be.equal(output5, 'Result is incorrect');
    });

    test('Latex - Multiple /begins inside $$', () => {
        const result = fixLatexEquations(markdown6);
        expect(result).to.be.equal(markdown6, 'Result should not have changed');
    });
});
