import _uniqWith from 'lodash/uniqWith'
import _isEqual from 'lodash/isEqual'

import { Parser, Grammar } from 'nearley'
import grammar, { AST } from './Grammar'

const compiledGrammar = Grammar.fromCompiled(grammar);

function toAST(res: any[]): AST | { error: unknown } {
    let result = res[0];
    if (result.type && result.properties && result.children) {
        return result as AST;
    } else {
        return { error: "Result not an AST" };
    }
}

export default function(expression: string = ''): AST | { error: unknown } {
    const parser = new Parser(compiledGrammar);
    let output: AST | { error: unknown};
    try {
        output = toAST(_uniqWith(parser.feed(expression).results, _isEqual));
    } catch (error) {
        console.log(error);
        output = { error }
    }
    return output;
}
