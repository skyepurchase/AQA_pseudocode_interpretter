import { isBoolean, isNumber } from 'lodash';
import { AST, Operation, Relation } from './Grammar'

type Value = number | boolean

interface Store {
    value: Value,
    isConst: boolean
}

// TODO: add an ERROR type for Value
function doOperation(operation: Operation, value1: Value, value2: Value): Value {
    if (isNumber(value1) && isNumber(value2)) {
        switch (operation) {
            case "ADD": return value1 + value2;
            case "SUB": return value1 - value2;
            case "MUL": return value1 * value2;
            case "DIV": return value1 / value2;
            case "NOP": return value1;
            default: return -1;
        }
    } else if (isBoolean(value1) && isBoolean(value2)) {
        switch (operation) {
            case "AND": return value1 && value2;
            case "OR": return value1 || value2;
            case "NOP": return value1;
            default: return false;
        }
    }
    return -1;
}

function doUnary(operation: Operation, value1: Value): Value {
    if (isNumber(value1)) {
        switch (operation) {
            case "SUB": return - value1;
            case "ADD":
            case "NOP": return value1;
            default: return -1;
        }
    } else if (isBoolean(value1)) {
        switch (operation) {
            case "NOT": return !value1;
            case "NOP": return value1;
            default: return false;
        }
    }
    return -1;
}

function doRelation(relation: Relation, value1: Value, value2: Value): Value {
    if (isNumber(value1) && isNumber(value2)) {
        switch (relation) {
            case 'EQ': return value1 === value2;
            case 'GT': return value1 > value2;
            case 'LT': return value1 < value2;
            case 'GEQ': return value1 >= value2;
            case 'LEQ': return value1 <= value2;
            case 'NEQ': return value1 !== value2;
            default: return false;
        }
    }
    return false;
}

function interpret(prog: AST, store: Map<string, Store>): [Value, Map<string, Store>] {
    switch (prog.type) {
        case 'Sequence': {
            if (prog.children.left && prog.children.right) {
                const [_, store1]: [Value, Map<string, Store>] = interpret(prog.children.left, store);
                const [value, store2]: [Value, Map<string, Store>] = interpret(prog.children.right, store1);
                return [value, store2];
            }
            const error = new Map();
            error.set("ERROR! Malformed sequence.", -1);
            return [-1, error];
        }
        case 'Assignment': {
            if (prog.children.argument && prog.properties.name && (prog.properties.constant !== undefined)) {
                const [value, store1]: [Value, Map<string, Store>] = interpret(prog.children.argument, store);
                if (store1.get(prog.properties.name)?.isConst) {
                    const error = new Map();
                    error.set("ERROR! Reassigning a constant variable.", -1);
                    return [-1, error];
                }

                return [0, store1.set(prog.properties.name, { value: value, isConst: prog.properties.constant})];
            }
            const error = new Map();
            error.set("ERROR! Malformed assignment.", -1);
            return [-1, error];
        }
        case 'Relation': {
            if (prog.children.left && prog.children.right && prog.properties.relation) {
                const [value1, store1]: [Value, Map<string, Store>] = interpret(prog.children.left, store);
                const [value2, store2]: [Value, Map<string, Store>] = interpret(prog.children.right, store1);
                const res = doRelation(prog.properties.relation, value1, value2);

                return [res, store2];
            }
        }
        case 'BinaryOperation': {
            if (prog.children.left && prog.children.right && prog.properties.operation) {
                const [value1, store1]: [Value, Map<string, Store>] = interpret(prog.children.left, store);
                const [value2, store2]: [Value, Map<string, Store>] = interpret(prog.children.right, store1);
                const res: Value = doOperation(prog.properties.operation, value1, value2);
                return [res, store2];
            }
            const error = new Map();
            error.set("ERROR! Malformed binary operation.", -1);
            return [-1, error];
        }
        case 'UnaryOperation': {
            if (prog.children.argument && prog.properties.operation) {
                const [value, store1]: [Value, Map<string, Store>] = interpret(prog.children.argument, store);
                const res: Value = doUnary(prog.properties.operation, value);
                return [res, store1];
            }
            const error = new Map();
            error.set("ERROR! Malformed unary operation.", -1);
            return [-1, error];
        }
        case 'Bracket': {
            if (prog.children.argument) {
                const [value, store1]: [Value, Map<string, Store>] = interpret(prog.children.argument, store);
                return [value, store1];
            }
            const error = new Map();
            error.set("ERROR! Malformed bracket.", -1);
            return [-1, error];
        }
        case 'Variable': {
            if (prog.properties.name) {
                const value: Store | undefined = store.get(prog.properties.name);
                const error = new Map();
                error.set("ERROR! Variable not found.", -1);
                return value ? [value.value, store] : [-1, error];
            }
            const error = new Map();
            error.set("ERROR! Malformed variable access.", -1);
            return [-1, error];
        }
        case 'Number': {
            if  (prog.properties.significand) {
                const value: Value = parseFloat(prog.properties.significand);
                return [value, store];
            }
            const error = new Map();
            error.set("ERROR! Malformed number.", -1);
            return [-1, error];
        }
        case 'Boolean': {
            if (prog.properties.significand) {
                const value: Value = prog.properties.significand === "True";
                return [value, store];
            }
            const error = new Map();
            error.set("ERROR! Malformed boolean.", -1);
            return [-1, error];
        }
        case 'Unknown': {
            const error = new Map();
            error.set("ERROR! Unknown instruction.", -1);
            return [-1, error];
        }
    }
}

export default function (prog: AST): Value {
    const [value, store] = interpret(prog, new Map());
    if (value === -1) {
        console.log(store);
    }
    return value;
}
