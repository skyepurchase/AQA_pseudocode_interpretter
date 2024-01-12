import { isBoolean, isNumber } from 'lodash';
import _cloneDeep from 'lodash/cloneDeep';
import { AST, Operation, Relation } from './Grammar'

interface ERROR {
    message: string
}

interface VOID {};

type Value = number | boolean | string | ERROR | VOID

interface Variable {
    value: Value,
    isConst: boolean
}

interface Subroutine {
    program: AST,
    parameters: string[],
    return: AST | undefined
}

type Store = Variable | Subroutine;

function isVariable(param: Store): param is Variable {
    return (param as Variable).value !== undefined;
}

function isSubroutine(param: Store): param is Subroutine {
    return (param as Subroutine).program !== undefined;
}

function isERROR(param: Value): param is ERROR {
    return (param as ERROR).message !== undefined;
}

const VOID: VOID = {};

function doOperation(operation: Operation, value1: Value, value2: Value): Value {
    if (isERROR(value1)) return value1;
    if (isERROR(value2)) return value2;

    if (isNumber(value1) && isNumber(value2)) {
        switch (operation) {
            case "ADD": return value1 + value2;
            case "SUB": return value1 - value2;
            case "MUL": return value1 * value2;
            case "DIV": return value1 / value2;
            case "NOP": return value1;
            default: return { message: "ERROR! Received numbers was expecting booleans." };
        }
    } else if (isBoolean(value1) && isBoolean(value2)) {
        switch (operation) {
            case "AND": return value1 && value2;
            case "OR": return value1 || value2;
            case "NOP": return value1;
            default: return { message: "ERROR! Received booleans was expecting numbers." };
        }
    }
    return { message: "ERROR! Received non-matching or non-valid types." };
}

function doUnary(operation: Operation, value1: Value): Value {
    if (isERROR(value1)) return value1;

    if (isNumber(value1)) {
        switch (operation) {
            case "SUB": return - value1;
            case "ADD":
            case "NOP": return value1;
            default: return { message: "ERROR! Received a number was expecting a boolean." };
        }
    } else if (isBoolean(value1)) {
        switch (operation) {
            case "NOT": return !value1;
            case "NOP": return value1;
            default: return { message: "ERROR! Received boolean was expecting a number." };
        }
    }
    return { message: "ERROR! Received non-valid type." };
}

function doRelation(relation: Relation, value1: Value, value2: Value): Value {
    if (isERROR(value1)) return value1;
    if (isERROR(value2)) return value2;

    if (isNumber(value1) && isNumber(value2)) {
        switch (relation) {
            case 'EQ': return value1 === value2;
            case 'GT': return value1 > value2;
            case 'LT': return value1 < value2;
            case 'GEQ': return value1 >= value2;
            case 'LEQ': return value1 <= value2;
            case 'NEQ': return value1 !== value2;
            default: return { message: "Operation not found."};
        }
    }
    return { message: "ERROR! Received non-matching or non-valid types." };
}

function getParams(parameters: AST, prevParams: string[] = []): string[] {
    const name = parameters.properties.name;
    const otherParms = parameters.children.argument;

    if (name) prevParams.push(name)

    return otherParms ? getParams(otherParms, prevParams) : prevParams;
}

function runProgram(subroutine: Subroutine, parameters: AST, store: Map<string, Store>): [Value, Map<string, Store>] {
    const params: string[] = getParams(parameters);
    if (params.length !== subroutine.parameters.length) {
        return [{ message: `ERROR! Incorrect number of parameters provided. Expected ${subroutine.parameters.length} received ${params.length}` }, store]
    }

    // Push all the values onto the stack
    const functionStore: Map<string, Store> = _cloneDeep(store);
    for (let i = 0; i < params.length; i++) {
        const variable: Store | undefined = store.get(params[i]);
        if (variable !== undefined && isVariable(variable)) {
            functionStore.set(subroutine.parameters[i], { value: variable.value, isConst: false });
        } else {
            return [{ message: `ERROR! Variable ${params[i]} not found or not a variable.` }, store];
        }
    }

    // Run the subroutine
    const [_, store1]: [Value, Map<string, Store>] = interpret(subroutine.program, functionStore);

    // Get return value if it exists
    let [res, store2]: [Value, Map<string, Store>] = [VOID, store1];
    if (subroutine.return) {
        [res, store2] = interpret(subroutine.return, store1);
    }

    // Remove scoped variables (readding masked global variables)
    params.forEach(
        function(parameter: string): void {
            store2.delete(parameter);
        }
    );
    store.forEach(
        function(value: Store, parameter: string): void {
            if (!store2.has(parameter)) {
                store2.set(parameter, value);
            }
        }
    );

    // And finally return the result
    return [res, store2];
}


