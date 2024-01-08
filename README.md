# AQA Pseudocode Transpiler

Transpile AQA pseudocode into javascript to run the code natively in the browser.
This process needs to also run in the browser, so a transpiler written in javascript, targetting javascript.

## The Lexing Problem

The code as written by a student will be a string of characters.
This is not useful to any program and uses more data than it required.
Furthermore, "5" is different from `5` but are represented the same in the input string.

It is better to convert the string of characters into tokens.
These tokens could be operators (+, -, *, ...), comments, identifiers, keywords (IF, WHILE, LOOP, ...), and so on.
At this stage we don't provide any specific meaning, but the phrase "FOR prime IN primes" becomes something like
`[FOR, ID: "prime", IN, ID: "primes"]`

### The Tokens

Looking at the [AQA pseudocode](://filestore.aqa.org.uk/resources/computing/AQA-8525-NG-PC.PDF) The following tokens are sensible:

```
COMMENT(s)
ID(s)
OPERATOR(
    ADD: +
    SUB: -
    MUL: 'asterix'
    DIV: /
    INT_DIV: INT_DIV
    MOD: MOD
    LT: <
    GT: >
    EQ: =
    NE: ≠
    LE: ≤
    GE: ≥)
KEY(CONSTANT)
```

The brackets show what text is stored with the token (in `moo.js`).
**This is an ever increasing list of things the transpiler can deal with.**
