# MCFI (WIP)
## Abstract
- 従来のCFIは、分割コンパイルをサポートしていなかった
- MCFIはモジュール毎に個別に計装し、それを静的/動的にリンクできる
    - 計装済みのモジュールをよしなに扱う自作ランタイムを使う
    - ただし、C言語限定
    - coarse grained

## 感想
- 末尾呼び出しに関するCFGの作り方がよくわからない
- 関数ポインタの指し先として認める条件がよくわからない
    - "The function's address is taken in the code." ってなに？
- x86に依存した部分が多いのが気になる
    - 最適化のために仕方ないのはわかるが
- もっとオーバーヘッド減らせる気がする
    - indirect call / inter-proceduralなindirect jumpについて :
        - MCFIは、structurally equivalentな型に、実行のたびに固有の番号を計算して割り当てている（たぶん）
        - 型情報をハッシュして初めから埋めとけば良くないか？
    - return
        - 入力のソースコードをハッシュすればモジュール固有の識別子が作れる気がする
        - ただそれを使おうにもcall graphが動的に生成される(→動的な計算が必要)ので辛い。
        - forwardの保護が完璧なら、戻りアドレスのやり取りをスタックではなくレジスタで行うことでなんとかなるかも

# 1. Introduction
## 従来のCFIについて
- 従来のCFIは計装時にライブラリを含め全モジュールが揃っている必要があった
    - 関数をグループ分けする際のグループ番号(ECN)が一意である必要があるので
- → 各プログラムはそのプログラム専用に計装されたライブラリを使う必要があった
    - DLLが使い回せない

## MCFIについて
- MCFIはアプリを複数のモジュールに分解する（ライブラリ ∈ モジュール）
- 各モジュールは次を含む :
    - code
    - data
    - auxiliary information
        - 他のモジュールとリンクする際に、リンク後のCFGを作るために使う
- control-flow policyがリンク時に変化する
    - つまり、実行時にDLLがロードされると、policyが変化する

## MCFIを実現する上での課題
### マルチスレッド環境下で、安全・効率的にpolicyをアップデートするには？
あるスレッドでコードがロードされpolicyが更新される場合も、他スレッドはpolicyを使ってindirect branchをチェックしたい（更新終わるまで待ちたくない）

- CFGをコード領域とは別の領域に作る
- policyの更新時は、table-checkとtable-updateトランザクションをする
    - これはSoftware Transactional Memory (STM) に着想を得たもの
    - ただSTMは重いので、より軽いMCFIに特化した実装をした

### モジュールの結合時に、高いprecisionで新たなpolicyを作るには？
- モジュールをauxiliary type informationを使って拡張
    - モジュールのコンパイルには、LLVMをに手を加えたものを使う

## 貢献
- MCFIは、マルチスレッドで動く分割コンパイルされたアプリに対する初の効率的なCFI
- type matchingに基づく単純・効率的なC言語に対するCFGの構築。
- x86のC言語に計装をする比較ツールチェーンを作った

# 2. Background: CFI
クラシカルなCFIは次のような感じ。
1. indirect branch targetの集合を*equivalence class (EC)* に分割する。
    - 2つのtargetが同値になる条件は、その2つに飛びうるindirect branch命令が存在すること。
    - あるindirect branchは、特定のECに属する全てのtargetに飛んで良いとみなす。
    - もし2つのindirect branchが指すtargetの集合に共通部分があるなら、その2集合はマージして、1つのECにする。
        - これが原因でprecisionが下がる
2. 各ECに一意の番号 *Equivalence-Class Number (ECN)* を振る
    - address's ECN : そのアドレスが属するECの番号
    - branch ECN : branchの飛び先として許されるECの番号
    - target ECN : 実行時の実際の飛び先が属するECの番号
