
# [MCFI \[Niu+ PLDI'14\]](https://dl.acm.org/doi/10.1145/2594291.2594295)
- 目的
    - 分割コンパイル(主に動的リンク)を扱えるCFIの作成
- 既存手法の問題点
    - 既存手法はCFGを静的に計算するため，動的リンクをうまく扱えない
    - そのため，分割コンパイルされたプログラムにCFIを(効率よく)適用できない
- 提案手法
    - 各モジュールにメタデータを持たせ，リンク時にCFGを動的に構築・更新することで，分割コンパイルに対応する
- 結果
    - 実行時間 : 平均+7% (動的リンクの頻度が毎秒50回と仮定)
    - コード量 : 平均+17%
    - メモリ使用量 : 無視できる程度の増加
    - 防御力
        - ROP-gadget攻撃の95.75%を防げる
        - 飛び先の候補を保護なしに比べて99.99%減らせる

# 背景知識
## CFIとは
- CFI : Control Flow Integrity
- control-flow hijackingなどの制御フローを不正に操作する攻撃からプログラムを守る手段の一つ

基本的な手順 (この手順に沿わないCFIもある) :
1. 実行前に，保護対象のControl-Flow Graph (CFG) を求める
2. 実行時に，プログラムがそのCFGに沿って動いているかチェックする
    - indirect jmp/call, return命令の遷移先をチェックする

## クラシカルなCFIの手順
1. Indirect Branch Target (IBT) の集合を Equivalence Class (EC) に分割
2. 各ECに一意の番号 Equivalence-Class Number (ECN) を振る
3. ECNをもとにIBTを実行時にチェックするためのコードを計装する

### 1. IBTの集合をECに分割
ECの満たすべき性質 :
- indirect branch (ibranch) が指しうるtargetは全て同じECに属する
- ECは共通部分を持たない
    - この性質が原因でprecisionが下がる (後述)

<note>
(indirect branch) = (indirect jmp) + (indirect call) + (return)
</note>

#### 例 (ここではindirect callに着目)
`rand`の中身までは解析で追わないものとする

<div class="slider-001">
    <div class="slide-001"><div class="slide-content-001"><img src="fig/classic_cfi_ecn_gen/1.dio.svg"></div></div>
    <div class="slide-001"><div class="slide-content-001"><img src="fig/classic_cfi_ecn_gen/2.dio.svg"></div></div>
    <div class="slide-001"><div class="slide-content-001"><img src="fig/classic_cfi_ecn_gen/3.dio.svg"></div></div>
    <div class="slide-001"><div class="slide-content-001"><img src="fig/classic_cfi_ecn_gen/4.dio.svg"></div></div>
    <div class="slide-001"><div class="slide-content-001"><img src="fig/classic_cfi_ecn_gen/5.dio.svg"></div></div>
</div>

### 2. 各ECに一意の番号ECNを割り振る
用語の定義 :
- **Address ECN**
    - ibranch命令の飛び先になりうるアドレスについて，そのアドレスが属するECの番号
- **Branch ECN**
    - ibranch命令について，その飛び先として許されるECの番号
- **Target ECN**
    - ibranch命令について，実行時の実際の飛び先が属するECの番号

![](fig/classic_cfi_ecn_gen/6.dio.svg)

### 3. ECNをもとにIBTを動的にチェックするコードを計装
- branch ECNとtarget ECNが一致しない場合のみ，不正な実行とみなす

![](fig/classic_cfi_ecn_gen/7.dio.svg)

<question>

`p()`で`baz`が呼ばれた場合，このCFIで検知できるか？
<details>
<summary>Ans.</summary>
できない．
</details>
</question>



#### 計装コードの例
次の`ret`を計装する．
```x86asm
    ...
    ; `retaddr`へ飛ぶと仮定
    ret

retaddr:
    ...
```

これは次のように計装される．
```x86asm
    ...
    ; 戻り先をrcxに退避
    popq %rcx

    ; 実際はBRANCH_ECN1に適当な即値が埋め込まれる
    ; branch ECN　[$ECN] と target ECN [4(%rcx)] が異なるなら，エラー
    cmpl $BRANCH_ECN1, 4(%rcx)
    jne  error

    ; branch ECN と target ECN が同じなら，`retaddr`へジャンプ
    jmpq *%rcx

retaddr:
    ; 副作用のない形でretaddrの address ECN を埋め込む
    ; 副作用がなければ，`prefetchnta`命令でなくても良い（はず）
    prefetchnta ADDR_ECN1
    ...

illegaladdr:
    prefetchnta ADDR_ECN2
```

