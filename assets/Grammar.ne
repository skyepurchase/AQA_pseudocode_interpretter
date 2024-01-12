@preprocessor typescript

@{%
// See https://github.com/no-context/moo/issues/141
// From https://github.com/isaacphysics/inequality-grammar/blob/master/assets/maths-grammar.ne#L5-L22
function keywordTransformSafe(map: { [key: string]: string | string[] }) {
    let reverseMap: Map<string, string> = new Map;
    let types: string[] = Object.getOwnPropertyNames(map);
    for (let i = 0; i < types.length; i++) {
        let tokenType: string = types[i];
        let item: string | string[] | undefined = map[tokenType];
        let keywordList: string[] = item ? (Array.isArray(item) ? item : [item]) : [];
        keywordList.forEach(
            function(keyword: string): void {
                if (typeof keyword !== 'string') {
                    throw new Error("keyword must be string (in keyword '" + tokenType + "')");
                }
                reverseMap.set(keyword, tokenType);
        })
    }
    return function(k: string): string | undefined {
        return reverseMap.get(k);
    }
}

const moo = require('moo');
const lexer = moo.compile({
    Sep: { match: /[\n|\r\n]+/, lineBreaks: true },
    WS: { match: /[ \t\n\r]+/, lineBreaks: true },
    // TODO: follow pseudocode exactly: ←
    Ass: ['<-'],
    Comment: /\# .*/,
    Float: /[0-9]+\.[0-9]+/,
    Int: /[0-9]+/,
    Plus: ['+'],
    Minus: ['-', '-', '-'], // These are not the same sign
    Mul: ['*'],
    Div: ['/'],
    LBra: ['('],
    RBra: [')'],
    Com: [','],
    // TODO: follow the pseudocode exactly: ≠, ≤, ≥
    Rel: ['=', '<', '>', '!=', '<=', '>='],
    Id: { match: /[a-zA-Z]\w*/, type: keywordTransformSafe({
            If: ['IF'],
            Then: ['THEN'],
            Else: ['ELSE'],
            Fi: ['ENDIF'],
            Repeat: ['REPEAT'],
            Until: ['UNTIL'],
            While: ['WHILE'],
            Elihw: ['ENDWHILE'],
            Sub: ['SUBROUTINE'],
            Bus: ['ENDSUBROUTINE'],
            Ret: ['RETURN'],
            Const: ['CONSTANT'],
            Gate: ['AND', 'OR'],
            Not: ['NOT'],
            Out: ['OUTPUT'],
            Bool: ['True', 'False'],
        })
    }
})

import _cloneDeep from 'lodash/cloneDeep';
import { Token } from 'moo';

export type Operation = 'ADD'
                      | 'SUB'
                      | 'MUL'
                      | 'DIV'
                      | 'AND'
                      | 'OR'
                      | 'NOT'
                      | 'NOP'

export type Relation = 'EQ'
                     | 'GT'
                     | 'LT'
                     | 'GEQ'
                     | 'LEQ'
                     | 'NEQ'
                     | 'NOP'

export interface Property {
    operation?: Operation,
    significand?: string,
    type?: string,
    name?: string,
    constant?: boolean,
    relation?: Relation
}

export interface Children {
    left?: AST,
    right?: AST,
    argument?: AST,
    params?: AST,
    ret?: AST
}

export type Type = 'Sequence'
                  | 'Subroutine'
                  | 'Assignment'
                  | 'Conditional'
                  | 'Loop'
                  | 'Relation'
                  | 'BinaryOperation'
                  | 'UnaryOperation'
                  | 'Output'
                  | 'Arguments'
                  | 'Bracket'
                  | 'Call'
                  | 'Parameters'
                  | 'Variable'
                  | 'Number'
                  | 'Boolean'
                  | 'Unknown'

export interface AST {
    type: Type,
    properties: Property,
    children: Children
}

type PartialAST = AST | Token | undefined;

function isAST(param: PartialAST): param is AST {
    return param ? (param as AST).properties !== undefined : false;
}

function isToken(param: PartialAST): param is Token {
    return param ? (param as Token).text !== undefined : false;
}

function stringToOp(param: string): Operation {
    switch (param) {
        case '+': return "ADD";
        case '*': return "MUL";
        case '/': return "DIV";
        case '-':
        case '-':
        case '-': return "SUB";
        case 'AND': return "AND";
        case 'OR': return "OR";
        case 'NOT': return "NOT";
        default: return "NOP";
    }
}

function stringToRel(param: string): Relation {
    switch (param) {
        case '=': return "EQ";
        case '<': return "LT";
        case '>': return "GT";
        case '!=': return "NEQ";
        case '<=': return "LEQ";
        case '>=': return "GEQ";
        default: return "NOP";
    }
}

const UNKNOWN: AST = { type: 'Unknown', properties: {}, children: {} };

/* Main point of entry. Setting up the outer shell of the AST */
const processMain = (data: AST[]): AST => {
    const main = _cloneDeep(data[1]);
    return main;
}

/* Process sequences.
The rule already matches sequences as cons lists so this is
just a fancy binary operation.
*/
const processSequence = (data: PartialAST[]): AST => {
    const lhs = _cloneDeep(data[0]);
    const rhs = _cloneDeep(data[4]);
    if (isAST(lhs) && isAST(rhs)) {
        return {
            type: 'Sequence',
            properties: {},
            children: { left: lhs, right: rhs }
        };
    } else {
        // This shouldn't trigger
        return _cloneDeep(UNKNOWN);
    }
}

/* Process subroutine.
This has programs in it's properties as these will be run later.
Some subroutines can return values based on expressions.
The parameters will need to be bound on call.
*/
const processSubroutine = (data: PartialAST[]): AST => {
    const id = data[2]
    const params = data[4]
    const prog = data[7]
    let ret = undefined;

    if (data.length > 10) {
        ret = data[11];
    }

    if (isToken(id) && isAST(params) && isAST(prog)) {
        if (isAST(ret)) {
            return {
                type: 'Subroutine',
                properties: { name: id.text },
                children: { params: params, argument: prog, ret: ret }
            }
        } else {
            return {
                type: 'Subroutine',
                properties: { name: id.text },
                children: { params: params, argument: prog }
            }
        }
    } else {
        // This shouldn't trigger
        return _cloneDeep(UNKNOWN);
    }
}


/* Porcess variable and constant assignment.
Need to check the length of the data as there may or may not be
a keyword.
*/
const processAssignment = (data: PartialAST[]): AST => {
    const arg = _cloneDeep(data[data.length - 1]);
    let id: PartialAST = undefined;
    if (data.length === 5) {
        id = data[0];
    } else if (data.length === 7) {
        id = data[2];
    }

    if (isAST(arg) && isToken(id)) {
        return {
            type: 'Assignment',
            /* processAssignment is only called with data length 7 when
            the keyword "CONSTANT" is used */
            properties: { name: id.text, constant: data.length === 7 },
            children: { argument: arg }
        };
    } else {
        // This shouldn't trigger
        return _cloneDeep(UNKNOWN);
    }
}

/* Process conditional if-then-else and if-then.
Want to make this as easy to deal with when interpretting
*/
const processConditional = (data: PartialAST[]): AST => {
    const arg = _cloneDeep(data[2]);
    const lhs = _cloneDeep(data[7]);
    let rhs: PartialAST = _cloneDeep(UNKNOWN);
    const isIfThenElse = isToken(data[10]) && data[10].type === "Else";
    if (isIfThenElse) {
        rhs = _cloneDeep(data[13]);
    }

    if (isAST(arg) && isAST(lhs) && isAST(rhs)) {
        return {
            type: 'Conditional',
            properties: { type: isIfThenElse ? "if-then-else" : "if-then" },
            children: { argument: arg, left: lhs, right: rhs }
        }
    } else {
        // This shouldn't trigger
        return _cloneDeep(UNKNOWN);
    }
}

/* Process unbounded recursion.
Similar to above make the different methods fairly indistinguishable.
*/
const processWhile = (data: PartialAST[]): AST => {
    const type = isToken(data[0]) ? data[0].type : "Unknown";
    let arg: PartialAST = undefined;
    let lhs: PartialAST = undefined;

    if (type === "While") {
        arg = _cloneDeep(data[2]);
        lhs = _cloneDeep(data[5]);
    } else if (type === "Repeat") {
        arg = _cloneDeep(data[8]);
        lhs = _cloneDeep(data[3]);
    }

    if (isAST(arg) && isAST(lhs)) {
        return {
            type: 'Loop',
            properties: { type: type },
            children: { argument: arg, left: lhs }
        }
    } else {
        // This shouldn't trigger
        return _cloneDeep(UNKNOWN);
    }
}

/* Process relations.
Should be easy.
*/
const processRelation = (data: PartialAST[]): AST => {
    const lhs = _cloneDeep(data[0]);
    const rhs = _cloneDeep(data[4]);
    const rel = data[2];
    if (isAST(lhs) && isAST(rhs) && isToken(rel)) {
        return {
            type: 'Relation',
            properties: { relation: stringToRel(rel.text) },
            children: { left: lhs, right: rhs }
        };
    } else {
        // This shouldn't trigger
        return _cloneDeep(UNKNOWN);
    }
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
            properties: { operation: stringToOp(op.text) },
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
            properties: { operation: stringToOp(op.text) },
            children: { left: lhs, right: rhs }
        };
    } else {
        // This shouldn't trigger
        return _cloneDeep(UNKNOWN);
    }
}

