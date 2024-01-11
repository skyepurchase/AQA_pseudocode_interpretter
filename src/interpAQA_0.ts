import { AST, Operation } from './Grammar'

interface Store {
    value: number,
    isConst: boolean
}

function doOperation(operation: Operation, value1: number, value2: number): number {
    switch (operation) {
        case "ADD": return value1 + value2;
        case "SUB": return value1 - value2;
        case "MUL": return value1 * value2;
        case "DIV": return value1 / value2;
        case "NOP": return value1;
        default: return -1;
    }
}

function doUnary(operation: Operation, value1: number): number {
    switch (operation) {
        case "SUB": return - value1;
        case "ADD":
        case "NOP": return value1;
        case "MUL":
        case "DIV":
        default: return -1;
    }
}

function interpret(prog: AST, store: Map<string, Store>): [number, Map<string, Store>] {
    switch (prog.type) {
        case ('Sequence'): {
            if (prog.children.left && prog.children.right) {
                const [_, store1]: [number, Map<string, Store>] = interpret(prog.children.left, store);
                const [value, store2]: [number, Map<string, Store>] = interpret(prog.children.right, store1);
                return [value, store2];
            }
            const error = new Map();
            error.set("ERROR! Malformed sequence.", -1);
            return [-1, error];
        }
        case ('Assignment'): {
            if (prog.children.argument && prog.properties.name && (prog.properties.constant !== undefined)) {
                const [value, store1]: [number, Map<string, Store>] = interpret(prog.children.argument, store);
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
        case ('BinaryOperation'): {
            if (prog.children.left && prog.children.right && prog.properties.operation) {
                const [value1, store1]: [number, Map<string, Store>] = interpret(prog.children.left, store);
                const [value2, store2]: [number, Map<string, Store>] = interpret(prog.children.right, store1);
                const res: number = doOperation(prog.properties.operation, value1, value2);
                return [res, store2];
            }
            const error = new Map();
            error.set("ERROR! Malformed binary operation.", -1);
            return [-1, error];
        }
        case ('UnaryOperation'): {
            if (prog.children.argument && prog.properties.operation) {
                const [value, store1]: [number, Map<string, Store>] = interpret(prog.children.argument, store);
                const res: number = doUnary(prog.properties.operation, value);
                return [res, store1];
            }
            const error = new Map();
            error.set("ERROR! Malformed unary operation.", -1);
            return [-1, error];
        }
        case ('Bracket'): {
            if (prog.children.argument) {
                const [value, store1]: [number, Map<string, Store>] = interpret(prog.children.argument, store);
                return [value, store1];
            }
            const error = new Map();
            error.set("ERROR! Malformed bracket.", -1);
            return [-1, error];
        }
        case ('Variable'): {
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
        case ('Number'): {
            if  (prog.properties.significand) {
                const value: number = parseFloat(prog.properties.significand);
                return [value, store];
            }
            const error = new Map();
            error.set("ERROR! Malformed number.", -1);
            return [-1, error];
        }
        case ('Unknown'): {
            const error = new Map();
            error.set("ERROR! Unknown instruction.", -1);
            return [-1, error];
        }
    }

    return [0, new Map()];
}

export default function (prog: AST): number {
    const [value, store] = interpret(prog, new Map());
    if (value === -1) {
        console.log(store);
    }
    return value;
}