## クラシカルなCFIの欠点
動的リンクに対応できない．

### 動的リンクがない場合 @ indirect call
次のような保護がなされていた．
![](fig/compare_cfi/classic_cfi.dio.svg)

### 動的リンクがある場合 @ indirect call
- `FN_FOO`と`FN_BAR`のaddress ECNに着目する
- ECNはコードセクション（書き込み不可）に埋め込まれる

![](fig/compare_cfi/classic_cfi_dso.dio.svg)

#### **`b.out`に合わせ，`FN_FOO`と`FN_BAR`に異なるECNを振る場合**
- `a.out`で`FN_BAR`への`call`が違法判定される (FP)

![](fig/compare_cfi/classic_cfi_dso_b.dio.svg)


#### **`a.out`に合わせ，`FN_FOO`と`FN_BAR`に異なるECNを振る場合**
- `b.out`で`FN_BAR`への`call`が合法判定される (FN)
    - 精度が落ちている

![](fig/compare_cfi/classic_cfi_dso_a.dio.svg)

- いかなるプログラムに対してもFPを出してはならないので，CFIの防御力が著しく下がる


<note>

クラシカルなCFIでの対処法 :
- 各ソフトウェアが，それ専用の計装が施された共有ライブラリを使う
    - 「専用」なので共有できない
    - 共有ライブラリの「共有できる」という利点がなくなってしまう

</note>

# MCFIの概要
## 目的
分割コンパイルされ，かつマルチスレッドで動くアプリに対応したCFIの提案

## Threat model
### 攻撃者のモデル : concurrent attacker model
攻撃者は，
- 攻撃対象とconcurrentに動くスレッドから攻撃する
- 攻撃対象の任意の2命令の間に，任意のメモリを読み書きできる
    - ただし， memory page protection の範囲で
- レジスタを直接操作することはできない
    - レジスタに読まれるメモリを操作することで，間接的にレジスタを操作することはできる

### その他の前提
- メモリはwritableかつexecutableにならない
    - 任意コード実行を防ぐため
    - MCFIの独自ランタイムをうまく設計して，これを保証する

## MCFIの方針
- 各モジュールにCFGを計算するための補助情報(auxiliary information)を持たせる
    - 静的リンク時 : 各モジュールの補助情報を独自の静的リンカで結合する
    - 動的リンク時 : 補助情報を用いて独自の動的リンカでCFGを更新する

- ECNにバージョンの概念を加えた「ID」をIDテーブルで管理する
    - IDテーブルはBaryとTaryの2種類ある

### イメージ図 (実際の実装とは異なる．付加情報は省略．)
![](fig/compare_cfi/mcfi.dio.svg)

## Challenge
### マルチスレッド下で安全・効率的にCFGを更新できるか
IDテーブルが壊れたり，整合性のないIDテーブルがチェックに使われたりしてはならない．

起こりうること :
- CFGの更新中に，別スレッドでibranchのチェックが必要になる (逆も同様)
- CFGの更新中に，別スレッドでもCFGの更新が必要になる

MCFIの手法 :
- CFGをコード領域とは別の領域に作る
- CFGの更新にトランザクションを用いる

### モジュールのリンク時に高いprecisionで新たなCFGを作れるか
MCFIの手法 :
- 関数と関数ポインタの型情報を各モジュールに持たせ，それを元にCFGを構築する

# 提案手法の詳細
## IDのフォーマット
- ID = ECN + バージョン番号
- CFIが動的に更新されるたび，バージョン番号を上げる
- IDは4Byte長であり，4Byte境界に配置する (atomicに操作できる)
- 各ByteのLSBが下から順に(1,0,0,0)のとき，そのIDは有効(valid)とみなす
    - 後でこの概念を使う

```
          ECN                    Version
/                      \ /                     \
+---------+-+---------+-+---------+-+---------+-+
|         :0|         :0|         :0|         :1|
+---------+-+---------+-+---------+-+---------+-+
    Higher 2 Bytes            Lower 2 Bytes     ↑ 4-byte aligned
```

