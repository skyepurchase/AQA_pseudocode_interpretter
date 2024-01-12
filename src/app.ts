import { AST } from "./Grammar";
import parseProgram from "./parseAQA";
import interpretProgram from "./interpAQA_0";

function isAST(param: AST | { error: unknown }): param is AST {
    return (param as AST).type !== undefined;
}

const ASTstringify = (ast: AST) : string => {
    const sep: string = ast.type === "Sequence" ?
        "; " :
        (ast.children.left && ast.children.right ? ", " : "");
    const childrenString: string = ast.children.argument ?
        ASTstringify(ast.children.argument) :
        (ast.children.left ? ASTstringify(ast.children.left) : "") + sep + 
        (ast.children.right ? ASTstringify(ast.children.right) : "");

    let returnString: string = "";
    switch (ast.type) {
        case "Boolean":
        case "Number": {
            returnString = ast.properties.significand ?? "NaN";
            break;
        }
        case "Assignment": {
            const start: string = ast.properties.constant ? "{" : " => ";
            const end: string = ast.properties.constant ? "}" : "";
            returnString = (ast.properties.name ?? "Unknown") + start + childrenString + end;
            break;
        }
        case "Conditional": {
            if (ast.children.argument && ast.children.left && ast.children.right) {
                returnString = "(" + ASTstringify(ast.children.argument) + " ? "
                             + ASTstringify(ast.children.left) +
                             (ast.properties.type === "if-then-else" ?
                              (" : " + ASTstringify(ast.children.right)) :
                              ""
                             ) + ")";
                break;
            }
            returnString = "Bad Conditional";
            break;
        }
        case "Loop": {
            if (ast.children.argument && ast.children.left) {
                const cond = ASTstringify(ast.children.argument);
                const seq = ASTstringify(ast.children.left);
                const sep = ast.properties.type === "While" ? "? " : " ?";
                const fst = ast.properties.type === "While" ? cond : seq;
                const snd = ast.properties.type === "While" ? seq : cond;
                returnString = "|: " + fst + sep + snd + " :|";
                break;
            }
            returnString = "Bad Conditional";
            break;
        }
        case "Variable": {
            returnString = ast.properties.name ?? "Unknown";
            break;
        }
        case "Sequence": {
            returnString = childrenString;
            break;
        }
        case "Bracket": {
            returnString = childrenString;
            break;
        }
        case "Relation": {
            returnString = (ast.properties.relation ?? "NOP") + "(" + childrenString + ")";
            break;
        }
        case "UnaryOperation":
        case "BinaryOperation":
        default: {
            returnString = (ast.properties.operation ?? "NOP") + "(" + childrenString + ")";
            break;
        }
    }

    return returnString;
}

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

let input: string = "";

console.log("++++INPUT++++");
readline.on("line", (line: string) => {
    if (line === "parse") {
        console.log("+++++++++++++\n\n+++PROGRAM+++");
        const parse = parseProgram(input);

        if (isAST(parse)) {
            console.log(ASTstringify(parse), "\n+++++++++++++\n\n++++INPUT++++");
        }

        input = ""
    } else if (line === "run") {
        console.log("+++++++++++++\n\n+++OUTPUT++++");
        const parse = parseProgram(input);

        if (isAST(parse)) {
            console.log(interpretProgram(parse), "\n+++++++++++++\n\n++++INPUT++++");
        }

        input = "";
    } else if (line === "quit") {
        console.log("+++++++++++++");
        readline.close();
    } else {
        if (input) {
            input += "\n" + line;
        } else {
            input = line;
        }
    }
})