3. 動的にチェックするコードを計装する
    - CFI policyにおいては、branch ECNとtarget ECNが一致することが求められる
    - (A) ECNは書き込みのできないコードセクションに埋め込まれる
    - (B) しかし、分割コンパイルする際も、アプリ全体でECNがユニークである必要がある
    - (A), (B)のせいで、分割コンパイルにCFIを適用するのが難しい

## 例
次のコードを考える。
```x86asm
ret ; go to `retaddr:`
```

これは次のように計装される。
```x86asm
    ; 戻り先をpop
    popq %rcx

    ; 第1オペランド`$ECN`    : branch ECN
    ; 第2オペランド`4(%rcx)` : target ECN
    ; branch ECN と target ECN が一致しないなら、エラー
    cmpl $ECN, 4(%rcx)
    jne  error

    ; branch ECN と target ECN が一致するなら、ジャンプ
    jmpq *%rcx # go to `retaddr:`

retaddr:
    ; 副作用のない形でretaddrの address's ECN を埋め込む
    ; 副作用さえなければ、`prefetchnta`命令でなくても良い
    prefetchnta ECN
```

# 3. Related Work
CFGのprecisionの観点から

## Fine-grained CFI
- 各indirect branchは固有の、CFG由来の指し先の集合を持つ
### HyperSafe
- 各indirect branchが飛びうるアドレスを持つテーブルを静的に作り、実行時に変更できない場所に置く
- プログラムは、飛び先アドレスを直接使うのではなく、テーブルを参照する形で飛び先アドレスを得るよう改変される
- クラシカルなCFIより精度が良い (多分ECのマージをしないから)
- プログラム全体の解析が必要なので、分割コンパイルに非対応
### WIT's CFI
- color tableを使う
    - <note>ECNとの違いは？名前だけ？</note>
- 各indirect callに静的に色をつける
- indirect callが指しうる関数には、そのcallと同じ色をつける
- MCFIのtableに似ているが、WITはプログラム全体を解析する必要がある
- DLL非対応
### MoCFI (ARM用)
- indirect branchは外部のCFG validation moduleの恩恵を得られるよう計装される
- DLL非対応
### CFR (ARM用)
- 各indirect branchについて、飛んで良い先を走査
- DLL非対応

## Coarse-grained CFI
- 飛び先として許すものを広めに取る
    - e.g. 飛び先がなんかしらの関数ならOK
- オーバーヘッドが少ない
- 分割コンパイルに対応している

### PittSFIeld, NaCl
- コードを固定長のチャンクに区切る
- 計装により、indirect branchesが飛び先として特定のチャンクしか取れないようにする
### MIP
- チャンクを可変長に拡張
- 各チャンクは内部にindirect branchを持たない
    - お尻には持つ（はず）。 ベーシックブロックみたいな感じかと。
- 計装により、indirect branchが飛び先としてチャンクの先頭しか取れないようにする
### CCFIR
- indirect branchを全て、新たなspringboard code regionに飛ばす
- springboard regionでゴニョゴニョする
### binCFI
- indirect branchを全て、外部ルーチンへのdirect branchに置き換える
- 外部ルーチンは、許可された飛び先が格納されたアドレステーブルをチェック

# 4. MCFI Overview
## Threat model
CFI's concurrent attacker modelを使う
- user threadとconcurrentに動くthreadから攻撃が行われることを考える
- 攻撃者はuser thread内の任意の2命令の間でメモリを上書きできる
    - ただし、memory page protectionで許可された場所のみ
- 攻撃者はレジスタを直接上書きできない
    - ただし、レジスタに読み込まれるメモリを弄ることで、間接的には上書きできる
- メモリ領域がwritableかつexecutableになることはない
    - 任意コード実行を防ぐ目的
    - trusted MCFI runtimeでアプリがロードされるとこれが保証されるように作る

## ID tables
global uniqueness requirementを満たすため、ECNはコードセクションではなく、実行時のデータ構造(ID table)として持つ
- Branch ID table (Bary table) : `Map<indirect-branchのアドレス, branchID>`
- Target ID table (Tary table) : `Map<アドレス, targetID>`