## 用語
Address ID，Branch ID，Target IDは，ECNと同様に定義する．

<question>
各IDの使われ方は？
<details>
<summary>Ans.</summary>

- Address ID
    - ibranch命令の飛び先になりうるアドレスについて，そのアドレスが属するID
- Branch ID
    - ibranchが飛ぶことを許されるID
- Target ID
    - 実行時にibranchの飛び先が属するID
</details>
</question>


## IDテーブルについて
2つのテーブルがある :
- Target ID table (Tary table)
    - `Map<飛び先アドレス, AddressID>`
    - ibranchの飛び先アドレスを用いて，それが属するIDを引く
- Branch ID table (Bary table)
    - ibranchのアドレスから，それのbranch IDを引く
    - `Map<ibranchのアドレス, BranchID>`

<note>

便宜上`Map`と書いたが，アドレスからIDを引ければデータ構造は何でも良い．<br>
高速に引けるという理由で，実装では配列が使われている．

</note>

### Taryテーブルの構造
- `Map<飛び先アドレス, AddressID>`
- IDの配列として表現
- targetになり得ないアドレスに対応するエントリはゼロ埋め

#### テーブルを小さくするための工夫
- 工夫 : nopを挿入して全てのIBTを4バイト境界に配置
    - Tary tableのエントリ数は約1/4に削減される
- 4バイト境界に無いアドレスでテーブルが引かれると...
    - validではないIDが返される
    - → Tary tableを引いた時点で攻撃を検知できる

```
            |   工夫なし                         |      工夫あり
            +------------------------------------+-----------------------------------
Code region |  +----------+---------------+      |     +----------+---------------+
            |  | address  | code          |      |     | address  | code          |
            |  +----------+---------------+      |     +----------+---------------+
            |  | 0b010000 |               |      |     | 0b010000 |               |
            |  | ...      |               |      |     | ...      |               |
            |  | 0b010111 | FN1:          |      |     | 0b010111 | nop; nop; ... |
            |  | ...      |   ...         |      |     | 0b011000 | FN1:          |
            |  |          |               |      |     | ...      |   ...         |
            |  | 0b011111 | FN2:          |      |     | 0b011111 | nop; nop; ... |
            |  | ...      |   ...         |      |     | 0b101100 | FN2:          |
            |  |          |               |      |     | ...      |   ...         |
            |  | 0b110000 |               |      |     |          |               |
            |  +----------+---------------+      |     | 0x111111 |               |
            |                                    |     +----------+---------------+
            +------------------------------------+-----------------------------------
Tary table  |         +---------------+          |          +---------------+
            |  010000 |  0            |          |   010000 |  0            |
            |  010001 |  0            | #Entry:  |   010100 |  0            |  #Entry:
            |    ...  | ...           |   33     |   011000 | FN1's addr id |    12
            |  010111 | FN1's addr id |          |    ...   | ...           |
            |    ...  | ...           |          |   101100 | FN2's addr id |
            |  011111 | FN2's addr id |          |    ...   | ...           |
            |    ...  | ...           |          |   111100 |  0            |
            |  110000 |  0            |          |          +---------------+
            |         +---------------+          |  コード量は増えるが，表のエントリ数は減る
            +------------------------------------+-----------------------------------
```
<note>
工夫ありの場合エントリ数が減るだけでなく，各エントリが4Byteであるため，Tary tableのベースアドレスにIBTのアドレスを足すだけで対応するエントリにアクセスできる．
</note>

### Baryテーブルの構造
- `Map<ibranchのアドレス, BranchID>`
- branch IDの配列として表現

#### テーブルを小さくするための工夫
- プログラムの実行中，ibranch命令のアドレスは変化しない
- → モジュールのロード時に，各ibranchのチェック用コードにBaryテーブルを引くためのインデックスを埋め込める
    - → 無効なエントリは存在せず，エントリ数は最小限

