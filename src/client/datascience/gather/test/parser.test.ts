import { expect } from 'chai';
import { IDict, parse, walk } from '../analysis/parse/python/python-parser';

describe('python parser', () => {
  // The next two tests were because the lexer was confused about how to handle dots. It
  // couldn't read a dot followed by digits as a floating point number.
  it('can parse floats that have no digits before the dot', () => {
    parse('a = .2\n');
  });

  it('can also parse calls on objects', () => {
    parse('obj.prop\n');
  });

  it('can parse scientific notation', () => {
    parse('1e5\n');
  });

  it('can parse imaginary numbers', () => {
    parse('x = 12j\n');
  });

  it('can parse lambdas with keyword', () => {
    parse('f = (lambda document, **variety: document)\n');
  });

  it('parses a dictionary with a `comp_for`', () => {
    let mod = parse('{k: v for (k, v) in d.items()}\n');
    expect(mod).to.exist;
    expect(mod.code).to.have.length;
    let node = mod.code[0] as IDict;
    expect(node.entries.length).to.equal(1);
    expect(node.comp_for).not.to.be.undefined;
  });

  it('can parse line continuations', () => {
    parse(['a = b\\', '.func(1, 2)\\', '.func(3, 4)', ''].join('\n'));
  });

  it('produces the full location of a line for a call statement', () => {
    let node = parse(['obj.func()', ''].join('\n')).code[0];
    expect(node.location).to.deep.equal({
      first_line: 1,
      first_column: 0,
      last_line: 1,
      last_column: 10,
    });
  });

  it('does not crash on correct code after parsing bad code', () => {
    expect(() => parse('print(1\n')).to.throw();
    expect(() => parse('a + 1\nb = a\n')).not.to.throw();
  });
});

describe('ast walker', () => {
  it("doesn't crash on try-execpt blocks", () => {
    let tree = parse(
      ['try:', '    pass', 'except:', '    pass', ''].join('\n')
    );
    walk(tree);
  });

  it("doesn't crash on with-statements", () => {
    let tree = parse(
      ['with sns.axes_style("white"):', '    pass', ''].join('\n')
    );
    walk(tree);
  });
});
