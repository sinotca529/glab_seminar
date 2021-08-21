# Define concrete transitional semantics
## Steps
1. Define the set of states : $\mathbb{S}$.
2. Define the transition relation : $\hookrightarrow \ (\subseteq \mathbb{S} \times \mathbb{S})$.
3. Define $\textit{Step}$ : natural powerset-lifted version of $\hookrightarrow$
4. Define a concrete semantics.

## [1/4] Define the set of states: $\mathbb{S}$
A state $s \in \mathbb{S}$ is a pair $(l, m)$.
- $l \in \mathbb{L}$ : program label which denotes the next operator.
- $m \in \mathbb{M}$ : machine state at $l$ (before exec $l$).
    - That would consist of:
        - memory : `Map<Addr, Value>`
        - environment : `Map<Variable, Addr>`
        - continuation of the program

## [2/4] Define the transition relation $\hookrightarrow$
If the next state of $s = (l, m)$ is $s' = (l', m')$ :
$$
\begin{align}
    s &\hookrightarrow s'\\
    (l, m) &\hookrightarrow (l', m')
\end{align}
$$

> - The next label $l'$ called **control flow**
> - **Control flow** may not be determined solely by the syntax.
>     - ex. `goto`, func-ptr, ...
>     - In those cases, $l'$ is an evaluation result from the current state $(l, m)$.

## [3/4] Define $\textit{Step}$

> **Def. 4.1 (Concrete semantics, the set of reachable states)**
>
> $\textit{Step}$ is a natural powerset-lifted version of $\hookrightarrow$
>
> $$
> \begin{align}
>     \textit{Step} \ &:\  {\Large\wp}(\mathbb{S}) \rightarrow {\Large\wp}(\mathbb{S}) \\
>     \textit{Step}(X) &= \{ s' | s \hookrightarrow s', s \in X \}
> \end{align}
> $$

## [4/4] Define a concrete semantics.
- **We restrict our analysis interest to computing the set of reachable states.**
- So, we define the concrete semantics as the set of all the reachable states of the program.


<details style="background-color: var(--quote-bg);">
<summary>Example 4.2 (Reachable states)</summary>

Consider the program:

<div>
<div style="float:left; width:50%">

```py
# 0: (label)
input(x)
# 1
while (x <= 99)
    # 2
    x += 1
# 3
```

</div>

<div style="text-align:center">

![](./fig/ex4.1.drawio.svg)

</div>

</div>



Assumptions:
- Initial state : empty memory $\emptyset$
- Inputs are only 0, 99 and 100

Concrete semantics of the program is:
$$
\begin{align}
              & \{(0, \emptyset), (1, x \mapsto 100), (3, x \mapsto 100)\}\\
    \cup \quad& \{(0, \emptyset), (1, x \mapsto 99), (2, x \mapsto 99), (1, x \mapsto 100), (3, x \mapsto 100)\}\\
    \cup \quad& \{(0, \emptyset), (1, x \mapsto 0), (2, x \mapsto 0), (1, x \mapsto 1), \cdots, (1, x \mapsto 100), (3, x \mapsto 100)\}
\end{align}
$$

</details>


### Accumulate all reachable states
Reachable states of a program is:
$$
\begin{align}
    \bigcup_{i=0}^\infty \textit{Step}^i(I) \quad (I \text{ is initial states}) \label{eq:reachable}
\end{align}
$$

We define the function $F$ :
$$
\begin{align}
    &F: \mathscr{\mathbb{S}} \rightarrow \mathscr{\mathbb{S}}\\
    &F(X) = I \cup \textit{Step}(X)
\end{align}
$$

It means,
$$
\begin{align}
    F^i(\emptyset) =
        \begin{cases}
            \emptyset & (i = 0)\\
            \bigcup_{k=0}^{i-1} \textit{Step}^k(I) & (i > 0)
        \end{cases}
\end{align}
$$

$F$ has a least fix point:
$$
\begin{align}
    \textbf{lfp} F = \bigcup_{i=0}^\infty F^i(\emptyset)
\end{align}
$$

Because
- $F$ is a monotonic function over $({\Large\wp}(\mathbb{S}), \subseteq)$ and $\mathbb{S}$ is finite height
    - →　$F$ is a continuous function over $({\Large\wp}(\mathbb{S}), \subseteq)$
- $\mathbb{S}$ has a infimum $\emptyset$

(We will skip the proof because we already saw it in ModelChecking)

> **Continuous**
>
> A function $f : A \rightarrow B$ is continuous when :
>
> For all chain $\{ a_i \}$ on $A$,
> $$
> \begin{align}
>     \sqcup\{ f(a_i) \} = f(\sqcup \{a_i\})
> \end{align}
> $$


The $\textbf{lfp} F$ is equal to the reachable states $\eqref{eq:reachable}$ :
$$
\begin{align}
    \textbf{lfp} F = \bigcup_{i=0}^\infty F^i(\emptyset) = \bigcup_{i=0}^\infty \textit{Step}^i(I)
\end{align}
$$



> **Def 4.2 (Semantic domain and semantic function)**
>
> We call:
> - $F$ : concrete **semantic function**
> - $({\Large\wp}(\mathbb{S}), \subseteq)$ : **concrete semantic domain** or **concrete domain**