```
ロード前 :
  libfoo.so                                Bary table
  +--------------------------------+       idx  +--------+
  | FN3:                           |        0   |  ID00  |
  |   ...                          |       ...  |  ...   |
  |   ; callq %rax                 |       10   |  ID10  |
  |   branchId = Bary[xxx]         |            +--------+
  |   targetId = Tary[%rax]        |
  |   if (branchID != targetID) {  |
  |   ...                          |
  +--------------------------------+

----------------------------------------------------------------------

ロード後 :
  libfoo.so                                Bary table
  +--------------------------------+       idx  +--------+
  | FN3:                           |        0   |  ID00  |
  |   ...                          |       ...  |  ...   |
  |   ; callq %rax                 |       10   |  ID10  |
  |   branchId = Bary[11]          |       11   |  ID11  |
  |   targetId = Tary[%rax]        |            +--------+
  |   if (branchID != targetID) {  |
  |   ...                          |
  +--------------------------------+

```

## IDテーブルの保護 @x86_64
- IDテーブルは実行時に動的に更新される
- → 書き込み可能なデータとして扱われる
- → テーブルを攻撃者から保護する必要がある

保護の方法
- IDテーブルをアドレス空間[4GB, 8GB)に置く
- プログラム中のメモリwriteについて，[0, 4GB)の範囲しか書き込めないよう計装する

<note>
mallocでたまたまアドレス空間[4GB, 8GB)からメモリが確保されたらどうするのかは不明．
</note>

### イメージ図 (再掲)
![](fig/compare_cfi/mcfi.dio.svg)

### IDテーブルをコード領域から分離する利点
- 従来のCFIはECNをコードに埋め込んでいた
- MCFIはそれをコード領域から分離した

利点 :
- ECNがプロセス固有のID tablesによってパラメタ化される
    - 共有ライブラリのcode領域はECNを持たないので，プロセス間でライブラリを共有できる
    - (共有ライブラリに関するIDとして，プロセスごとに異なる値を使うことができる)

<note>
従来のCFIでは，共有ライブラリを使うプロセスごとに専用の計装をしなければならず，プロセス間で同じライブラリを共有できなかった．
</note>

## IDテーブルの読み取りと更新
- IDテーブル(CFG)の更新中に，別スレッドでibranchのチェックが起こりうる (逆も然り)
    - チェック機構が更新中の表を参照するのはNG
- トランザクションを行うことで予期せぬ動作を防ぐ

1. Update transaction : `TxUpdate`
    - 動的リンク時 (表の更新時) に実行される
    - リンク後の新たなCFGに沿った，新たなIDでテーブルを更新する
2. Check transaction : `TxCheck`
    - ibranchの前に実行される
    - ibranchのあるアドレスと，飛び先のアドレスを元に，branch ID と target IDをテーブルから読んで比較する
    - テーブルには読みアクセスしかしない

### Update transaction
前提 : 次の関数があるとする．
- `getBaryECN(IbranchOpAddr) -> BranchECN`
    - branchの飛び先として許される（新たな）ECNを返す
    - 対応するECNが無い場合は負値を返す
- `getTaryECN(TargetAddr) -> ECN`
    - branchの飛び先になりうる箇所のアドレスについて，それが属す（新たな）ECNを返す
    - 対応するECNがない場合は負値を返す

<note>
負値を返す → IDとして負値を使えなくなるので実際の実装はこれとは違う可能性あり．
</note>

```c
void TxUpdate() {
    // - 複数のスレッドで同時に動的リンクが起きても問題ないようロックを取る
    // - 動的リンクは稀なので，排他制御してもオーバーヘッドは実用上問題ない
    // - ロック取得中でもTxCheckは実行できる
    acquire(updLock);

    globalVersion += 1;

    updateTaryTable();
    sfence;
    updateGOT();
    sfence;
    updateBaryTable();

    release(updLock);
}
```

<!--
void updateTaryTable() {
    // 新しいテーブルを構築するための領域を確保して初期化(ゼロ埋め)
    allocateAndInit(newTbl);

    // 4Byte境界の各アドレスについて，newTblのエントリを埋める
    for (addr = codeBase; addr < CodeLimit; addr += 4) {
        ecn = getTaryECN(addr);
        if (ecn >= 0) {
            entry = (addr - CodeBase) / 4;
            newTbl[entry] = 0x1; // init reserved bits
            setECNAndVer(newTbl, entry, ecn, globalVersion);
        }
    }

    // newTblをTaryTableにコピーする
    // 各エントリがアトミックにコピーされるよう実装する
    copyTaryTable(newTbl, TaryTableBase);

    free(newTbl);
}
-->

