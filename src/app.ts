import { isUndefined } from 'lodash';
import { lexer } from './Grammar'

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

readline.question('Programme: ', (name: string) => {
    lexer.reset(name);
    let token: Object | undefined = lexer.next();
    while (!isUndefined(token)) {
        console.log(token);
        token = lexer.next();
    }
    readline.close();
});
