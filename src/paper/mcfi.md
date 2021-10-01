# MCFI (WIP)
**Abstract**

- 従来のCFIは、分割コンパイルをサポートしていなかった
- MCFIはモジュール毎に個別に計装し、それを静的/動的にリンクできる

# 1. Introduction
## 従来のCFIについて
- 従来のCFIは計装時に、ライブラリを含めたすべてのモジュールが揃っている必要があった
- つまり、各プログラムは、それ用に軽装されたライブラリを使う必要があった
- これはDLLの、使い回せるという利点を駄目にするもの

## MCFIについて
- MCFIはアプリを複数のモジュールに分解する（ライブラリ ∈ モジュール）
- 各モジュールは次を含む :
    - code
    - data
    - auxiliary information (他のモジュールとリンクする際に、モジュールのCFGを作るために使う)
- control-flow policyがリンク時に変化する
    - つまり、実行時にDLLがロードされると、policyが変化する

## MCFIを実現する上での課題
1. マルチスレッド環境下で、安全・効率的にpolicyをアップデートする方法
    - あるスレッドでコードがロードされpolicyが更新される場合も、他スレッドは更新前のpolicyを使い続けたい
2. モジュールの結合時に、高いprecisionで新たなpolicyを作る方法

## マルチスレッド環境下で、安全・効率的にpolicyをアップデートする方法について
- CFGをコード領域とは別の領域に作る
- policyの更新時は、table-checkとtable-updateトランザクションをする
    - これはSoftware Transactional Memory (STM) に着想を得たもの
    - ただSTMは重いので、より軽いMCFIに特化した実装をした

## モジュールの結合時に、高いprecisionで新たなpolicyを作る方法について
- モジュールをauxiliary type informationを使って拡張
    - モジュールのコンパイルには、LLVMをに手を加えたものを使う

## 貢献
- MCFIは、マルチスレッドで動く分割コンパイルされたアプリに対する初の効率的なCFI
- type matchingに基づく単純・効率的なC言語に対するCFGの構築。
- x86のC言語に計装をする比較ツールチェーンを作った

# 2. Background: CFI
CFIの肝は、いかにindirect branchを計装するか。
1. indirect branch targetの集合を*equivalence class*に分割する。
    - 2つのtargetが同値になる条件は、その2つに飛びうるindirect branch命令が存在すること。
    - あるindirect branchは、同じequivalence classに属するtargetならどこでも飛んで良いとみなす
    - もし2つのindirect branchが指すtargetの集合に共通部分があるなら、その2集合はマージして、1つのequivalence classにする。
        - これが原因でprecisionが下がる
2. 各equivalence classにユニークに番号を振る (ECN : Equivalence-Class Number)
    - address's ECN : そのアドレスが属するequivalent classの番号
    - branch ECN : branchの飛び先として許されるequivalent classの番号
    - target ECN : 実行時のある状態において、実際の飛び先が属するequivalent classの番号
3. 動的にチェックするコードを計装する
    - CFI policyにおいては、branch ECNとtarget ECNが一致することが求められる
    - (A) ECNは書き込みのできないコードセクションに埋め込まれる
    - (B) しかし、分割コンパイルする際も、アプリ全体でECNがユニークである必要がある
    - (A), (B)のせいで、分割コンパイルにCFIを適用するのが難しい

```x86asm
ret # go to `retaddr:`
```

```x86asm
    # Pop the return addr
    popq %rcx

    # 第1オペランド`$ECN`    : branch ECN
    # 第2オペランド`4(%rcx)` : target ECN
    # branch ECN と target ECN が一致しないなら、エラー
    cmpl $ECN, 4(%rcx)
    jne  error

    # branch ECN と target ECN が一致するなら、ジャンプ
    jmpq *%rcx # go to `retaddr:`

retaddr:
    # 副作用のない形でretaddrの address's ECN を埋め込む
    # 副作用さえなければ、`prefetchnta`命令でなくても良い
    prefetchnta ECN
```

# 3. Related Work
CFGのprecisionの観点から

## Fine-grained CFI
- 各indirect branchは固有の、CFG由来の指し先の集合を持つ
### HyperSafe
- 各indirect branchが飛びうるアドレスを持つテーブルを静的に作り、実行時に変更できない場所に置く
- プログラムは、飛び先アドレスを直接使うのではなく、テーブルを参照する形で飛び先アドレスを得るよう改変される
- 上の例のようなCFIより精度が良い (多分ECのマージをしないから)
- プログラム全体の解析が必要なので、分割コンパイルに非対応
### WIT's CFI
- color tableを使う (疑問 : ECNと何が違うの？)
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
    - お尻には持つ（はず）
    - ベーシックブロックみたいな感じ
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
- 攻撃者は任意の2命令の間でメモリを上書きできる
    - ただし、memory page protectionの範囲で