<question>
GOTの更新中にIBTのチェックが成功することはない．なぜか？<br>
(Check transactionsの説明後に聞きます)
<details>
<summary>Ans.</summary>
メモリフェンス命令により，Taryの全エントリが更新済みであり，Baryの全エントリが未更新であることが保証される．
したがって，GOT更新中は常にbranch IDとtarget IDのバージョンが異なるのでチェックに成功しない．
</details>
</question>

### Check transactions (`ret`の場合)
```x86asm
TxCheck {
    ; 戻り先をレジスタに退避．
    ; チェック中に戻り先が不正操作された場合の影響をなくす
    popq %rcx
    ; %rcxの上位32bitをゼロ埋め
    ; これにより，飛び先は [0, 4GB)の範囲に制限される
    movl %ecx, %ecx
Try:
    ; Baryテーブルを引いてbranch IDを得る (これは常に valid ID)
    movl %gs:ConstBaryIndex, %edi
    ; Taryテーブルを引いてtarget IDを得る (これは invalid IDになりうる)
    movl %gs:(%rcx), %esi
    cmpl %edi, %esi
    jne  Check
    jmpq *%rcx

; - target ID が invalid IDの場合
; - target IDとbranch IDのバージョンが違う場合
Check:
    ; %silは%esiのLSB．invalid IDの検知をしている．
    testb $1, %sil
    jz    Halt
    ; バージョンが違う場合は初めからやり直し．
    cmpw  %di, %si
    jne   Try
Halt:
    hlt
}
```
<!-- $ // 自前のlatex用の前処理がバグっているのでその対処-->

# Module Linking
動的にCFGを計算するための付加情報として，各モジュールに関数・関数ポインタの型をもたせる

<note>
モジュールに何をもたせるかには，precisionとefficiencyのトレードオフがある．
</note>

## Type-matching CFG generation
C言語のみを考える．

ibranchは次のように分類できる
- indirect call
- indirect jmp
    - (intra-procedural) 関数内でjmpするもの
    - (inter-procedural) 違う関数へとjmpするもの
- return

### `T*`型の関数ポインタ由来のindirect call
次の条件を両方満たすものを，ibranchの合法な飛び先とみなす．
- オペランドとしてコード中に現れる
- 飛び先の関数の型`S`が，`T`と構造的に等しい(structurally equivalent)．
    - 例 :  `struct A {int a; int b}`と`struct B {int c; int d}`
    - これを厳格に当てはめると合法なcall flowが見落とされうるので適当な前処理をする (後述)

### intra-proceduralなindirect jump
- switch文やindirect goto文をコンパイルする際に使われる
- 他のモジュールが関わらないので，静的に解析しきれる

### inter-proceduralなindirect jump
- indirect tail callに使われる（→末尾呼び出し最適化）
- 飛び先の関数の型が，呼ばれるべき関数の型と構造的に等しい(structurally equivalent) ときだけ許可

### return命令
- 合法な飛び先（戻り先）を得るためにcall graphを作成
- direct/indirect call, tail callを考慮して，健全な（合法なエッジの見落としがない）CFGを構築

### その他
- `longjmp`
    - `setjmp`で飛び先が決定される
    - `setjmp`の出現箇所全てを飛び先として許すことで解決
- シグナルハンドラ
    - シグナルハンドラはアプリのコードにreturnしない
    - 代わりに，`sigreturn`システムコールを呼ぶコード片へとreturnする
    - そのコード片をインライン化することで，この問題に対応した
- 可変長引数を持つ関数
    - `T* = int (*)(int, ...)`のとき，返り値と第1引数がintな関数は全部許可
- インラインasm
    - インラインasm中の関数ポインタと関数には手でアノテーションを付ける


### CFGを作る上での前提条件
入力のCプログラムは以下を満たすよう事前処理しておく．

- **(C1) 関数ポインタへの/からのキャストが明示・暗黙を問わずない**
    - 関数ポインタ型を持つunionによって起こるキャストも禁止
    - 関数ポインタを含むstructへのキャストも禁止
- **(C2) インラインアセンブリが無い**
    - 使いたい場合は適切にアノテーションを付ける

<!-- <note>関数ポインタ「から」のキャストは許して良い気がする</note> -->