/* process unary operation.
Super easy just add a node.
*/
const processUnaryOp = (data: PartialAST[]): AST => {
    const arg = _cloneDeep(data[2])
    const op = data[0];
    if (isAST(arg) && isToken(op)) {
        return {
            type: 'UnaryOperation',
            properties: { operation: stringToOp(op.text) },
            children: { argument: arg }
        };
    } else {
        // This shouldn't trigger
        return _cloneDeep(UNKNOWN);
    }
}

/* process output. Should be super easy. */
const processOutput = (data: PartialAST[]): AST => {
    let arg = _cloneDeep(data[2]);
    if (isAST(arg)) {
        return {
            type: 'Output',
            properties: {},
            children: { argument: arg }
        };
    } else {
        // This shouldn't trigger
        return _cloneDeep(UNKNOWN);
    }
}

/* process output arguments. Should also be super easy. */
const proccessArgs = (data: PartialAST[]): AST => {
    let lhs = _cloneDeep(data[0]);
    let rhs = _cloneDeep(data[4]);
    if (isAST(lhs) && isAST(rhs)) {
        return {
            type: 'Arguments',
            properties: {},
            children: { left: lhs, right: rhs }
        };
    } else {
        // This shouldn't trigger
        return _cloneDeep(UNKNOWN);
    }
}

