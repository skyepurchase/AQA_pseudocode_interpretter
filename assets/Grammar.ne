@preprocessor typescript

@{%
// See https://github.com/no-context/moo/issues/141
// From https://github.com/isaacphysics/inequality-grammar/blob/master/assets/maths-grammar.ne#L5-L22
function keywordTransformSafe(map: Map<string, string>) {
    let reverseMap: Map<string, string> = new Map;
    let types: string[] = Object.getOwnPropertyNames(map);
    for (let i = 0; i < types.length; i++) {
        let tokenType = types[i];
        let item = map.get(tokenType);
        let keywordList = Array.isArray(item) ? item : [item];
        keywordList.forEach(
            function(keyword: string) {
                if (typeof keyword !== 'string') {
                    throw new Error("keyword must be sting (in keyword '" + tokenType + "')");
                }
                reverseMap.set(keyword, tokenType);
        })
    }
    return function(k: string) {
        return reverseMap.get(k);
    }
}

const moo = require('moo');
const lexer = moo.compile({
    Keyword: [
        'CONSTANT'
    ],
    // TODO: follow pseudocode exactly: ←
    Assignment: ['<-'],
    Comment: /\# .*/,
    Int: /[0-9]+/,
    Plus: ['+'],
    Minus: ['-', '-', '-'], // These are not the same sign
    Mul: ['*'],
    Div: ['/'],
    // TODO: follow the pseudocode exactly: ≠, ≤, ≥
    Rel: ['=', '<', '>', '!=', '<=', '>='],
    Identifier: /[a-zA-Z]\w*/
})

import _cloneDeep from 'lodash/cloneDeep';
import { Token } from 'moo';

export interface Property {
    operation?: string,
    significand?: string
}

export interface Children {
    left?: AST,
    right?: AST
}

export interface AST {
    type: string,
    properties: Property,
    children: Children
}

type PartialAST = AST | Token;

function isAST(param: PartialAST): param is AST {
    return (param as AST).properties !== undefined;
}

function isToken(param: PartialAST): param is Token {
    return (param as Token).text !== undefined;
}

const UNKNOWN: AST = { type: 'Unknown', properties: {}, children: {} };

/* Main point of entry. Setting up the outer shell of the AST */
const processMain = (data: AST[]): AST => {
    const main = _cloneDeep(data[1]);
    return main;
}

/* Process additions and subtrations.
Should be easy.
*/
const processBinOp = (data: PartialAST[]): AST => {
    const lhs = _cloneDeep(data[0]);
    const rhs = _cloneDeep(data[4]);
    const op = data[2];
    if (isAST(lhs) && isAST(rhs) && isToken(op)) {
        return {
            type: 'BinaryOperation',
            properties: { operation: op.text },
            children: { left: lhs, right: rhs }
        };
    } else {
        // This shouldn't trigger
        return _cloneDeep(UNKNOWN);
    }
}

/* process fractions. 
TODO: This could have complications that are not covered
this will only be apparent later in development so kept
separate*/
const processFraction = (data: PartialAST[]): AST => {
    const lhs = _cloneDeep(data[0]);
    const rhs = _cloneDeep(data[4]);
    const op = data[2];
    if (isAST(lhs) && isAST(rhs) && isToken(op)) {
        return {
            type: 'BinaryOperation',
            properties: { operation: op.text },
            children: { left: lhs, right: rhs }
        };
    } else {
        // This shouldn't trigger
        return _cloneDeep(UNKNOWN);
    }
}

/* process unary addition and subtraction.
Super easy just add a node.
*/
const processUnaryAddSub = (data: PartialAST[]): AST => {
    const rhs = _cloneDeep(data[2])
    const op = data[0];
    if (isAST(rhs) && isToken(op)) {
        return {
            type: 'UnaryOperation',
            properties: { operation: op.text },
            children: { right: rhs }
        };
    } else {
        // This shouldn't trigger
        return _cloneDeep(UNKNOWN);
    }
}

/* process integers. Just return that boy. */
const processInteger = (data: PartialAST[]): AST => {
    const op = data[0];
    if (isToken(op)) {
        return {
            type: 'Num',
            properties: { significand: op.text },
            children: {}
        };
    } else {
        // This shouldn't trigger
        return _cloneDeep(UNKNOWN);
    }
}

%}

# Passing the lexer object
@lexer lexer

# The Almighty Grammar

main   -> _ AddSub _                    {% processMain %}

# Addition and subtraction
AddSub -> AddSub _ %Plus _ MulDiv       {% processBinOp %}
        | AddSub _ %Minus _ MulDiv      {% processBinOp %}
        | MulDiv                        {% id %}

# Multiplication and division
MulDiv -> MulDiv _ %Mul _ Un            {% processBinOp %}
        | MulDiv _ %Div _ Un            {% processFraction %}
        | Un                            {% id %}

# Unaries of all kinds
Un     -> %Plus _ Un                    {% processUnaryAddSub %}
        | %Minus _ Un                   {% processUnaryAddSub %}
        | Num                           {% id %}

# Integers
Num    -> %Int                          {% processInteger %}

# Whitespace. The important thing here is that the postprocessor
# is a null-returning function. This is a memory efficiency trick.
_ -> [\s]:*
