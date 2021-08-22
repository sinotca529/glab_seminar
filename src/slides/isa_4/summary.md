# Summary
## About concrete semantics
Given a program and a target semantic property,

Define
- Memory state : $\mathbb{M}$
- Transition relation : $\hookrightarrow \ (\subseteq \mathbb{S} \times \mathbb{S})$

Then, followings can be derived automatically :
- Labels : $\mathbb{L}$
- Concrete domain : ${\Large\wp}(\mathbb{S}) = {\Large\wp}(\mathbb{L} \times \mathbb{M})$
- Concrete semantic function $F(X) = I \cup \textit{Step}(X)$
- Concrete semantics : $\textbf{lfp}(F)$
- $\textit{Step} = \breve{\Large\wp}(\hookrightarrow)$

## About abstract semantics
Given a program and a target semantic property, after define about concrete semantics,

Define
- Abstract memory state : $\mathbb{M}^\sharp$
- Abstract transition relation : $\hookrightarrow^\sharp \ \subseteq (\mathbb{L}\times\mathbb{M}^\sharp)\times(\mathbb{L}\times\mathbb{M}^\sharp)$
- Abstract union over $\mathbb{S}^\sharp$ : $\cup^\sharp$
- Abstract union over $\mathbb{M}^\sharp$ : $\cup^\sharp_M$

Then, followings can be derived automatically :
- Abstract domain : $\mathbb{S}^\sharp = \mathbb{L} \rightarrow \mathbb{M}^\sharp$
- Abstract semantic function : $F^\sharp(X^\sharp) = \alpha(I) \cup^\sharp \textit{Step}^\sharp(X^\sharp)$
- $\textit{Step}^\sharp = {\Large\wp}((\text{id}, \cup^\sharp_M)) \circ \pi \circ \breve{\Large\wp}(\hookrightarrow^\sharp)$

If the following conditions are satisfied :
- $\mathbb{S}^\sharp$ and $\mathbb{M}^\sharp$ are CPO
- $\mathbb{M}^\sharp$ satisfy:
$$({\Large\wp}(\mathbb{M}), \subseteq) \quad \overset{\gamma_M}{\underset{\alpha_M}{\leftrightarrows}} \quad (\mathbb{M}^\sharp, \sqsubseteq_M)$$
- $\hookrightarrow^\sharp$, $\cup^\sharp$ and $\cup^\sharp_M$ satisfy :
$$
\begin{align*}
    \breve{\Large\wp}(\hookrightarrow) \circ \gamma \subseteq \gamma \circ \breve{\Large\wp}(\hookrightarrow^\sharp)\\
    \cup \circ (\gamma \_ , \gamma \_ ) \subseteq \gamma \_ \circ \cup^\sharp \_ \\
    \cup \circ (\gamma \_ , \gamma \_ ) \subseteq \gamma \_ \circ \cup^\sharp_M \_
\end{align*}
$$

Then, the sound static analysis are defined :
- If $\mathbb{S}^\sharp$ is of finite height (every chain is finite) and $F^\sharp$ is monotone or extensive,
$$\bigsqcup_{i\geq 0} F^{\sharp^i}(\bot)$$

- Otherwise,
$$Y_{\infty} \quad (Y_0 = \bot, Y_{i+1} = Y_i \triangledown F^\sharp(Y_i))$$


> **[Note]**
>
> Many static analysis tools are parametric in the choice of the abstract domains and semantic operators.
> (Practical discussion is in section 6.2)
