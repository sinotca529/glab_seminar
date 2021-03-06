# Abstract semantics as Abstract State Transitions

## Steps
1. Define concrete domain & concrete semantic function.
2. Define abstract domain.
3. Define abstract semantic function.

## [1/3] Define concrete domain & concrete semantic function.
A concrete semantic domain $\mathbb{D}$ is:
$$
\begin{align}
    \mathbb{D} &= {\Large\wp}(\mathbb{S})\\
    \mathbb{S} &= \mathbb{L} \times \mathbb{M}
\end{align}
$$

where:
- $\mathbb{L}$ : Set of program labels.
- $\mathbb{M}$ : Set of machine states.
- $\mathbb{S}$ : Set of concrete states.


## [2/3] Define abstract domain.
### Program-label-wise reachability
We are interested in the reachable set for each program label (**flow sensitive**).

In this case, we can view the abstraction in two steps:

**[ Step1 ]**
$$
\begin{align}
    \text{collection of all states} & & &\text{label-wise collection}\\
    {\Large\wp}(\mathbb{L} \times \mathbb{M}) &\quad \xrightarrow{\text{abstraction}} & &(\mathbb{L} \rightarrow {\Large\wp}(\mathbb{M}))
\end{align}
$$

**[ Step2 ]**
$$
\begin{align}
    \text{label-wise collection} & & &\text{label-wise abstraction}\\
    (\mathbb{L} \rightarrow {\Large\wp}(\mathbb{M})) &\quad \xrightarrow{\text{abstraction}} & &(\mathbb{L} \rightarrow \mathbb{M}^\sharp)
\end{align}
$$

