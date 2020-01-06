// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import { assert } from 'chai';
import { generateCells } from '../../client/datascience/cellFactory';
import { stripComments } from '../../client/datascience/common';

// tslint:disable: max-func-body-length
suite('Data Science CellFactory', () => {
    test('parsing cells', () => {
        let cells = generateCells(undefined, '#%%\na=1\na', 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'Simple cell, not right number found');
        cells = generateCells(undefined, '#%% [markdown]\na=1\na', 'foo', 0, true, '1');
        assert.equal(cells.length, 2, 'Split cell, not right number found');
        cells = generateCells(undefined, '#%% [markdown]\n# #a=1\n#a', 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'Markdown split wrong');
        assert.equal(cells[0].data.cell_type, 'markdown', 'Markdown cell not generated');
        cells = generateCells(undefined, "#%% [markdown]\n'''\n# a\nb\n'''", 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'Markdown cell multline failed');
        assert.equal(cells[0].data.cell_type, 'markdown', 'Markdown cell not generated');
        assert.equal(cells[0].data.source.length, 2, 'Lines for markdown not emitted');
        cells = generateCells(undefined, '#%% [markdown]\n"""\n# a\nb\n"""', 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'Markdown cell multline failed');
        assert.equal(cells[0].data.cell_type, 'markdown', 'Markdown cell not generated');
        assert.equal(cells[0].data.source.length, 2, 'Lines for markdown not emitted');
        cells = generateCells(undefined, '#%% \n"""\n# a\nb\n"""', 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'Code cell multline failed');
        assert.equal(cells[0].data.cell_type, 'code', 'Code cell not generated');
        assert.equal(cells[0].data.source.length, 5, 'Lines for cell not emitted');
        cells = generateCells(undefined, '#%% [markdown] \n"""# a\nb\n"""', 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'Markdown cell multline failed');
        assert.equal(cells[0].data.cell_type, 'markdown', 'Markdown cell not generated');
        assert.equal(cells[0].data.source.length, 2, 'Lines for cell not emitted');

        // tslint:disable-next-line: no-multiline-string
        const multilineCode = `#%%
myvar = """ # Lorem Ipsum
Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Nullam eget varius ligula, eget fermentum mauris.
Cras ultrices, enim sit amet iaculis ornare, nisl nibh aliquet elit, sed ultrices velit ipsum dignissim nisl.
Nunc quis orci ante. Vivamus vel blandit velit.
Sed mattis dui diam, et blandit augue mattis vestibulum.
Suspendisse ornare interdum velit. Suspendisse potenti.
Morbi molestie lacinia sapien nec porttitor. Nam at vestibulum nisi.
"""`;
        // tslint:disable-next-line: no-multiline-string
        const multilineTwo = `#%%
""" # Lorem Ipsum
Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Nullam eget varius ligula, eget fermentum mauris.
Cras ultrices, enim sit amet iaculis ornare, nisl nibh aliquet elit, sed ultrices velit ipsum dignissim nisl.
Nunc quis orci ante. Vivamus vel blandit velit.
Sed mattis dui diam, et blandit augue mattis vestibulum.
Suspendisse ornare interdum velit. Suspendisse potenti.
Morbi molestie lacinia sapien nec porttitor. Nam at vestibulum nisi.
""" print('bob')`;

        cells = generateCells(undefined, multilineCode, 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'code cell multline failed');
        assert.equal(cells[0].data.cell_type, 'code', 'Code cell not generated');
        assert.equal(cells[0].data.source.length, 10, 'Lines for cell not emitted');
        cells = generateCells(undefined, multilineTwo, 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'code cell multline failed');
        assert.equal(cells[0].data.cell_type, 'code', 'Code cell not generated');
        assert.equal(cells[0].data.source.length, 10, 'Lines for cell not emitted');
        // tslint:disable-next-line: no-multiline-string
        assert.equal(cells[0].data.source[9], `""" print('bob')`, 'Lines for cell not emitted');
        // tslint:disable-next-line: no-multiline-string
        const multilineMarkdown = `#%% [markdown]
# ## Block of Interest
#
# ### Take a look
#
#
#   1. Item 1
#
#     - Item 1-a
#       1. Item 1-a-1
#          - Item 1-a-1-a
#          - Item 1-a-1-b
#       2. Item 1-a-2
#          - Item 1-a-2-a
#          - Item 1-a-2-b
#       3. Item 1-a-3
#          - Item 1-a-3-a
#          - Item 1-a-3-b
#          - Item 1-a-3-c
#
#   2. Item 2`;
        cells = generateCells(undefined, multilineMarkdown, 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'markdown cell multline failed');
        assert.equal(cells[0].data.cell_type, 'markdown', 'markdown cell not generated');
        assert.equal(cells[0].data.source.length, 20, 'Lines for cell not emitted');
        assert.equal(cells[0].data.source[17], '          - Item 1-a-3-c\n', 'Lines for markdown not emitted');

        // tslint:disable-next-line: no-multiline-string
        const multilineQuoteWithOtherDelimiter = `#%% [markdown]
'''
### Take a look
  2. Item 2
""" Not a comment delimiter
'''
`;
        cells = generateCells(undefined, multilineQuoteWithOtherDelimiter, 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'markdown cell multline failed');
        assert.equal(cells[0].data.cell_type, 'markdown', 'markdown cell not generated');
        assert.equal(cells[0].data.source.length, 3, 'Lines for cell not emitted');
        assert.equal(cells[0].data.source[2], '""" Not a comment delimiter', 'Lines for markdown not emitted');

        // tslint:disable-next-line: no-multiline-string
        const multilineQuoteInFunc = `#%%
import requests
def download(url, filename):
    """ utility function to download a file """
    response = requests.get(url, stream=True)
    with open(filename, "wb") as handle:
        for data in response.iter_content():
            handle.write(data)
`;
        cells = generateCells(undefined, multilineQuoteInFunc, 'foo', 0, true, '1');
        assert.equal(cells.length, 1, 'cell multline failed');
        assert.equal(cells[0].data.cell_type, 'code', 'code cell not generated');
        assert.equal(cells[0].data.source.length, 9, 'Lines for cell not emitted');
        assert.equal(cells[0].data.source[3], '    """ utility function to download a file """\n', 'Lines for cell not emitted');

        // tslint:disable-next-line: no-multiline-string
        const multilineMarkdownWithCell = `#%% [markdown]
# # Define a simple class
class Pizza(object):
    def __init__(self, size, toppings, price, rating):
        self.size = size
        self.toppings = toppings
        self.price = price
        self.rating = rating
        `;

        cells = generateCells(undefined, multilineMarkdownWithCell, 'foo', 0, true, '1');
        assert.equal(cells.length, 2, 'cell split failed');
        assert.equal(cells[0].data.cell_type, 'markdown', 'markdown cell not generated');
        assert.equal(cells[0].data.source.length, 1, 'Lines for markdown not emitted');
        assert.equal(cells[1].data.cell_type, 'code', 'code cell not generated');
        assert.equal(cells[1].data.source.length, 7, 'Lines for code not emitted');
        assert.equal(cells[1].data.source[3], '        self.toppings = toppings\n', 'Lines for cell not emitted');

        // Non comments tests
        let nonComments = stripComments(multilineCode);
        assert.ok(nonComments.startsWith('myvar = """ # Lorem Ipsum'), 'Variable set to multiline string not working');
        nonComments = stripComments(multilineTwo);
        assert.equal(nonComments, '', 'Multline comment is not being stripped');
        nonComments = stripComments(multilineQuoteInFunc);
        assert.equal(nonComments.splitLines().length, 6, 'Splitting quote in func wrong number of lines');
    });
});