/* processBrackets.
Just signify that the expression is in brackets
*/
const processBrackets = (data: PartialAST[]): AST => {
    let arg = _cloneDeep(data[2]);
    if (isAST(arg)) {
        return {
            type: 'Bracket',
            properties: { type: 'round' },
            children: { argument: arg }
        };
    } else {
        // This shouldn't trigger
        return _cloneDeep(UNKNOWN);
    }
}

/* Process call sites. Very simple */
const processCall = (data: PartialAST[]): AST => {
    const id = data[0];
    const params = data[2];
    if (isToken(id) && isAST(params)) {
        return {
            type: "Call",
            properties: { name: id.text },
            children: { params: params }
        }
    } else {
        // This shouldn't trigger
        return _cloneDeep(UNKNOWN);
    }
}

/* Process parameters.
Generate a cons-list of parameters
*/
const processParameters = (data: PartialAST[]): AST => {
    const id = data[0];
    let otherParams: PartialAST = undefined;
    if (data.length > 1) {
        otherParams = data[4];
    }
    if (isToken(id)) {
        if (isAST(otherParams)) {
            return {
                type: 'Parameters',
                properties: { name: id.text },
                children: { argument: otherParams }
            }
        }
        return {
            type: 'Parameters',
            properties: { name: id.text},
            children: {}
        }
    } else {
        // This shouldn't trigger
        return _cloneDeep(UNKNOWN);
    }
}

/* Process floats and integers. Just return that boy. */
const processNumber = (data: PartialAST[]): AST => {
    const op = data[0];
    if (isToken(op)) {
        return {
            type: 'Number',
            properties: { significand: op.text },
            children: {}
        };
    } else {
        // This shouldn't trigger
        return _cloneDeep(UNKNOWN);
    }
}

/* Process variables. Just return that boy 2: electric boogaloo. */
const processVariable = (data: PartialAST[]): AST => {
    const id = data[0];
    if (isToken(id)) {
        return {
            type: 'Variable',
            properties: { name: id.text },
            children: {}
        };
    } else {
        // This shouldn't trigger
        return _cloneDeep(UNKNOWN);
    }
}