> **Example (Figure 4.1)**
> $$
> \begin{align*}
>     {\Large\wp}(\mathbb{L} \times \mathbb{M})
>         &\ni \text{collection of all states}
>         && \begin{cases}
>             (0, m_0), (0, m'_0), \cdots, \text{ at } 0\\
>             (1, m_1), (1, m'_1), \cdots, \text{ at } 1\\
>             \quad \vdots\\
>             (n, m_n), (n, m'_n), \cdots, \text{ at } n
>         \end{cases}\\
>     \\
>     \mathbb{L} \rightarrow {\Large\wp}\mathbb{M})
>         &\ni \text{label-wise collection}
>         && \begin{cases}
>             (0, m_0, m'_0, \cdots)\\
>             (1, m_1, m'_1, \cdots)\\
>             \quad \vdots\\
>             (n, m_n, m'_n, \cdots)
>         \end{cases}\\
>     \\
>     \mathbb{L} \rightarrow \mathbb{M}^\sharp
>         &\ni \text{label-wise abstraction}
>         && \begin{cases}
>             (0, M^\sharp_0)\\
>             (1, M^\sharp_1)\\
>             \quad \vdots\\
>             (n, M^\sharp_n)
>         \end{cases}
> \end{align*}
> $$


We define abstract domain $\mathbb{S}^\sharp$:
$$
\begin{align}
    \mathbb{S}^\sharp = (\mathbb{L} \rightarrow \mathbb{M}^\sharp)
\end{align}
$$

> **[Note]**
> - The way to design $\mathbb{M}^\sharp$ is depending on the target properties to compute.
> - An element of ${\Large\wp}(\mathbb{L} \times \mathbb{M}^\sharp)$ is called **graph**

## Notations
Before we continue, we briefly define the notations.

#### Implicit type conversion
- A map $A \rightarrow B$ is interchangeably an element in ${\Large\wp}(A\times B)$
- A relation $f \subseteq A \times B$ is interchangeably a function $g \in A \rightarrow {\Large\wp}(B)$ defined as:
    $$ g(a) = \{ b | (a, b) \in f \} $$

#### New notations
- For functions $f : A \rightarrow B$, we write ${\Large\wp}(f)$ for its powerset version:
    $$
    \begin{align}
        &{\Large\wp}(f) : {\Large\wp}(A) \rightarrow {\Large\wp}(B)\\
        &{\Large\wp}(f)(X) = \{ f(x) | x \in X \}
    \end{align}
    $$

- For functions $f : A \rightarrow {\Large\wp}(B)$, we write $\breve{{\Large\wp}}(f)$ for its powerset version:
    $$
    \begin{align}
        &\breve{{\Large\wp}}(f) : {\Large\wp}(A) \rightarrow {\Large\wp}(B)\\
        &\breve{{\Large\wp}}(f)(X) = \bigcup_{x \in X} f(x)
    \end{align}
    $$
    - ex. $\textit{Step} = \breve{\Large\wp}(\hookrightarrow)$

- For functions $f : A \rightarrow B$ and $g : A' \rightarrow B'$, we write $(f, g)$ for:
    $$
    \begin{align}
        &(f, g) : A \times A' \rightarrow B \times B'\\
        &(f, g)(a, a') = (f(a), g(a'))
    \end{align}
    $$

## [3/3] Define abstract semantic function
### Review: Concrete semantic function $F$
$$
\begin{align}
    &\mathbb{S} = \mathbb{L} \times \mathbb{M}\\
    &F : {\Large\wp}(\mathbb{S}) \rightarrow {\Large\wp}(\mathbb{S})\\
    &F(X) = I \cup \textit{Step}(X)
\end{align}
$$

where:
$$
\begin{align}
    &\textit{Step} = \breve{\Large\wp}(\hookrightarrow)\qquad \text{(relation} \hookrightarrow \text{as a function)}\\
    &\hookrightarrow \quad\subseteq\quad (\mathbb{L} \times \mathbb{M}) \times (\mathbb{L} \times \mathbb{M})
\end{align}
$$

### Define abstract version
$$
\begin{align}
    &\mathbb{S}^\sharp = \mathbb{L} \rightarrow \mathbb{M}^\sharp\\
    &F^\sharp : \mathbb{S}^\sharp \rightarrow \mathbb{S}^\sharp\\
    &F^\sharp(X) = \alpha(I) \cup^\sharp \textit{Step}^\sharp(X^\sharp)
\end{align}
$$

where:
$$
\begin{align}
    &\textit{Step}^\sharp : \mathbb{S}^\sharp \rightarrow \mathbb{S}^\sharp \\
    &\textit{Step}^\sharp = {\Large\wp}((\text{id}, \cup^\sharp_M)) \circ \pi \circ \breve{\Large\wp}(\hookrightarrow^\sharp)\\
    &\hookrightarrow^\sharp \quad\subseteq\quad (\mathbb{L} \times \mathbb{M}^\sharp) \times (\mathbb{L} \times \mathbb{M}^\sharp)
\end{align}
$$

#### Explanation of $\textit{Step}^\sharp = {\Large\wp}((\text{id}, \cup^\sharp_M)) \circ \pi \circ \breve{\Large\wp}(\hookrightarrow^\sharp)$ :
- $\breve{\Large\wp}(\hookrightarrow^\sharp)$ : Compute next states
- $\pi$ : Partition the result by the labels.
    - Result can be convert into $\mathbb{L} \rightarrow {\Large\wp}(M^\sharp)$
- ${\Large\wp}((\text{id}, \cup^\sharp_M))$ : Union machine states.
$$
\begin{align}
    \mathbb{L} \rightarrow \mathbb{M}^\sharp
        &\xrightarrow{\text{implicit convert}}                       && {\Large\wp}(\mathbb{L} \times \mathbb{M}^\sharp)\\
        &\xrightarrow{\quad\breve{\Large\wp}(\hookrightarrow^\sharp)\quad} && {\Large\wp}(\mathbb{L} \times \mathbb{M}^\sharp)\\
        &\xrightarrow{\qquad\pi\qquad}                                 && {\Large\wp}(\mathbb{L} \times {\Large\wp}(M^\sharp))\\
        &\xrightarrow{\ {\Large\wp}((\text{id}, \cup^\sharp_M))\ }   && {\Large\wp}(\mathbb{L} \times \mathbb{M}^\sharp)\\
        &\xrightarrow{\text{implicit convert}}                       && \mathbb{L} \rightarrow \mathbb{M}^\sharp \label{eq:implicit-convert}
\end{align}
$$

> Implicit convert $\eqref{eq:implicit-convert}$ can be done.
> Because the result of ${\Large\wp}((\text{id}, \cup^\sharp_M))$ has exactly one entry for each labels.