IDをコードから分離する利点 :
1. テーブル内のIDがコードセクションの番号と重複できるので、従来のCFIにおけるグローバルIDの一意性の仮定が不要になる(?)
2. indirect branchのチェックが、プロセス固有のID tablesによってパラメタ化される
    - DLLのcode領域は汚れないので、プロセス間でDLLを共有できる
3. IDテーブルが空間的に集中しているため、キャッシュ効果などが良い

## Table access transactions
- あるスレッドがindirect branchのチェックをしている最中に、別のスレッドがモジュールをロード(→ ID tablesの更新が起こる)するかも。
- 変更途中のテーブルが見えてしまうと、変な飛び先が許可されてしまうので良くない
- ロックを使うのも一つの手だが、オーバーヘッドがかさむ
    - 動的リンクはindirect branchより圧倒的に頻度が少ない
    - のに、indirect branchのチェックのたびにロックを取るのは重い
- そこで、STMを応用する

2種類のトランザクションを使う
1. Check transaction : `TxCheck`
    - indirect branchの前に実行される
    - indirect branchのあるアドレスと、飛び先のアドレスを元に、branch ID と target IDをテーブルから読んで比較する
    - テーブルには読みアクセスしかしない
2. Update transaction : `TxUpdate`
    - 動的リンク時に実行される
    - ライブラリのリンク後に作られた新たなCFGにおける新たなIDをつかってテーブルを更新する

## Module linking
- MCFIモジュールはauxiliary informationを持っている
- そこに含める情報が多いほど、より良いprecisionが得られる
- 関数や関数ポインタの型を表すtype informationもあるよ

# ID Tables and Transactions
x86-32/x86-64向けの解説するけど、ARM同じ要領でいけるはず。

## 5.1 ID Tables
### IDのフォーマット
- IDは4Byte長
- 4Byte境界に置く
    - read/writeがアトミックになるように
    - <note>2回かかってしまうとその合間に攻撃されかねないからだと思う</note>
- valid ID : 各ByteのLSBが上位Byteから順に 0,0,0,1 になっているもの
- ECNはクラシカルなCFIと同じ
    - $2^{14} = 16384$種まで扱える（これだけあれば十分とのこと）
- Versionはトランザクションを扱うためのもの
    - `TxCheck`はこれを使って、indirect branchのチェックをやり直すか判断

```
            ECN                       Version
/                          \ /                         \
+---------+---+---------+---+---------+---+---------+---+
|         : 0 |         : 0 |         : 0 |         : 1 |
+---------+---+---------+---+---------+---+---------+---+
        Higher 2 Bytes            Lower 2 Bytes         ↑ 4-byte aligned
```

### Bary, Tary テーブルについて
頻繁に使われるので、アクセスが軽いデータ構造が良い。

Hash mapは空間効率は良いが時間効率に難あり。
- hashに時間かかるし、衝突したらさらなる演算が必要

BaryもTaryも配列を使うことにした。

#### Taryテーブル
- target IDの配列
- インデックスはindirect branch命令のあるアドレス
- indirect-branch targetになり得ないエントリはゼロ埋め

空間効率性を上げるために工夫する。
- IDは4Byteなので、愚直にやるとコード領域の4倍のサイズが必要
- 工夫 : nopを挿入して全ての飛び先を4バイト境界に配置
    - Tary tableのエントリ数は1/4 (= コード領域と同じサイズ)に削減される
- 4バイト境界に無いアドレスでテーブルが引かれるのを検知するために、valid IDの概念を使う

#### Baryテーブル
一度ロードされたら、その命令のアドレスは変化しない。
- そこで、モジュールをロードするときにBaryテーブルの固定のインデックスを埋め込む
    - <note>Taryテーブルではこれ出来ないの？</note>
- この設計ではBaryテーブルは無効なエントリを持たない
- この設計では無効なIDが読まれることもない

