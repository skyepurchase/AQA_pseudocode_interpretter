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

Looking at the [AQA pseudocode](://filestore.aqa.org.uk/resources/computing/AQA-8525-NG-PC.PDF) The following tokens are a sensible start:

```
INT(d)
OPERATOR(
    PLUS: +
    MINUS: -
    MUL: 'asterix'
    DIV: /
```

The brackets show what text is stored with the token (in `moo.js`).
**This is an ever increasing list of things the transpiler can deal with.**

## The Parsing Problem

Given a list of tokens as they appear they need to be converted into some structure that removes abiguity.
Take the expression "20+5*3", this is tokenised to `[20,PLUS,5,MUL,3]` but it is ambiguous as to whether this is `75` or `35`.

Parsing removes this ambiguity by generating an Abstract Syntax Tree (AST) based on parsing rules.
The AST consists of nodes which could be operations or literals (i.e. integers in the current case) and edges connecting these nodes.
It is a tree and so is hierachical with an operation having two children representing the left and right expression it will operate on.

This allows for defining the tightness of operation binding.
In BODMAS, division and multiplication are more tightly bound as they occur first.
In the example "5*3" is calculated first, you can think of operator binding as bracketing:
"20+5*3" -> "20+(5*3)".

This can be expressed in parsing rules.
We have the basic rule `NUM` that creates a leaf with the value of the token as an integer (and we can verify the token is in fact an integer).
This can be written as `NUM -> %Int` where `Int` is a token matching integers.

We can define "MulDiv" the same:
```
MulDiv -> NUM %MD MulDiv
        | NUM
```
where `MD` is the multiplication or division token.
Notice that we always make sure that there is a `NUM` which eventually becomes a token.

Adding addition as
```
AddSub -> MulDiv %AS AddSub
        | MulDiv
```
means that multiplication and division bind tighter than addition and subtraction, but we can still just have a single number if necessary.
An entrypoint expecting an `AddSub` then allows us to parse any basic arithmetic without brackets.

*Note:*
`_` can be used to match whitespace, or any other "nothing" character, so the rules would be more likely `AddSub -> MulDiv _ %AS _ AddSub`.
With additional rule `_ -> [\s]`.

### Processing Rules

When a rule matches (such as `AddSub -> MulDiv %AS AddSub`) we can process the resulting matches to generate our own return objects.
This can be used create a custom AST object `{type, properties, children}` that records the type of the node, the properties, and it's child nodes.
In this case we have `{type: "BinaryOperation", properties: { operation: %AS }, children: { left: lhs, right: rhs } }`,
where `%AS` is the specific token, `lhs` and `rhs` are the processed `MulDiv` and `AddSub` matches respectively.

For the fall through cases (such as `AddSub -> MulDiv`) no function needs to be written and the build in `id` function is used.
This just returns the generated object from the specific `MulDiv` match.

For efficiency reasons the processing on whitespace should be null returning so that no uneccessary process occurs.

### Parsing Rules

```
main   -> _ AddSub _

AddSub -> MulDiv _ %Plus _ AddSub
        | MulDiv _ %Minus _ AddSub
        | MulDiv

MulDiv -> Un _ %Mul _ MulDiv
        | Un _ %Div _ MulDiv
        | Un

Un     -> %Plus _ Un
        | %Minus _ Un

Num    -> %int

_ -> [\s]:*
```