function interpret(prog: AST, store: Map<string, Store>): [Value, Map<string, Store>] {
    switch (prog.type) {
        case 'Sequence': {
            if (prog.children.left && prog.children.right) {
                const [maybeError, store1]: [Value, Map<string, Store>] = interpret(prog.children.left, store);
                if (isERROR(maybeError)) return [maybeError, store1];

                const [value, store2]: [Value, Map<string, Store>] = interpret(prog.children.right, store1);
                if (isERROR(value)) return [value, store2];

                return [value, store2];
            }
            return [{ message : "ERROR! Malformed sequence." }, store]
        }
        case 'Subroutine': {
            if (prog.properties.name && prog.children.argument && prog.children.params) {
                const name: string = prog.properties.name;
                const subProg: AST = prog.children.argument;
                const params: string[] = getParams(prog.children.params);
                let ret: AST | undefined = prog.children.ret;

                const newStore: Map<string, Store> = store.set(name, { program: subProg, parameters: params, return: ret })
                return [0, newStore]; // placeholder value
            }
            return [{ message : "ERROR! Subroutine definition." }, store]
        }
        case 'Assignment': {
            if (prog.children.argument && prog.properties.name && (prog.properties.constant !== undefined)) {
                const [value, store1]: [Value, Map<string, Store>] = interpret(prog.children.argument, store);
                if (isERROR(value)) return [value, store1];
                const variable: Store | undefined = store1.get(prog.properties.name);
                if ((variable !== undefined) && !isVariable(variable)) {
                    return [{ message: "ERROR! Tried to assign to something that is not a variable" }, store1]
                } else {
                    if (variable?.isConst) {
                        return [{ message : `ERROR! Attempted to reassign ${prog.properties.name} but it is a constant variable.` }, store]
                    }
                }

                return [0, store1.set(prog.properties.name, { value: value, isConst: prog.properties.constant})];
            }
            return [{ message : "ERROR! Malformed assignment." }, store]
        }
        case 'Conditional': {
            if (prog.children.argument && prog.children.left && prog.children.right) {
                const [value1, store1]: [Value, Map<string, Store>] = interpret(prog.children.argument, store);
                if (isERROR(value1)) return [value1, store1];

                if (isBoolean(value1)) {
                    const [value2, store2] = value1 ?
                        interpret(prog.children.left, store1) :
                        (prog.properties.type === "if-then-else" ? 
                            interpret(prog.children.right, store1) :
                            [0, store1]); // Placeholder
                    if (isERROR(value2)) return [value2, store2];

                    return [value2, store2];
                } else {
                    return [{ message : "ERROR! Non-boolean condition" }, store]
                }
            }
            return [{ message : "ERROR! Malformed conditional." }, store]
        }
        case 'Loop': {
            if (prog.properties.type && prog.children.left && prog.children.argument) {
                let currStore: Map<string, Store> = store;
                let cond: Value = -1;
                let value: Value = -1;
                if (prog.properties.type === "Repeat") {
                    [value, currStore] = interpret(prog.children.left, store);
                    if (isERROR(value)) return [value, currStore];
                }

                [cond, currStore] = interpret(prog.children.argument, currStore);
                if (isERROR(cond)) return [cond, currStore];

                while (prog.properties.type === "While" ? cond : !cond) {
                    [value, currStore] = interpret(prog.children.left, currStore);
                    if (isERROR(value)) return [value, currStore];

                    [cond, currStore] = interpret(prog.children.argument, currStore);
                    if (isERROR(cond)) return [cond, currStore];
                }
                return [value, currStore];
            }
            return [{ message : "ERROR! Malformed loop." }, store]
        }
        case 'Relation': {
            if (prog.children.left && prog.children.right && prog.properties.relation) {
                const [value1, store1]: [Value, Map<string, Store>] = interpret(prog.children.left, store);
                if (isERROR(value1)) return [value1, store1];

                const [value2, store2]: [Value, Map<string, Store>] = interpret(prog.children.right, store1);
                if (isERROR(value2)) return [value2, store2];

                const res = doRelation(prog.properties.relation, value1, value2);
                if (isERROR(res)) return [res, store2];

                return [res, store2];
            }
            return [{ message : "ERROR! Malformed relation." }, store]
        }
        case 'BinaryOperation': {
            if (prog.children.left && prog.children.right && prog.properties.operation) {
                const [value1, store1]: [Value, Map<string, Store>] = interpret(prog.children.left, store);
                if (isERROR(value1)) return [value1, store1];

                const [value2, store2]: [Value, Map<string, Store>] = interpret(prog.children.right, store1);
                if (isERROR(value2)) return [value2, store2];

                const res: Value = doOperation(prog.properties.operation, value1, value2);
                if (isERROR(res)) return [res, store2];

                return [res, store2];
            }
            return [{ message : "ERROR! Malformed binary operation." }, store]
        }
        case 'UnaryOperation': {
            if (prog.children.argument && prog.properties.operation) {
                const [value, store1]: [Value, Map<string, Store>] = interpret(prog.children.argument, store);
                if (isERROR(value)) return [value, store1];

                const res: Value = doUnary(prog.properties.operation, value);
                if (isERROR(res)) return [res, store1];

                return [res, store1];
            }
            return [{ message : "ERROR! Malformed unary operation." }, store]
        }
        case 'Output': {
            if (prog.children.argument) {
                const [value, store1]: [Value, Map<string, Store>] = interpret(prog.children.argument, store);
                if (isERROR(value)) return [value, store1];

                console.log(value);
                return [value, store1];
            }
            return [{ message: "ERROR! Malformed output statement." }, store]
        }
        case 'Arguments': {
            if (prog.children.left && prog.children.right) {
                const [value1, store1]: [Value, Map<string, Store>] = interpret(prog.children.left, store);
                if (isERROR(value1)) return [value1, store1];

                const [value2, store2]: [Value, Map<string, Store>] = interpret(prog.children.right, store);
                if (isERROR(value2)) return [value2, store2];

                return [value1 + " " + value2, store2];
            }
            return [{ message: "ERROR! Malformed arguments." }, store]
        }
        case 'Bracket': {
            if (prog.children.argument) {
                const [value, store1]: [Value, Map<string, Store>] = interpret(prog.children.argument, store);
                return [value, store1];
            }
            return [{ message: "ERROR! Malformed brackets." }, store]
        }
        case 'Call': {
            console.log(prog);
            if (prog.properties.name && prog.children.argument) {
                const subProg: Store | undefined = store.get(prog.properties.name);
                if (subProg === undefined || !isSubroutine(subProg)) {
                    return [{ message: "ERROR! Tried to call something that is not a subroutine" }, store]
                } else {
                    return runProgram(subProg, prog.children.argument, store);
                }
            }
            return [{ message: "ERROR! Malformed call site." }, store]
        }
        case 'Parameters': {
            return [{ message: "ERROR! Parameters interpretted outside of subroutine." }, store]
        }
        case 'Variable': {
            if (prog.properties.name) {
                const variable: Store | undefined = store.get(prog.properties.name);
                if (variable !== undefined && !isVariable(variable)) {
                    return [{ message: "ERROR! Tried to reference something that is not a variable." }, store];
                } else {
                    const res = variable ? variable.value : { message : `ERROR! Variable ${prog.properties.name} not found.` };
                    return [res, store];
                }

            }
            return [{ message : "ERROR! Malformed variable access." }, store]
        }
        case 'Number': {
            if  (prog.properties.significand) {
                const value: Value = parseFloat(prog.properties.significand);
                return [value, store];
            }
            return [{ message : "ERROR! Malformed number." }, store]
        }
        case 'Boolean': {
            if (prog.properties.significand) {
                const value: Value = prog.properties.significand === "True";
                return [value, store];
            }
            return [{ message : "ERROR! Malformed boolean." }, store]
        }
        case 'Unknown': {
            return [{ message : "ERROR! Unknown instruction." }, store]
        }
    }
}

export default function (prog: AST): void {
    const [value, store] = interpret(prog, new Map());
    if (isERROR(value)) {
        console.log(value.message);
    }
    console.log("\n+++STORE+++");
    console.log(store);
    console.log("+++++++++++\n");
}