### アプリのコードがテーブルに書き込めないよう保護する
- x86-64なら、メモリに書き込む命令に計装して、`[0, 4GB)`までしか書けなくする。別な4GBをテーブルのために使う。
    - その他、x86-64特有の最適化をちょっとやる
    - <note>4GB以上のメモリアクセスが必要なアプリは動かなくなるはず。</note>

## 5.2 Table Transactions
### Update transaction
前提 : 次の関数があるとする。
- `getBaryECN(IndirectBranchOpAddr) -> BranchECN`
    - branchの飛び先として許される（新たな）ECの番号を返す
    - 対応するECNが無い場合は負値を返す
        - <note>使えるECNの数が半分になりません...?</note>
- `getTaryECN(TargetAddr) -> ECN`
    - branchの飛び先になりうる箇所のアドレスについて、それが属す（新たな）ECの番号を返す
    - 対応するECNがない場合は負値を返す
        - <note>使えるECNの数が半分になりません...?</note>

```c
void TxUpdate() {
    // - 複数のスレッドで同時に動的リンクが起きても問題ないようロックを取る
    // - 動的リンクは稀なので、排他制御してもオーバーヘッドは実用上かさまない
    // - ロック取得中でもTxCheckは実行できる
    acquire(updLock);
    globalVersion += 1;

    // テーブルの更新はインターリーブさせてはならない
    // もしインターリーブすると
    // - TaryとBaryの両方において、古いIDと新しいIDが混在する状態が生まれる
    // - TxCheckにおいて、異なるindirect branchに対してバージョンの違うIDが使われてしまう
    // (何が困るの???)
    updTaryTable();
    sfence;
    updBaryTable();

    release(updLock);
}

void updTaryTable() {
    // alloc a table and init to zero
    allocateAndInit(newTbl);

    for (addr = codeBase; addr < CodeLimit; addr += 4) {
        ecn = getTaryECN(addr);
        if (ecn >= 0) {
            entry = (addr - CodeBase) / 4;
            newTbl[entry] = 0x1; // init reserved bits
            setECNAndVer(newTbl, entry, ecn, globalVersion);
        }
    }

    // ここは最適化のしどころ。
    // 各IDの更新がatomicでさえあれば良い
    copyTaryTable(newTbl, TaryTableBase);

    free(newTbl);
}
```

### Check transactions
- アセンブリで書いてゴリゴリ最適化
- 当然、プラットフォーム依存
- return, indirect jump, indirect call で実装違う


returnの場合 :
```x86asm
TxCheck {
    # ここで飛び先をレジスタに退避することで、チェック中に不正操作された場合の影響をなくす
    popq %rcx
    # %rcxの上位32bitをゼロ埋め
    # これにより、飛び先は [0, 4GB)の範囲に制限される
    movl %ecx, %ecx
Try:
    # Baryテーブルを引いて、結果（branch ID）を%ediに (これは常に valid ID)
    movl %gs:ConstBaryIndex, %edi
    # Taryテーブルを引いて、結果(target ID)を%esiに (これは invalid IDになりうる)
    movl %gs:(%rcx), %esi
    cmpl %edi, %esi
    jne  Check
    jmpq *%rcx

# - target ID が invalid IDの場合
# - target IDとbranch IDのバージョンが違う場合
Check:
    # %silは%esiのLSB。invalid IDの検知をしている。
    testb $1, %sil
    jz    Halt
    # バージョンが違う場合は初めからやり直し。
    cmpw  %di, %si
    jne   Try
Halt:
    hlt
}
```

### Linearizability
???

### The ABA Problem
- IDはバージョンとして、$2^{14}$通りしか扱えない
- 攻撃者が$2^{14}$個以上のモジュールをロードさせてくるかも
- とはいえ、問題が起こるのは`TxCheck`の最中に$2^{14}$回ロードが起こるときのみ
- 対策したいならすることもできる
    - さらなるチェック機構を入れるとか
    - バージョンに当てるビット数を増やすとか