#### C1に抵触するが，例外的に許すもの
- Upcast (UC)
    - C言語で継承や多態性を表現するときに使われる
- Safe downcast (DC)
    - C言語で継承や多態性を表現するときに使われる
    - downcastは一般に非安全だが，注意深く書いてあれば問題ない
- Malloc and free (MF)
    - (`malloc`/`free`)では`void*`(からの/への)キャストが必要
- Safe update (SU)
    - 関数ポインタに即値を代入する場合
        - 整数型からポインタへのキャストが生じる
        - 例 : ポインタに`NULL`を代入する場合
- Non-function-pointer access (SU)
    - キャストはするが，関数ポインタに関係ない部分のみが使われる場合
        - 例 : `if (((A*)(b->c))->d) {...}`

#### その他の例外
**(K1) 関数ポインタが，互換性のない関数を指すポインタで初期化される場合**

例 : 互換性のない関数をもたせることで多態性を表現
- `long`型の要素を持つ`Set`を考える
    - 要素を比較する関数を指す関数ポインタの型は`int (*)(long, long)`
- この`Set`を，文字列`char*`型の`Set`として使いたい
    - 要素を比較する関数として，型の異なる`strcmp`をセットする

問題点 :
- 関数ポインタとそれが指す関数の型が異なるので，MCFIのCFIでは誤検知(FP)される

対処 :
- ラッパを書いて型を一致させる
```c
int wrap_strcmp(long a, long b) {
    return strcmp((char*)a, (char*)b);
}
```

**(K2) 関数ポインタが一度別の型にキャストされた後，元の型に再度キャストされる**
- indirect call時には適切な型に戻っているので，手を加える必要なし

#### C1/C2に抵触する部分についての表
|SPECCPU2006 | SLOC    | VBE  | UC  | DC  | MF  | SU  | NF  | VAE | K1 | K1-fixed | K2  |
|:-----------|--------:|-----:|----:|----:|----:|----:|----:|----:|---:|---------:|----:|
|perlbench   | 126,345 | 2878 | 510 | 957 | 234 | 633 | 318 | 226 | 4  | 4        | 222 |
|bzip2       | 5,731   | 27   | 0   | 0   | 6   | 4   | 0   | 17  | 0  | 0        | 17  |
|gcc         | 235,884 | 822  | 0   | 0   | 15  | 737 | 27  | 43  | 36 | 22       | 7   |
|mcf         | 1,574   | 0    | 0   | 0   | 0   | 0   | 0   | 0   | -  | -        | -   |
|gobmk       | 157,649 | 0    | 0   | 0   | 0   | 0   | 0   | 0   | -  | -        | -   |
|hmmer       | 20,658  | 20   | 0   | 0   | 20  | 0   | 0   | 0   | -  | -        | -   |
|sjeng       | 10,544  | 0    | 0   | 0   | 0   | 0   | 0   | 0   | -  | -        | -   |
|libquantum  | 2,606   | 1    | 0   | 0   | 0   | 0   | 0   | 1   | 1  | 1        | 0   |
|h264ref     | 36,098  | 8    | 0   | 0   | 8   | 0   | 0   | 0   | -  | -        | -   |
|milc        | 9,575   | 8    | 0   | 0   | 3   | 0   | 0   | 5   | 0  | 0        | 5   |
|lbm         | 904     | 0    | 0   | 0   | 0   | 0   | 0   | 0   | -  | -        | -   |
|sphinx3     | 13,128  | 12   | 0   | 0   | 11  | 1   | 0   | 0   | -  | -        | -   |

- VBE : UC, DCなどのfalse-positiveを処理する前のC1,C2の違反数
- VAE : UC, DCなどを除外(K1, K2は処理前)したあとのC1, C2の違反数
- gccのK1-fixedに含まれない14箇所は，dead-codeなどの理由で修正の必要がなかった

# 評価
調べたいこと :
- オーバーヘッド
- 作られるCFGの精度
- 防御力

検体 :
- SPECCPU2006 C benchmarks

## 時間オーバーヘッド
次の2種類を考える．
- チェック用コードなどの計装に由来するもの
- 動的リンク時の解析・排他制御に由来するもの

