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
export const lexer = moo.compile({
    Keyword: [
        'CONSTANT'
    ],
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