### Procedure Linkage Table (PLT)
PLTとGOTの概念は、PBAに載ってる
- GOTのエントリの更新（ライブラリ関数のアドレスの解決）は、`sfence`と`updTaryTable`の間に行われる。
    - 追加のメモリバリアもつける
- PLT内部のindirect jumpも検査が必要。
    - その飛び先は`TxUpdate`によって動的に変化する
    - ので、トランザクションを再試行する際は、target addressをリロードする必要がある
        - 上の`TxUpdate`は`Try`に戻るのでtarget addressがリロードされない

# 6. Module Linking
- リンク時にCFGを再構築するための付加情報(auxiliary information)は、precisionとefficiencyのトレードオフがある
- MCFIは、付加情報として、関数・関数ポインタの型を使う
    - coarse-grained CFGよりprecise
    - モジュールごとの型情報はコンパイラを少し弄れば生成できる

## Type-matching CFG generation
注意点 :
- モジュールは、より小さなモジュールをリンクして作られたものかもしれない
- **C言語製のモジュールしか考えていない**
    - C++言語に対応するには、exceptionとか動的ディスパッチを考慮する必要あり

### `*τ`型の関数ポインタ由来のindirect call
次を両方満たすものを、飛び先として許可
- The function's address is taken in the code.
- 飛び先の関数の型`τ'`が、`τ`と構造的に等しい(structurally equivalent) 。
    - <note>構造体の名前が違っても、メンバの型と順序が同じなら、同じとみなされるということか？</note>
    - structurally equivalent ruleはCコードを一部破壊する

### intra-proceduralなindirect jump
- LLVMがswitchやindirect gotoをコンパイルする際に使われる
- 飛び先はハードコードされた読み専用のジャンプテーブルから構成される
- 静的に解析できる
### inter-proceduralなindirect jump
- indirect tail callに使われる（→末尾呼び出し最適化）
- 飛び先の関数の型`τ'`が、`τ`と構造的に等しい(structurally equivalent) ときだけ許可

### return命令について
- 合法な飛び先を得るためにcall graphを作成

- <note>`call node`ってなんだ？</note>

### ちょっとの例外
- `longjmp`
    - `set jmp`callで飛び先が決定される
    - C言語のライブラリ関数らしい。
    - 対策済みっぽい
- 可変長引数を持つ関数
    - `*τ = int (*)(int, ...)`のとき、whose address is takenで、返り値と第1引数がintな関数は全部許可
- シグナルハンドラはアプリのコードにreturnしない
    - システムコールはアプリへreturnする代わりに、`sigreturn`システムコールを呼ぶ小さなcode snippetへreturnする
    - code snippetをインライン化することで、この問題に対応した
- インラインasm
    - インラインasm中の関数ポインタと関数には手でアノテーションを付ける必要がある

### Conditions for type-matching CFG generation
入力のCプログラムは、事前処理され、以下を満たしているとする
#### C1 関数ポインタへの/からのキャストが明示・暗黙を問わずない
関数ポインタ型を含むunionも禁止。関数ポインタを含むstructへのキャストも禁止。

<note>
関数ポインタ「から」のキャストは許して良くないか？
</note>

ただし、一部例外は許可。
- Upcast (UC)
    - C言語で継承や多態を頑張って書くときに使われる
- Safe downcast (DC)
    - C言語で継承や多態を頑張って書くときに使われる
    - downcastは基本非安全だけど、注意深く書いてあるなら平気
- Malloc and free (MF)
    - `malloc`, `free`は`void*`を受け取るので
- Safe update (SU)
    - ポインタに`NULL`を代入するのはあるある(`int`からポインタへのキャスト発生)
- Non-function-pointer access (SU)
    - `if (((XPVLV*)(sv->sv_any))->xlv_targlen)`
    - みたいな感じで、キャストして関数ポインタに関係ない部分だけ読むのはセーフ

