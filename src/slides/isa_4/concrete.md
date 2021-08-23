# Define concrete transitional semantics
## Steps
1. Define the set of states : $\mathbb{S}$.
2. Define the transition relation : $\hookrightarrow \ (\subseteq \mathbb{S} \times \mathbb{S})$.
3. Define $\textit{Step}$ : natural powerset-lifted version of $\hookrightarrow$
4. Define a concrete semantics.

## [1/4] Define the set of states: $\mathbb{S}$
A state $s \in \mathbb{S}$ is a pair $(l, m)$.
- $l \in \mathbb{L}$ : program label which denotes the **next** operator.
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

> **Example 4.1 (Concrete transition sequence)**
>
> Consider the program:
>
> <div>
> <div style="float:left; width:50%">
>
> ```py
> # 0: (label)
> input(x)
> # 1
> while (x <= 99)
>     # 2
>     x += 1
> # 3
> ```
>
> </div>
> <div style="text-align:center">
>
> ![](./fig/ex4.1.drawio.svg)
>
> </div>
> </div>
>
> Assumptions:
> - Initial state : empty memory $\emptyset$
> - Inputs are only 0, 99 and 100
>
> Transition sequence for the inputs are :
> $$
> \begin{align}
>     &(0, \emptyset)\hookrightarrow (1, x \mapsto 100)\hookrightarrow (3, x \mapsto 100)\\
>     &(0, \emptyset)\hookrightarrow (1, x \mapsto 99)\hookrightarrow  (1, x \mapsto 99)\hookrightarrow (\textcolor{green}{\textbf{Q. Fill the rest.}})\\
>     &(0, \emptyset)\hookrightarrow (1, x \mapsto 0)\hookrightarrow (2, x \mapsto 0)\hookrightarrow (1, x \mapsto 1)\hookrightarrow \nonumber\\
>     &\qquad\qquad\quad\cdots\hookrightarrow (1, x \mapsto 100)\hookrightarrow (3, x \mapsto 100)
> \end{align}
> $$
>
> <details>
> <summary>Answer</summary>
> $$(0, \emptyset)\hookrightarrow (1, x \mapsto 99)\hookrightarrow (2, x \mapsto 99)\hookrightarrow (1, x \mapsto 100)\hookrightarrow (3, x \mapsto 100)$$
> </details>

## [3/4] Define $\textit{Step}$
$\textit{Step}$ is a natural powerset-lifted version of $\hookrightarrow$
$$
\begin{align}
    \textit{Step} \ &:\  {\Large\wp}(\mathbb{S}) \rightarrow {\Large\wp}(\mathbb{S}) \\
    \textit{Step}(X) &= \{ s' | s \hookrightarrow s', s \in X \}
\end{align}
$$

## [4/4] Define a concrete semantics.
- **We restrict our analysis interest to computing the set of reachable states.**
- So, we define the concrete semantics as the set of all the reachable states of the program.

> **Example 4.2 (Reachable states)**
>
> Consider the program:
> ```py
> # 0: (label)
> input(x)
> # 1
> while (x <= 99)
>     # 2
>     x += 1
> # 3
> ```
>
> Assumptions:
> - Initial state : empty memory $\emptyset$
> - Inputs are only 0, 99 and 100
>
> Concrete semantics of the program is:
> $$
> \begin{align}
>            & \{(0, \emptyset), (1, x \mapsto 100), (3, x \mapsto 100)\}\\
>     \cup \ & \{(0, \emptyset), (1, x \mapsto 99), (2, x \mapsto 99), (1, x \mapsto 100), (3, x \mapsto 100)\}\\
>     \cup \ & \{(0, \emptyset), (1, x \mapsto 0), (2, x \mapsto 0), (1, x \mapsto 1), \cdots, (1, x \mapsto 100), (3, x \mapsto 100)\}
> \end{align}
> $$


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
    &F: {\Large\wp}(\mathbb{S}) \rightarrow {\Large\wp}(\mathbb{S})\\
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

(When ${\Large\wp}(\mathbb{S})$ is finite height,) $F$ has a least fix point :
$$
\begin{align}
    \textbf{lfp} F = \bigcup_{i=0}^\infty F^i(\emptyset)
\end{align}
$$

Because
- $F$ is a monotonic function and ${\Large\wp}(\mathbb{S})$ is finite height.
    - →　$F$ is a continuous function over $({\Large\wp}(\mathbb{S}), \subseteq)$.
- $\emptyset$ is the infimum of ${\Large\wp}(\mathbb{S})$.

(We will skip the proof because we already saw it in ModelChecking)

> **Continuous**
>
> A function $f : A \rightarrow B$ is continuous when :
>
> For all [chain](./analysis.md#14-make-assumptions-for-soundness) $\{ a_i \}$ on $A$,
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

## Summary
> **Def. 4.1 (Concrete semantics, the set of reachable states)**
> Given a program and
> - $\mathbb{S}$ : the set of states
> - $\hookrightarrow$ : a one-step transition relation between two states
> - $I$ : the set of initial states
> - $\textit{Step}$ : a natural powerset-lifted version of $\hookrightarrow$
> - $F(X) = I \cup \textit{Step}(X)$
>
> Then, the concrete semantics of the program, the set of all reachable states from $I$ is :
> $$
> \begin{align}
>     \textbf{lfp} F
> \end{align}
> $$

> **Def 4.2 (Semantic domain and semantic function)**
>
> We call:
> - $F$ : concrete **semantic function**
> - $({\Large\wp}(\mathbb{S}), \subseteq)$ : **concrete semantic domain** or **concrete domain**
