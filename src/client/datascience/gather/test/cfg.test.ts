import { expect } from 'chai';
import { parse } from '../analysis/parse/python/python-parser';
import { ControlFlowGraph } from '../analysis/slice/control-flow';

describe('ControlFlowGraph', () => {
    function makeCfg(...codeLines: string[]): ControlFlowGraph {
        let code = codeLines.concat('').join('\n'); // add newlines to end of every line.
        return new ControlFlowGraph(parse(code));
    }

    it('builds the right successor structure for try-except', () => {
        let cfg = makeCfg('try:', '    return 0', 'except:', '    return 1');
        let handlerHead = cfg.blocks.filter(b => b.hint == 'handlers').pop();
        expect(cfg.getPredecessors(handlerHead).pop().hint).to.equal('try body');
    });
});