これらを排除した上で、偽陽性になりうるは次の2パターン。
- K1 関数ポインタが、互換性のない関数を指すポインタで初期化される
    - 形が揃うよう修正を加えないと、CFGの構築時に必要なエッジが貼られなくなる
    - ラッパとか書いて頑張るらしい（よくわからない）
    - 初期化された後、使われない(dead code)ものも存在
- K2 関数ポインタが一度別の型にキャストされた後、元の型に再度キャストされてからindirect callする
    - indirect call時には適切な型に戻っているので、修正の必要なし

#### C2 アセンブリがない
- これを破る際は、手でアノテーションを付ける必要がある

### Static and dynamic linking
静的リンク
- auxiliary informationの結合をする
- MCFI用に計装されたPLTエントリを作る

動的リンク
- MCFIの動的リンカ・CFG生成器・ランタイムで処理される
- 動的リンカそのものも、他のモジュールと同じく計装を施す
- どのモジュールがロードされるよりも前に、動的リンカがロードされる

お仕事：
1. Module preparation
2. New CFG generation
3. ID table updates

# 7. MCFI's Toolchain
x86-32/64 Linux向けのtoolchainを作りました。

## toolchainの構成要素
### rewriter
計装をする
- LLVM compilation framework (ver 3.3)の内部に実装
- C++で約4000行
- 3つのpassをLLVMのバックエンドに挿入 (全てマシン依存。LLVM IRレベルのパス終了後。)
    - TxCheck用のscratch registerをreserveする用
    - 型情報をdumpする用
    - 計装する用

### static linker
モジュールの結合と、計装されたPLT entryを作る
- Linuxの標準静的リンカ(`ld`)に手を加えた

### CFG generator
- C++で500行
- module auxiliary information を使って、Bary, Taryテーブルを作成
- auxiliary module informationを集めてCFGを作る
- type-baseなアプローチにすることで高速化を実現

### verifier
checks whether an MCFI module is instrumented to respect its CFG. (?)
- C++で約4000行
- LLVM instruction decoder上に作った
- MCFIモジュールを受け取り、ディスアセンブルして次を確認 :
    - indirect branchが正しく計装されているか
    - memory writeがsandbox内にとどまっているか（テーブルが保護されているか）
    - indirect-branch targetが4Byte境界にアライメントされているか
- auxiliary type informationがあるおかげで、完璧なディスアセンブルができる
- trusted computing baseの外にあるrewriterを削除する

<note>verifier必要？</note>

### runtime system
計装されたプログラムをロード・実行する
- MIP runtimeに200行程度変更を加えて実装
- CFG generatorを呼んでテーブルを作らせる
- モジュールが直接システムコールを呼ぶのを禁止
    - 代わりにシステムコールのラッパを作り、引数をチェック
    - e.g. `mmap`や`mprotect`を監視して、writableかつexecutableなメモリが確保されないか監視
    - 本質的にはNaClがやってるような感じ
- 使いやすくするために、MIPのように工夫したらしい(?)

### dynamic linker
ランタイムから呼ばれる
- ライブラリを動的にロードする
- MUSLのリンカに手を加えた

# 8. Evaluation
## 8.1 Overhead
### 計装由来のオーバーヘッド
### code update由来のオーバーヘッド
### メモリ使用量のオーバーヘッド
+17%
### MCFIのトランザクションのアルゴリズムの評価


## 8.2 CFG Generation
## 8.3 Security
# 9. Conclusions
- MCFIは分割コンパイルに対応したCFI
- ライブラリが動的にリンクされると、MCFIのランタイムが新しいCFGを元にIDテーブルを更新
- CFGはtype-matching approachを使って生成する
- スレッド安全のために、テーブルへの走査はトランザクションとして行われる
- 他のCFIに比べて効率的で防御力も強い