/* Process booleans. This is getting old */
const processBoolean = (data: PartialAST[]): AST => {
    const id = data[0];
    if (isToken(id)) {
        return {
            type: 'Boolean',
            properties: { significand: id.text },
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

main   -> _ SEQ _                               {% processMain %}

# Sequences
SEQ    -> SUB _ %Sep _ SEQ                      {% processSequence %}
        | ASS _ %Sep _ SEQ                      {% processSequence %}
        | COND _ %Sep _ SEQ                     {% processSequence %}
        | LOOP _ %Sep _ SEQ                     {% processSequence %}
        | REL _ %Sep _ SEQ                      {% processSequence %}
        | ADDSUB _ %Sep _ SEQ                   {% processSequence %}
        | OUT _ %Sep _ SEQ                      {% processSequence %}
        | CALL _ %Sep _ SEQ                      {% processSequence %}
        | SUB                                   {% id %}
        | ASS                                   {% id %}
        | COND                                  {% id %}
        | LOOP                                  {% id %}
        | REL                                   {% id %}
        | ADDSUB                                {% id %}
        | OUT                                   {% id %}
        | CALL                                  {% id %}

# Defining a subroutine
# //TODO allow empty subroutines that just return
SUB    -> %Sub _ %Id %LBra PARAM %RBra %Sep
            SEQ %Sep
            %Bus                                {% processSubroutine %}
        | %Sub _ %Id %LBra PARAM %RBra %Sep
            SEQ %Sep
            %Ret _ ADDSUB %Sep
            %Bus                                {% processSubroutine %}

# Assignment
ASS    -> %Id _ %Ass _ VAL                      {% processAssignment %}
        | %Const _ %Id _ %Ass _ VAL             {% processAssignment %}

# Conditional
# Horrific in my opinion
COND   -> %If _ REL _ %Then %Sep
            _ SEQ %Sep
            _ %Else %Sep
            _ SEQ %Sep
            _ %Fi                               {% processConditional %}
        | %If _ REL _ %Then %Sep
            _ SEQ %Sep
            _ %Fi                               {% processConditional %}
        | %If _ REL _ %Then %Sep
            _ SEQ %Sep
            _ %Else _ _ COND                    {% processConditional %}
#                   ^^^ this is a hack to act like the first case
# THIS MAKES IT AMBIGUOUS and should be removed in a used version

# Loops (just while for now)
LOOP   -> %While _ REL %Sep
            _ SEQ %Sep
            _ %Elihw                            {% processWhile %}
        | %Repeat %Sep
            _ SEQ %Sep
            _ %Until _ REL                      {% processWhile %}

# Relations
REL    -> ADDSUB _ %Rel _ ADDSUB                {% processRelation %}
        | BOOL                                  {% id %}

# Assignment values
VAL    -> ADDSUB                                {% id %}
        | VAR                                   {% id %}
        | BOOL                                  {% id %}

# Output only of variables and numbers
OUT    -> %Out _ ARG                            {% processOutput %}

# Output arguments
ARG    -> ADDSUB _ %Com _ ARG                   {% proccessArgs %}
        | ADDSUB                                {% id %}

# Addition and subtraction
ADDSUB -> MULDIV _ %Plus _ ADDSUB               {% processBinOp %}
        | MULDIV _ %Minus _ ADDSUB              {% processBinOp %}
        | MULDIV                                {% id %}

# Multiplication and division
MULDIV -> UN _ %Mul _ MULDIV                    {% processBinOp %}
        | UN _ %Div _ MULDIV                    {% processFraction %}
        | UN                                    {% id %}

# Unaries of all kinds
UN     -> %Plus _ UN                            {% processUnaryOp %}
        | %Minus _ UN                           {% processUnaryOp %}
        | BRA                                   {% id %}

# Brackets
BRA    -> %LBra _ ADDSUB _ %RBra                {% processBrackets %}
        | NUM                                   {% id %}
        | VAR                                   {% id %}

# Subroutine calling
CALL    -> %Id %LBra PARAM %RBra                {% processCall %}

# Subroutine paramaters
PARAM  -> %Id _ %Com _ PARAM                    {% processParameters %}
        | %Id                                   {% processParameters %}

# Variables
VAR    -> %Id                                   {% processVariable %}

# Integers
NUM    -> %Int                                  {% processNumber %}
        | %Float                                {% processNumber %}

# Booleans
BOOL   -> BBRA _ %Gate _ BBRA                   {% processBinOp %}
        | %Not _ BBRA                           {% processUnaryOp %}
        | %Bool                                 {% processBoolean %}

# Boolean brackets
BBRA   -> %LBra _ REL _ %RBra                   {% processBrackets %}
        | BOOL                                  {% id %}

# Whitespace. The important thing here is that the postprocessor
# is a null-returning function. This is a memory efficiency trick.
_ -> %WS:*
