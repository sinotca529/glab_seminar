# ISA Ch.4 : A General Static Analysis Framework Based on a Transitional Semantics

## Goal
Provide a formal introduction to static analysis by the transitional style.

Transitional style is useful when the target language's compositional semantics is not obvious.
- ex. When the program contains dynamic jumps such as `goto`.

Transitional style is also a good fit for the proof of the reachability property.

## Contents
1. [Define concrete semantic](./concrete.md)
2. [Define abstract semantic](./abstract.md)
3. [Define sound analysis](./analysis.md)
4. [Summary](./summary.md)
5. [Example of the framework](./ex_framework.md)