- 攻撃者はレジスタを直接上書きできない
    - ただし、レジスタに読み込まれるメモリを弄ることで、間接的には上書きできる
- メモリ領域がwritableかつexecutableになることはない
    - 任意コード実行を防ぐ目的
    - trusted MCFI runtimeでアプリがロードされるとこれが保証される（ように作る）

## ID tables
global uniqueness requirementを満たすため、ECNはコードセクションではなく、実行時のデータ構造(ID table)として持つ
- Branch ID table (Bary table) : `Map<indirect-branchのアドレス, 飛び先として許すbranchのID>`
- Target ID table (Tary table) : `Map<アドレス, そのアドレスが属しているECのID>`

IDをコードから分離する利点 :
1. テーブル内のIDがコードセクションの番号と重複できるので、従来のCFIにおけるグローバルIDの一意性の仮定が不要になる(?)
2. indirect branchのチェックがID tablesによってパラメタ化され、一度ロードされたらそれが保たれる
    - よって、アプリケーションやライブラリのコードページをプロセス間で共有することができ、メモリやアプリケーションの起動時間を節約できる(?)
3. IDテーブルが集中しているため、メモリキャッシュ効果が高く、CPUの並列メモリコピー機構を利用してテーブルを高速に更新することができる

## Table access transactions
- あるスレッドがindirect branchのチェックをしている最中に、別のスレッドがモジュールをロード(→ ID tablesの更新が起こる)するかも。
- 変更途中のテーブルが見えてしまうと、変な飛び先が許可されてしまうので良くない
- ロックを使うのも一つの手だが、オーバーヘッドがかさむ
    - 動的リンクはindirect branchより圧倒的に頻度が少ない
    - のに、indirect branchのチェックのたびにロックを取るのは重い
- そこで、STMを応用する

2種類のトランザクションを使う
1. Check transaction (TxCheck)
    - indirect branchの前に実行される
    - indirect branchのあるアドレスと、飛び先のアドレスを元に、branch ID と target IDをテーブルから読んで比較する
    - テーブルには読みアクセスしかしない
2. Update transaction (TxUpdate)
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
    - readが1回のメモリアクセスで済むように
    - 2回かかってしまうとその合間に攻撃されかねないから(だと思う)
- valid ID : 各ByteのLSBが上位Byteから順に 0,0,0,1 になっているもの
    - なんでこれがいるの？
- ECNはクラシカルなCFIと同じ
    - $2^{14} = 16384$種まで扱える（これだけあれば十分とのこと）
- Versionはトランザクションを扱うためのもの
    - TxCheckはこれを使って、abort and retryをするか判断する

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
- `Map<アドレス, そのアドレスが属しているECのID>`
- indirect-branch targetになり得ないエントリはゼロ埋め

空間効率性を上げるために工夫する。
- IDは4Byteなので、愚直にやると1つのテーブルを作るのにコード領域の4倍のサイズが必要
- 工夫 : nopを挿入して全ての飛び先を4バイト境界に配置
    - Tary tableのエントリ数は1/4 (= コード領域と同じサイズ)に削減される
- 4バイト境界に無いアドレスでテーブルが引かれるのを検知するために、valid IDの概念を使う

#### Baryテーブル
一度ロードされたら、その命令のアドレスは変化しない。
- そこで、モジュールをロードするときにBaryテーブルの固定のインデックスを埋め込む
- この設計ではBaryテーブルは無効なエントリを持たない
- この設計では無効なIDが読まれることもない

### アプリのコードがテーブルに書き込めないよう保護する
- x86-64なら、メモリに書き込む命令に軽装して、$[0, 4GB)$までしか書けなくする。別な4GBをテーブルのために使う。
    - その他、x86-64特有の最適化をちょっとやる
    - 仮想メモリがうまいことやってくれるはずなので、8GB消費するなんてことにはならなそう
    - ただ、4GB以上のメモリアクセスが必要なアプリは動かなくなるはず。

## 5.2 Table Transactions
### Update transaction
前提 : 次の関数があるとする。
- `getBaryECN(IndirectBranchOpAddr) -> BranchECN`
    - branchの飛び先として許される（新たな）ECの番号を返す
    - 対応するECNが無い場合は負値を返す
        - 使えるECNの数が半分になりません...?
- `getTaryECN(TargetAddr) -> ECN`
    - branchの飛び先になりうる箇所のアドレスについて、それが属すECの番号を返す
    - 対応するECNがない場合は負値を返す

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


# 6. Module Linking
# 7. MCFI's Toolchain
# 8. Evaluation
## 8.1 Overhead
## 8.2 CFG Generation
## 8.3 Security
# 9. Conclusions
