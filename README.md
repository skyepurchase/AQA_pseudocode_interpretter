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
main   -> _ ADDSUB _

ADDSUB -> MULDIV _ %Plus _ ADDSUB
        | MULDIV _ %Minus _ ADDSUB
        | MULDIV

MULDIV -> UN _ %Mul _ MULDIV
        | UN _ %Div _ MULDIV
        | UN

UN     -> %Plus _ UN
        | %Minus _ UN

NUM    -> %Int

_ -> [\s]:*
```

## Onwards and Upwards

These ideas extend to the entire grammar.
These are easy examples that only need the simplest processing, in the following chapters more complicated ideas are implemented.

## Sequences

A program is not a single statement that is evaluated, it is a number of separate sequences that are evaluated in turn.
These sequence may return results used by other sequences, or may effect the state of the whole program (if stateful).
With just mathematical statements this makes limited sense as evaluating one mathematical expression does not effect the next.
However, when we introduce more complex ideas this will be essential.

### Tokens

In pseudocode a new line suggests a new sequence that is distinct from the previous.
This will still work when we get to code blocks later but for now this works.
```
Sep(\n)
```

### Rules

All programs are sequences, they can be a single element sequence but they are still sequences.
The rest of the parser still only parses arithmetic expressions so we just insert sequences between the entrypoint and addition and subtraction.
```
main   -> _ SEQ _

SEQ    -> ADDSUB _ SEP _ SEQ
        | ADDSUB
```

## Bracketting

Because multiplication and division are so tightly bound it is impossible to generate all ASTs as `5/3+3` will only be
```
    +
   / \
  \   3
 / \
5   3
```
And nothing else.
Adding bracketting allows for `5/(3+3)` which is a very different expression but now we have a major problem: "Balancing".
`5/(3+3` is not valid because there is not closing bracket.
Thankfully, Earley parsers can handle the balancing problem and so the necessary rules can be added.

### Tokens

```
LBra('(')
RBra(')')
```

### Rules

When an expression gets down to multiplication and division then bracketting may occur to bind some addition or similar tighter.
This bracketted expression behaves the same as the literal, `NUM`, in the `MULDIV` rule so it is replaced.
```
MULDIV -> BRA _ %Mul _ MULDIV
        | BRA _ %Div _ MULDIV
        | BRA

BRA    -> %LBra _ ADDSUB _ %RBra
        | NUM
```

## Variables

In any program (or even mathematical expression) there are variables that help in reusing results rather than recalculating them.
These can be declared, assigned, and used throughout the program.

### Tokens

```
Ass(<-)
Id(s)
Keyword(CONSTANT)

```

### Rules

Declaration and assignment can be treated similarly as an assignment operation, which is in fact binary.
Reference (being used in the program) is the same as `NUM` and is just a literal that the interpretter/compiler can deal with.

```
SEQ    -> ...
        | ASS _ %Sep _ SEQ
        | ASS

ASS    -> %Id _ %Ass _ ADDSUB
        | %CONSTANT _ %Id _ %Ass _ ADDSUB

BRA    -> ...
        | VAR

VAR    -> %Id
```

## Interpretter

Now that the program is more than correctly written arithmetic expressions it is worthwhile to interpret the language.
This means reading in the symbols from the AST, carrying out operations (in javascript) with the properties and recursively calling for the children in the AST.

The collection of symbols `ADD(NUM(4), SUB(NUM(3), NUM(2)))` needs to be slowly unpacked to arrive at the answer of `5`.
The interpretter will receive the symbol `ADD` with children `NUM(4)` and `SUB(NUM(3), NUM(2))` and must calculate their sum.
However, `SUB(...)` is not a number and `NUM(4)` is not a number (it represents a number but it isn't the javascript number 4.
Both of these need to be evaluated, using the same function, returning the javascript number representation 4 and 1.

Most symbols are straight forward, either calculating the obvious operation or converting the number representation to a javascript number.
The interesting area is variables, as these can be assigned early on, access later, and even reassigned.
The concept of a store mapping variable names to javascript numbers is introduced.
Whenever there is a variable assignment the store is updated placing the value into the store.
When the variable is referenced the store is accessed and the value of the variable is returned.

In some languages you must declare space to put the variable but here if an assignment is occurred we assume space exists.
The psuedocode does however include constants, so instead of storing just the number in the store an additional `isConst` property is added.
If an assignment occurs to a variable that already exists that has the property `isConst` the assignment fails and and error is thrown.
