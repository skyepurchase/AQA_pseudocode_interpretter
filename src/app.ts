// import { isUndefined } from 'lodash';
// import { lexer } from './Grammar'
//
// readline.question('Programme: ', (name: string) => {
//     lexer.reset(name);
//     let token: Object | undefined = lexer.next();
//     while (!isUndefined(token)) {
//         console.log(token);
//         token = lexer.next();
//     }
//     readline.close();
// });

import { AST } from "./Grammar";
import parseProgram from "./parseAQA"

function isAST(param: AST | { error: unknown }): param is AST {
    return (param as AST).type !== undefined;
}

const ASTstringify = (ast: AST) : string => {
    const sep: string = ast.children.left && ast.children.right ? "," : "";
    const childrenString: string = (ast.children.left ? ASTstringify(ast.children.left) : "") + sep + 
                                 (ast.children.right ? ASTstringify(ast.children.right) : "");

    let returnString: string = "";
    if (ast.type === "Num") {
        returnString = ast.properties.significand ?? "NaN";
    } else {
        returnString = (ast.properties.operation ?? "NOP") + "(" + childrenString +")";
    }

    return returnString;
}

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

let input: string = "";

readline.on("line", (line: string) => {
    if (line === "parse") {
        const parse = parseProgram(input);

        if (isAST(parse)) {
            console.log(ASTstringify(parse));
        }

        input = ""
    } else if (line === "quit") {
        readline.close();
    } else {
        input += line;
    }
})