### 計装による時間オーバーヘッド
![](./fig/overhead.png)
- ライブラリは全て静的リンクして計測
- 横軸 : 検体
- 縦軸 : 実行時間の計装による増加割合

### CFGの動的構築による時間オーバーヘッド
- 動的リンクは稀にしか起きないという仮定を置けば，オーバーヘッドは大きくないだろう (推測)
- 動的リンクが頻繁に起こるJIT環境を想定したテストをおこなった
    - 50Hzで人為的にIDテーブルの更新を起こした
    - <note>50HzはJITを行うJSエンジンを計測した結果を元にした値</note>

![](./fig/overhead2.png)

- 横軸 : 検体
- 縦軸 : 実行時間の計装・CFGの動的構築による増加割合

### 空間・コード量のオーバーヘッド
- 実行ファイル・オブジェクトのサイズは平均+17%
- メモリ使用量のオーバーヘッドは，ソフトウェアが確保するheapの大きさに比べれば無視できる程度

### IDテーブルの読み取り・更新の速度
トランザクションの実装には様々な手法があるが，MCFIの戦略は良いものであった

|                    |MCFI|TML |Readers Writer Lock|Mutex|
|:-------------------|:--:|:--:|:-----------------:|:---:|
|正規化された実行時間|1   |2   |29                 |22   |

## 作られるCFGの精度 @x86-64
|SPEC 2006 | IBs  | IBTs  | min(IBs, IBTs) | EQCs |
|:---------|-----:|------:|---------------:|-----:|
|perlbench | 2081 | 15273 | 2081           | 737  |
|bzip2     | 217  | 544   | 217            | 93   |
|gcc       | 4796 | 46943 | 4796           | 1991 |
|mcf       | 174  | 445   | 174            | 106  |
|gobmk     | 2487 | 10667 | 2487           | 579  |
|hmmer     | 715  | 4369  | 715            | 353  |
|sjeng     | 337  | 1435  | 337            | 184  |
|libquantum| 258  | 702   | 258            | 121  |
|h264ref   | 1096 | 3604  | 1096           | 432  |
|milc      | 432  | 2356  | 432            | 264  |
|lbm       | 161  | 426   | 161            | 96   |
|sphinx3   | 589  | 2895  | 589            | 321  |

- IBs : 計装したibranchの数
- IBTs : ibranchのtargetになりうる場所の数
- EQCs : 作られたECの数
    - 上限は min(IBs, IBTs)で，それに近いほど良い
- coarse-graind CFIよりは2,3桁ほど精度が良い

<note>

- fine-graind CFI
    - CFGを元に計算され，各ibranchごとに，飛び先として許されるECを持つことができる
        - 2つのibranchの指し先が全く同じこともある
- coarse-graind CFI
    - fine-graind に比べ，一つのECがより多くのibranchに共有される
    - 例 : 飛び先のアドレスが特定の範囲なら許す

</note>

## 防御力
### ROP gadget攻撃の観点から
- ツール(rp++)を用いて ROP-gadgetを調べた
- x86-32/64 において，96.93%/95.75%のROP-gadgetが保護された

<note>
ROP gadget攻撃 :<br>
スタックを上手く改変することで正規のコード片をつなぎ合わせて不正なcall flowを起こす攻撃．
任意コード実行とは異なり，不正なコードの注入はしない．
</note>

### AIRの観点から
|手法  |分割コンパイル|実行時間      |AIR(※2) |
|:----:|:------------:|:-------------|:--------|
|MCFI  |対応          | 平均7%(※1)  |99.99%   |
|binCFI|非対応        | 平均5%       |98.91%   |
|NaCl  |非対応        | 平均5%       |96.15%   |

- (※1) : 計装由来のオーバーヘッドが平均4～6%, IDテーブルの更新を含めると平均6～7%
- (※2) : Average Indirect-target Reduction [(ソース)](https://www.usenix.org/system/files/conference/usenixsecurity13/sec13-paper_zhang.pdf)
    - 許される飛び先がどれだけ減ったかを表す指標
    - $S$: 保護なしでibranchの飛び先になれるアドレスの数
    - $|T_j|$: 保護ありで$j$番目のibranchの飛び先になれるアドレスの数
    - $$\dfrac{1}{n}\sum_{j=1}^n \left( 1 - \dfrac{|T_j|}{S} \right)$$

# 関連研究との比較
<table>
    <thead>
        <tr>
            <th align="center"></th>
            <th align="center">動的リンクの対応</th>
            <th align="left">精度</th>
            <th align="left">Overhead (ave)</th>
            <th align="center">ハードウェア支援</th>
            <th align="left">備考</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td align="center">MCFI</td>
            <td align="center" bgcolor="#7eb953">OK</td>
            <td align="left" bgcolor="#ff7f7f">型の一致</td>
            <td align="left">7%</td>
            <td align="center" bgcolor="#7eb953">未使用</td>
            <td align="left"></td>
        </tr>
        <tr>
            <td align="center">Clang12</td>
            <td align="center" bgcolor="#7eb953">OK</td>
            <td align="left" bgcolor="#ff7f7f">型の一致</td>
            <td align="left">?</td>
            <td align="center" bgcolor="#7eb953">未使用</td>
            <td align="left">型のハッシュ値をECNとして用いるため，動的な表の構築が不要．MCFIより原理的に高速．ただしハッシュの衝突に注意．</td>
        </tr>
        <tr>
            <td align="center">PICFI</td>
            <td align="center" bgcolor="#7eb953">OK</td>
            <td align="left" bgcolor="#ffd96a">型の一致 and 実行中に使用された</td>
            <td align="left">&lt; MCFI+1%</td>
            <td align="center" bgcolor="#7eb953">未使用</td>
            <td align="left">MCFIの後続研究</td>
        </tr>
        <tr>
            <td align="center">uCFI</td>
            <td align="center" bgcolor="#ff7f7f">NG</td>
            <td align="left" bgcolor="#7eb953">IBTを1つに絞る</td>
            <td align="left">9.95%</td>
            <td align="center" bgcolor="#ff7f7f">使用</td>
            <td align="left">実行時に収集するメタデータを不正操作することで突破可能．</td>
        </tr>
        <tr>
            <td align="center">OS-CFI</td>
            <td align="center" bgcolor="#ff7f7f">NG</td>
            <td align="left" bgcolor="#7eb953">origin-sensitive</td>
            <td align="left">7.6%</td>
            <td align="center" bgcolor="#ff7f7f">使用</td>
            <td align="left">内部でSUPAを用いている</td>
        </tr>
    </tbody>
</table>

- オーバーヘッドは環境や検体に大きく左右されうるので参考程度
- origin-sensitive
    - 関数ポインタが最後に更新された地点を区別して考える
    - コールスタックを部分的に考慮する場合もある

# 結論
- 分割コンパイル(静的リンク・動的リンク)を扱えるCFIを提案した
- CFG (ECN)をコードに埋め込まず，実行時に動的に構築することで分割コンパイルに対応した
- 各モジュールに付加情報を持たせ，
    - 静的リンク時には，その付加情報をマージする
    - 動的リンク時には，その付加情報を用いてCFIに用いるCFGを更新する
- マルチスレッドに対応するため，表の操作は適切にトランザクション処理される

# 自分の研究との関連
目的 : 分割コンパイルされたプログラムを扱える高精度(少なくともflow-sensitive)なCFIの提案
- 保護対象はmoduleを跨ぐibranch

アプローチとして2つ考えている．
### 1. 使い勝手は悪いが，実装コストの低い手法
- MCFIが動的におこなっていたCFGの生成を，実行前に静的におこなう手法
    - SUPAを用いてflow-sensitiveなCFGを作る
- 実行時に表を更新しないので :
    - 表をread-onlyとして扱える = 表の保護が不要
    - 独自のランタイム・動的リンカが不要
    - 動的リンク時の解析コストがCFIの精度に非依存
- 解析を実行前に終わらせるので :
    - モジュールの更新時に，それを使用するプログラム全てについて再解析が必要になる

### 2. 使い勝手は良いが，実装コストの高い手法
- MCFIに，より多くの付加情報を持たせる拡張
- 付加情報として何をもたせ，それをどう実行時に扱うかが難しい所
- 実行時に表を更新するので実行コストが高い

### 予定
保険としてまず1を実装し，その後，1の精度向上 or 2の検討をしようと考えている．

<!-- 概要，o背景知識，o問題設定，o提案手法，o実装，o実験，関連研究，結論および自分の研究との関連 -->
