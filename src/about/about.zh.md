---
title: AllRankings 如何运作
author: clareLab
abstract: |
  AllRankings 在科学的每个范围里，按研究机构在该范围最强 venue 上发表的论文为机构排名。本文跟随一篇真实论文，逐步说明它如何变成 Count，也就是机构排名所依据的数字。论文按其所引作品的主要主题分到各个范围。它所在的期刊每年在每个范围里按一条固定规则落入一档。规则把该范围的 venue 按 Open Scholar Ranking 分数排序，这一分数来自 venue 之间的引用流，排在最前、合计约占该范围论文二十七分之一的那些 venue 构成 T1。论文的署名分给各位作者及其机构，精确到百万分之一篇。Authors 估计机构平均每年有多少人在该范围发表论文，Per author 等于 Count 除以 Authors。高一档的论文进入被引前 10% 和前 1% 的比例都高于低一档，平均学科加权引用影响也更高。在检验的 {{validity.falls.views|int}} 个范围中，即 All 和每个学科，有 {{validity.falls.every|int}} 个符合这一规律，这是分档具有实际意义的主要证据。
---

# 引言

AllRankings 的网址是 <https://ar.clarelab.moe>，它在科学的每个范围里按研究机构在选定 venue 上发表的论文为机构排名。它的原型是 CSRankings [@r3]，后者依据一份人工挑选的高选择性会议名单，按论文为计算机科学院系排名，每篇论文的署名在合作者之间平分。Leiden Ranking [@r5] 等文献计量排名则统计整所大学的论文和引用。AllRankings 保留了 CSRankings 在高选择性 venue 上数论文的做法。为了推广到所有范围，它用一条依据引用的 venue 分数和论文量的固定规则挑选 venue，通过论文所引的作品把论文放进各个范围，再按作者及其所列机构做分数计数，把署名传给机构 [@r4; @r5]。

范围是 OpenAlex 主题层级 [@r1; @r2] 中的节点。这个层级有 {{corpus.levels.domains|int}} 个领域、{{corpus.levels.fields|int}} 个学科、{{corpus.levels.subfields|int}} 个子领域和 {{corpus.levels.topics|int}} 个主题。网站把整个科学称为 All，把每个节点称为视图。All 的子节点是各个领域，领域的子节点是它下面的学科，依此类推，直到作为叶节点的主题。

下面各节跟随一篇论文，逐条说明把它的参考文献变成某个机构 Count 的规则，必要时给出公式和图。之后用引用影响检验分档，再给出几项附带发现，最后简要说明网站如何运行。文中所有数字和图都来自标题下注明的数据版本。

# 论文集

数据源是 {{snapshot|raw}} 的 OpenAlex 快照 [@r1]。AllRankings 收录同时满足以下五个条件的论文。

- 发表于 {{years.0|raw}} 至 {{years.1|raw}} 年。
- 类型为 article、review 或 conference-paper。
- 所在 venue 在这些年份中至少有一年带 Open Scholar Ranking（OSR）分数。
- OpenAlex 的撤稿标记和附属文本（paratext）标记都为 false。
- 至少引用一篇带主要主题的作品。主要主题取自 1990 至 2025 年间、OpenAlex 扩展语料以外的作品 [@r2]。

venue 就是 OpenAlex 的来源（source），论文归属于其主要位置（primary location）所在的 venue 和它的发表年份。OpenAlex 有时把一个会议拆成几条来源记录，这时每条记录各自打分、各自分档，也各自拥有一部分论文。OpenAlex 记作丛书（book series）的会议录，例如 Lecture Notes in Computer Science，在论文集之外，因为 OSR 给期刊和会议来源打分。NeurIPS、ICML 和 ICLR 在 OpenAlex 中的记录只含少量论文，ACL 的记录缺少许多年份。论文集里的每篇论文都计入 Authors，论文所在 venue 在发表当年带分数时，这篇论文才参与分档和 Count。

论文集共有 {{corpus.papers|int}} 篇论文，分布在 {{corpus.venues|int}} 个 venue。署名中带所列机构的人员有 {{corpus.people|int}} 人，分属 {{corpus.institutions|int}} 个机构，其中 {{corpus.people_orcid|int}} 人有 ORCID iD。这些论文共有 {{corpus.references|int}} 条参考文献指向带主要主题的作品。

署名把作者和论文上为其列出的机构配在一起，机构以发表时的记录为准，所以每篇论文始终归于作者当时署名的机构。OpenAlex 作者记录带 ORCID iD [@r6] 时，人员按 ORCID iD 识别，其余按 OpenAlex 作者 id 识别，因此共用一个 ORCID iD 的几条作者记录算作同一个人。

# 主题份额

OpenAlex 用分类器给每篇作品最多三个主题，按把握从高到低排列，第一个就是主要主题 [@r2; @r7]。AllRankings 按论文所引作品的主要主题为论文定位。设 $K(p)$ 为论文 $p$ 的参考文献中所引作品带主要主题的条数，$k_t(p)$ 为其中主要主题为 $t$ 的条数。$p$ 在主题 $t$ 以及层级中任一节点 $n$ 上的份额为

$$
s_t(p) = \frac{k_t(p)}{K(p)}, \qquad s_n(p) = \sum_{t \in n} s_t(p),
$$

其中 $t \in n$ 取遍 $n$ 下的所有主题。主题、子领域和学科各自只有一个上级节点，所以份额沿层级向上相加，论文在 All 上的份额是 1。

本文跟随的论文是 {{example.year|raw}} 年发表在 {{example.venue|raw}} 上的“{{example.title|raw}}”。流程按一条固定规则选出它。规则要求论文发表于 {{example.year|raw}} 年，所在 venue 当年在 {{tier_example.name|raw}} 中属于 T1，参考文献数量适中，至少一半落在这个学科，同时涉及几个子领域。它的 {{example.references|int}} 条参考文献中有 {{example.K|int}} 条引用带主要主题的作品，所以 $K$ 为 {{example.K|int}}。最大的一组有 {{example.largest.k|int}} 条，所引作品属于 {{example.largest.name|raw}}，因此论文在这个主题上的份额是 {{example.largest.k|int}}/{{example.K|int}}。

@fig:apportion 把这些单位沿层级逐级相加。论文主要落在 {{tier_example.name|raw}}，{{example.K|int}} 条参考文献中有 {{example.fields[field=17].k|int}} 条在这里，所以它以 {{example.fields[field=17].k|int}}/{{example.K|int}} 的份额计入该学科。其余参考文献分给其他学科，排在前面的是 {{example.fields.1.name|raw}}（{{example.fields.1.k|int}} 条）和 {{example.fields.2.name|raw}}（{{example.fields.2.k|int}} 条）。后面各节跟随这篇论文在 {{tier_example.name|raw}} 中的情况。

::: {#fig:apportion .figure .wide}
示例论文按参考文献拆分。每条带主要主题的参考文献是一个单位，各列按主题、子领域、学科和领域汇总这些单位。节点旁的数字是它的条数 $k$，条形是它的份额 $k/K$，连线把每个节点引向它的上级。
:::

# venue 分数

venue 分数来自 Open Scholar Ranking（OSR）[@r8]，网址是 <https://osr.clarelab.moe>。OSR 沿用 Stigler [@r10] 以及 Varin 等人 [@r11] 的思路，对 venue 之间的引用流拟合 Bradley-Terry 模型 [@r9]，并像动态 Bradley-Terry 模型 [@r12] 那样让分数随年份做随机游走。在 OSR 中，同一对施引作品与被引作品只计一次引用。两者都是研究作品，都发表在预印本库以外的 OpenAlex 期刊或会议来源上，撤稿和附属文本标记也都为 false。引用在施引作品的发表年份从施引作品的来源流向被引作品的来源，模型使用两个不同来源之间的流。

设 $m_{ij,t}$ 为第 $t$ 年 venue $i$ 对 venue $j$ 的引用数，$E_{i,t}$ 为 $i$ 的暴露度，即 $i$ 当年平均每篇合格作品发出的引用数。给定两者之间的引用总数，模型为

$$
m_{ij,t} \sim \operatorname{Binomial}\!\left(m_{ij,t} + m_{ji,t},\; \sigma\!\left(\log \frac{E_{i,t}}{E_{j,t}} + \varphi_{j,t} - \varphi_{i,t}\right)\right),
\qquad \sigma(x) = \frac{1}{1 + e^{-x}},
$$

其中 $\varphi_{i,t} - \varphi_{i,t-1}$ 服从均值为零的正态分布。考虑双方各自的引用量之后，$\varphi$ 较高的 venue 在与其他 venue 的引用往来中得到更多引用。第 $t$ 年的分数来自对 2004 年至第 $t$ 年数据的拟合。公布的分数为

$$
S_{v,t} = \sigma\!\left(\varphi_{v,t} - \tilde\varphi_t\right),
$$

其中 $\tilde\varphi_t$ 是 OSR 在第 $t$ 年排名的各 venue 的 $\varphi$ 中位数，所以 $S_{v,t}$ 是暴露度相同时，$v$ 与中位 venue 之间的一次引用流向 $v$ 的概率。模型、拟合和诊断的说明见 OSR 网站。

AllRankings 读取每个 venue 每年的 $\varphi$ 和 $S$，按 $\varphi$ 排序，显示 $S$。OSR 为引用核心中的每个 venue 写出分数，某年在公开排名之外的 venue 也有分数，AllRankings 使用所有带分数的 venue 年份。展开 Venues 表的一行，可以看到这个 venue 每年的分数，与 OSR 一样保留四位小数。

# 分档

分档按视图和年份分别进行，层级中每一级的每个视图都对自己的论文应用下面的规则。venue $v$ 在视图 $n$ 和年份 $y$ 的论文量，是它当年各篇论文在 $n$ 的每个子节点 $c$ 上的份额之和，

$$
M_{v,y}(n) = \sum_{p \in v,\; y(p) = y} \; \sum_{c} s_c(p),
$$

每个子节点的份额先以百万分之一篇为单位计，再相加。主题视图是叶节点，取论文在该主题上的份额。候选池包含第 $y$ 年带分数、在该视图中论文量为正的 venue，按 $\varphi$ 从高到低排列，$\varphi$ 相同时 OpenAlex 来源 id 较小的在前。设 $M_1, \dots, M_m$ 为按此顺序排列的论文量，$T = \sum_r M_r$ 为该视图当年带分数的产出。第 $r$ 个 venue 的中点等于排在它之前的论文量加上它自身的一半，

$$
c_r = \sum_{q < r} M_q + \frac{M_r}{2},
$$

它的档为

$$
\tau_r =
\begin{cases}
1, & c_r \le T/27, \\
2, & T/27 < c_r \le T/9, \\
3, & T/9 < c_r \le T/3, \\
4, & c_r > T/3.
\end{cases}
$$

规则从最强的 venue 开始沿候选池往下走，在该视图产出的二十七分之一、九分之一和三分之一处切开，再按每个 venue 自身论文的中点落在哪一段为它定档。因此 T1 约占该视图带分数产出的二十七分之一，T1 和 T2 合计约九分之一，前三档合计约三分之一。以 30 个论文量都为 $M$ 的 venue 为例，此时 $T = 30M$。三个切点约在 $1.11M$、$3.33M$ 和 $10M$，中点依次落在 $0.5M$、$1.5M$、$2.5M$ 等处。所以第一个 venue 是 T1，接下来两个是 T2，再往后七个是 T3，最后二十个是 T4。排在前面的 venue 论文量越大，上面几档容纳的 venue 就越少。

venue 在每个视图每年只有一档。它当年在哪些视图有论文，就在这些视图都有档，所以学科的顶档也包括综合期刊和其他范围的强势期刊，只要它们有论文涉及该学科。同一个 venue 可以在一个学科是 T1，在另一个学科是 T3，也可以逐年在档之间移动。它在某个视图中的档只取决于它在该视图候选池中的位置，领域的档同样来自领域自己的候选池。

@fig:tiers 把规则用于 {{tier_example.year|raw}} 年的 {{tier_example.name|raw}}。候选池有 {{tier_example.pool|int}} 个 venue，论文量合计 {{tier_example.mass|int}} 篇。沿 $\varphi$ 的顺序，T1 止于第 {{tier_example.cuts.0|int}} 名，T2 止于第 {{tier_example.cuts.1|int}} 名，T3 止于第 {{tier_example.cuts.2|int}} 名。排在最前面的是其他范围的强势期刊，第一名 {{tier_example.lead.name|raw}} 在该学科的论文量只有 {{tier_example.lead.mass|d1}} 篇。{{tier_example.cuts.0|int}} 个 T1 venue 中，论文量最大的 {{tier_example.heavy|int}} 个占 T1 论文量的 {{tier_example.heavy_share|pct1}}，最大的一个独占 {{t1.rows[view=field/17].top|pct1}}。T1 的 venue 合计占该学科带分数产出的 {{t1.rows[view=field/17].share|pct1}}，接近二十七分之一。{{example.venue|raw}} 在 T1 之列，所以在默认选择下，示例论文以 {{example.fields[field=17].k|int}}/{{example.K|int}} 的份额计入 {{tier_example.name|raw}}。

::: {#fig:tiers .figure .wide}
{{tier_example.year|raw}} 年 {{tier_example.name|raw}} 候选池上的分档规则。venue 按 $\varphi$ 排列在对数横轴上，曲线是池中论文量的累计份额，按档着色，图例给出每档的 venue 数。曲线与 1/27、1/9 和 1/3 三条线的交点就是档的分界。列表给出论文量最大的那些 T1 venue，附它们在这一顺序中的名次、$\varphi$ 和论文量。
:::

# 选择

视图中的选择由四部分组成。

- 年份 $y_0$ 至 $y_1$，可在 {{years.0|raw}} 至 {{years.1|raw}} 年间任取，默认为 {{default_years.0|raw}} 至 {{default_years.1|raw}} 年。
- 条目集合 $L$。条目是一档与一个 venue 组成的对。Venues 列表把每个 venue 列在它所选年份内在该视图占据的每一档下，每个条目一个复选框，勾选一档就勾选它下面的所有条目。
- 视图中勾选的子节点。主题视图是叶节点，计入它自己的主题。
- 选中的国家，默认全选。

第 $y$ 年发表在 venue $v$ 上的论文 $p$ 计入，当且仅当 $y_0 \le y \le y_1$ 且 $(\tau(v, y), v) \in L$，其中 $\tau(v, y)$ 是 $v$ 第 $y$ 年在该视图中的档。默认选择勾选所有 T1 条目、所有子节点和所有国家。设想某个 venue 在默认年份的前两年是某学科的 T1，后两年是 T2。在默认年份下，它在这个学科有两个条目，一个在 T1 下，一个在 T2 下。按默认条目计入的是它前两年的论文，再勾选它的 T2 条目，就会加上后两年的论文。

# 计数

论文 $p$ 在勾选的子节点 $C$ 上的份额为 $s_C(p) = \sum_{c \in C} s_c(p)$，在主题视图中就是它在该主题上的份额。设 $N(p)$ 为 $p$ 的署名数，$I(a, p)$ 为作者 $a$ 在 $p$ 上所列的机构，$A(p, i)$ 为 $p$ 中列出机构 $i$ 的作者。机构 $i$ 在 $p$ 上的权重，以及它在某个选择下的 Count 为

$$
W(p, i) = \sum_{a \in A(p, i)} \frac{1}{N(p)\,|I(a, p)|}, \qquad
\mathrm{Count}(i) = \sum_{p \in Q} s_C(p)\, W(p, i),
$$

其中 $Q$ 是该选择下计入的论文。每条署名占论文的 $1/N(p)$，再在该作者于这篇论文所列的机构之间平分 [@r4]，所以 Count 是论文篇数。$N(p)$ 包括所有署名，机构列表为空的署名也算在内，因此一篇论文的权重之和等于列出机构的署名所占的比例。

在勾选全部子领域的 {{tier_example.name|raw}} 视图中，示例论文在勾选子节点上的份额是 {{example.fields[field=17].k|int}}/{{example.K|int}}，论文上的每个机构按这一比例得到它的权重 $W$。@fig:counting 在一篇有三条署名的小论文上演示权重。作者 a 列出机构 X 和 Y，作者 b 列出 X，作者 c 的机构列表为空。于是 $W(p, X) = 1/6 + 1/3 = 1/2$，$W(p, Y) = 1/6$。若论文在勾选子节点上的份额是 0.75，它给 X 的 Count 加 0.375，给 Y 的 Count 加 0.125。

::: {#fig:counting .figure .wide}
三位作者的小论文上的分数计数。每位作者占论文的三分之一，在该作者一行标出的机构之间平分，机构的权重 $W$ 是它那一列的和。空列表一行放的是作者 c 的三分之一。表格把 $W$ 换成存储的权重 $w$，并对 4 条参考文献中有 3 条在勾选子节点下的论文给出微论文数。
:::

## 精确算术

Count 一律用整数计算。记 $[x]$ 为 $x$ 取最近的整数，恰为一半时向远离零的方向取整。流程存储

$$
w(p, i) = \left[10^9\, W(p, i)\right]
$$

$p$ 在子节点 $c$ 上对机构 $i$ 的贡献是

$$
n(p, i, c) = \left[\frac{k_c(p)\, w(p, i)}{1000\, K(p)}\right]
$$

个百万分之一篇，其中 $k_c(p)$ 是 $c$ 下各主题的 $k_t(p)$ 之和。在上面的小例子中，$w(p, X) = 500{,}000{,}000$，$w(p, Y) = 166{,}666{,}667$。当 $K = 4$ 且有三条参考文献在子节点 $c$ 下时，$n(p, X, c) = 375{,}000$。Y 的商是 $125{,}000.00025$，取整后 $n(p, Y, c) = 125{,}000$。

存储的每个汇总值都恰好是这些整数之和。网站加入或移除某个 venue 的论文时，从数据包重新算出同样的整数，所以结果与流程一致，精确到百万分之一。乘积 $k_c(p)\, w(p, i)$ 始终小于 $2^{53}$，因此浏览器和流程的双精度运算得到相同的商和相同的取整。

# Authors

Authors 估计机构平均每年有多少人在该范围发表论文。它计入所有列出机构的作者，任何署名位次都算，有 ORCID iD 的人员和按 OpenAlex 作者 id 识别的人员同等对待。

每个人年是一个单位。某人某年在论文集中至少有一条带机构的署名时，这个人年就存在。设 $P(a, y)$ 为人员 $a$ 第 $y$ 年的这些论文。这个单位先在 $P(a, y)$ 上平分，每篇论文分到的部分再在这个人于该论文所列的机构之间平分，最后按论文的份额分到各个主题，

$$
F(i, y, c) = \sum_{a} \sum_{p \in P(a, y)} \frac{1}{|P(a, y)|} \cdot \frac{\mathbf{1}[i \in I(a, p)]}{|I(a, p)|} \cdot s_c(p).
$$

$F$ 按机构、子节点和年份汇总，并取整到百万分之一人年。选择下的 Authors，是所选各年里勾选子节点上 $F$ 之和的平均值，

$$
\mathrm{Authors}(i) = \frac{1}{y_1 - y_0 + 1} \sum_{y = y_0}^{y_1} \sum_{c \in C} F(i, y, c).
$$

在勾选所有领域的 All 视图中，一年内所有机构的 $F$ 之和在取整误差内等于当年的人年数。在较小的视图中，每个人按其工作落在该视图的部分计入，所以作者投入示例论文的那部分人年，以 {{example.fields[field=17].k|int}}/{{example.K|int}} 的份额进入 {{tier_example.name|raw}}。

@fig:faculty 给出一个例子。人员 a 当年有两篇论文，第一篇列 X 和 Y，第二篇列 X，人员 b 只有第一篇，列 X。a 的单位给每篇论文一半，第一篇的一半再分成 X 的四分之一和 Y 的四分之一。b 的整个单位归 X。拆分到主题之前，X 有 1.75 人年，Y 有 0.25 人年，合计两个单位。

Authors 取决于视图、年份和勾选的子节点。它纳入论文集中所有 venue、所有档的论文，这样下一节的比值能保留一个人的工作中进入所选 venue 的比例。设想某人独自在一个机构，一年发表十篇论文，其中一篇在 T1 venue。Count 和 Authors 都是 1，比值为 1。十篇都在 T1 的人，比值为 10。如果分母只用所选论文来算，第一个人的 Authors 会是 0.1，比值为 10，与第二个人相同。

::: {#fig:faculty .figure .wide}
小例子上的 Authors 计算。第一个面板把两个人一年的单位先分到各自的论文，再分到他们在每篇论文上的机构。表格按论文的份额把每个机构的合计分给两个子节点，其中 Physics 占论文 1 的四分之三和论文 2 的一半。第二个面板看独自在某机构、一年有十篇论文的人，随着其中 T1 论文增多，分别给出由全部论文和只由 T1 论文得出的 Authors。
:::

# Per author、表格与面板

Per author 等于 Count 除以 Authors。Count 在所选年份上累加，Authors 是年均值，所以 Per author 是整个年份范围内所选论文的篇数除以平均每年发表论文的人数。年产出不变时，年份范围加倍，Per author 也随之加倍。

Institutions 表列出国家筛选之后、该选择下 Count 为正的每个机构，显示 Count、Authors 和 Per author，保留两位小数。旗帜表示 OpenAlex 为该机构记录的国家，选中所有国家时，国家为空的机构也会出现。表头有两个筛选，分别保留 Count 高于均值和 Authors 高于均值的机构，两个均值都在任一筛选生效之前按列出的行计算，默认都开启。名次是筛选后列表中的位置，按所选列从大到小排序，数值相等的名次相同。

展开机构会列出在其计入论文上得分为正的每个人。某人的得分只保留 Count 公式中此人的那一项，即对此人在该机构的计入论文求 $\sum_p s_C(p) / (N(p)\,|I(a, p)|)$。对 ORCID iD，名字取自作品最多的那条作者记录，作品数相同时取作者 id 最小的一条，其他人员则用自己作者记录的名字。名字链接到 OpenAlex 上对应的作者记录。

Venues 表列出该选择下 Count 为正的每个 venue，每个所选年份给出一档。它的 Count 把该 venue 在勾选的子节点上的论文量按所选条目的年份相加。分档时相加的也正是这些按子节点计的论文量，所以 Count 和 Institutions 表一样随勾选的子节点变化。另有一个筛选保留 Count 高于均值的 venue。venue 的旗帜表示 OpenAlex 为其来源记录的国家，通常是出版者所在国，Countries 选择按这个国家筛选这些行，各项数值保持原样。

左侧面板有 Areas、Countries 和 Venues 三个列表，其中 Countries 按 GeoNames [@r13] 把国家归入各大洲。在每个列表里，点击名称会打开该节点并列出其子节点，复选框则改变选择。在 Countries 和 Venues 中，复选框选中或清除其节点下的整棵子树。在 Areas 中，用墨色显示的节点是当前视图。它的复选框切换全部子节点，子节点的复选框切换该子节点。勾选路径上的另一个节点，会让它成为视图并勾选它的全部子节点。勾选另一个上级下的某个列出节点，会让那个上级成为视图，且只勾选这个节点。视图改变时条目会重置，每个条目在且仅在其所在档被勾选时勾选。

# 分档与引用影响

分档来自 venue 之间的引用流，这项检验要看的是，较高档的论文作为单篇论文是否也有更高的引用影响。对每个视图和每一档，检验取 {{validity.window.0|raw}} 至 {{validity.window.1|raw}} 年间所在 venue 在发表当年属于该视图该档的论文，每篇按其在视图中的份额加权，计算三个比率。

- 被引前 10% 份额，即 OpenAlex 按标准化引用排在前 10% 的论文所占的加权份额 [@r2; @r14]。
- 被引前 1% 份额，按同样方法计算前 1%。
- 平均 FWCI，即 OpenAlex 的学科加权引用影响的加权均值。FWCI 等于作品所得引用除以同类型、同年份、同子领域作品的预期引用 [@r2; @r15]。

覆盖率是三个值齐全的论文所占的加权份额。窗口止于 {{validity.window.1|raw}} 年，让论文有时间积累引用。

在 {{names.fields.17|raw}} 中，被引前 10% 份额在 T1 是 {{validity.rows[view=field/17,tier=1].top10|pct1}}，在 T2 是 {{validity.rows[view=field/17,tier=2].top10|pct1}}。它在 T3 降到 {{validity.rows[view=field/17,tier=3].top10|pct1}}，在 T4 降到 {{validity.rows[view=field/17,tier=4].top10|pct1}}。平均 FWCI 由 T1 的 {{validity.rows[view=field/17,tier=1].fwci|d2}} 降到 T4 的 {{validity.rows[view=field/17,tier=4].fwci|d2}}，T1 的覆盖率是 {{validity.rows[view=field/17,tier=1].coverage|pct0}}。@fig:validity 给出所有学科。在 All 和各学科这 {{validity.falls.views|int}} 个视图中，有 {{validity.falls.every|int}} 个的三个比率都自 T1 至 T4 逐档下降。

::: {#fig:validity .figure .wide}
各档的引用影响，All 占一行，每个学科占一行，三列分别是被引前 10% 份额、被引前 1% 份额和平均 FWCI。每个点是一档，按 T1 至 T4 着色，越靠右影响越高。
:::

# 其他发现

下面的分析采用默认选择，即 T1 条目、全部子节点和 {{default_years.0|raw}} 至 {{default_years.1|raw}} 年，在 All 视图和每个学科视图中进行。

## 构成

All 视图按每个 venue 的整体产出为它分档，各学科的论文再通过所在的 venue 落入这些全局档。默认年份内，All 视图的 T1 共有 {{composition[view=all].mass.0|int}} 篇论文，@fig:composition 按所在 venue 在 All 视图中的档拆分每个学科的产出。上游学科的成果被科学中大量其他研究引用和借鉴，它们落在全局 T1 的产出比例最大。{{upstream.top.0.name|raw}} 居首，其次是 {{upstream.top.1.name|raw}}，再次是 {{upstream.top.2.name|raw}}。{{upstream.bottom.0.name|raw}} 的比例最小，其次是 {{upstream.bottom.1.name|raw}}、{{upstream.bottom.2.name|raw}} 和 {{upstream.bottom.3.name|raw}} 等应用和临床学科。

{{t1.year|raw}} 年，All 视图的 T1 包含 {{t1.rows[view=all].venues|int}} 个 venue，占当年带分数产出的 {{t1.rows[view=all].share|pct1}}。其中最大的 {{t1.rows[view=all].venue|raw}} 占这一 T1 的 {{t1.rows[view=all].top|pct1}}。

::: {#fig:composition .figure}
默认年份内按 All 视图的档划分的论文量，All 一条，每个学科一条。学科的 T1 段是它在 All 视图中属于 T1 的 venue 上的产出。
:::

## 集中度

集中度在 T1 Count 为正的机构上计算。在 All 视图中，最大的 10 个机构占 T1 Count 的 {{concentration[view=all].top10|pct1}}，最大的 100 个占 {{concentration[view=all].top100|pct1}}。这里的基尼系数是 {{concentration[view=all].gini|d2}}，等于洛伦兹曲线 [@r16] 与均等份额对角线之间面积的两倍。@fig:concentration 画出每个学科的份额。

::: {#fig:concentration .figure}
All 和各学科 T1 Count 的集中度，范围是 T1 Count 为正的机构。第一个面板在对数坐标轴上给出最大的那些机构占 T1 Count 的份额与它们在机构中所占比例的关系，曲线越高，Count 集中在越少的机构。第二个面板给出最大的 10 个和 100 个机构的份额。
:::

## 国家

国家份额是 All 视图中每个国家的机构所占的 T1 Count 比例，对 {{years.0|raw}} 至 {{years.1|raw}} 年逐年计算，所有国家用同一方法。United States 的份额在这段时间下降，第一年为 {{countries.series[country=US].share.0|pct1}}，最后一年为 {{countries.series[country=US].share.21|pct1}}。同期 China 上升，由 {{countries.series[country=CN].share.0|pct1}} 升至 {{countries.series[country=CN].share.21|pct1}}。@fig:countries 画出 {{years.1|raw}} 年份额最大的几个国家、其他所有国家的合计，以及国家为空的机构。

::: {#fig:countries .figure}
按国家和年份的 T1 Count 份额，每个国家一条线，其他国家合计和国家为空的机构是两条虚线。这段时间份额变化最大的两个国家用黑色和蓝色画出。
:::

## 稳定性

对每个视图和年份，稳定性是单年 T1 Count 与上一年的 Spearman 秩相关系数 [@r17]，范围是两年 Count 都为正的机构。All 视图中各年的均值为 {{stability[view=all].mean|d2}}，每年约有 {{stability[view=all].n|int}} 个机构，所以这些机构的次序逐年大体保持。学科视图的波动更大。均值最低的三个学科依次是 {{stability.1.name|raw}}（{{stability.1.mean|d2}}）、{{stability.2.name|raw}}（{{stability.2.mean|d2}}）和 {{stability.3.name|raw}}（{{stability.3.mean|d2}}）。它们每年分别约有 {{stability.1.n|int}}、{{stability.2.n|int}} 和 {{stability.3.n|int}} 个机构。@fig:stability 给出所有序列。

::: {#fig:stability .figure}
机构 T1 Count 的逐年 Spearman 相关系数，范围是两年都出现的机构，每个视图一条线，标出 All 和均值最低的三个学科。数值接近 1 表示机构在两年间保持原有次序。
:::

## 规模

对 Count 和 Authors 都为正的机构，以 $\log \mathrm{Count}$ 对 $\log \mathrm{Authors}$ 做最小二乘拟合，每个视图得到一个斜率。斜率为 1 表示 T1 Count 与 Authors 成比例增长，斜率小于 1 表示每人的 Count 随规模下降。All 视图的斜率是 {{scaling.rows[view=all].slope|d2}}，拟合了 {{scaling.rows[view=all].n|int}} 个机构，$R^2$ 为 {{scaling.rows[view=all].r2|d2}}。各学科的斜率最低是 {{scaling.low.name|raw}} 的 {{scaling.low.slope|d2}}，最高是 {{scaling.high.name|raw}} 的 {{scaling.high.slope|d2}}。@fig:scaling 画出 All 视图中一部分机构的样本。

::: {#fig:scaling .figure}
对数坐标下 All 视图中部分机构的 Count 与 Authors。样本在 Count 和 Authors 都为正的机构中按 Authors 名次等距抽取，最小二乘直线用这些机构全体拟合。直线上方的点，Count 高于其 Authors 值所预测的水平。第二个面板给出每个视图的斜率。
:::

# 网站如何运行

网站是静态页面，用 HTTP Range 请求从静态存储读取 Parquet 文件 [@r18]，只取文件中需要的部分。每次构建读取一个数据版本，以 SHA-256 摘要的前 16 位十六进制数命名，摘要涵盖流程的代码、配置和各项输入的标识。

数据版本包含主题层级、机构和 venue 的名称与国家、每个 venue 每年的分数，以及每个视图的三个文件。第一个文件给出每个 venue 每年的档和论文量，在有子节点的视图中按子节点分开，另有一行全部子节点的合计。另外两个文件按机构和子节点存放 Count 和 Authors 的累计值，以百万分之一为单位，从 {{years.0|raw}} 年累计到每一年，Count 还按档分开。在有子节点的视图中，每个机构另有一行全部子节点的合计。从 $y_0$ 到 $y_1$ 的选择读取 $y_1$ 和 $y_0 - 1$ 的累计值再相减，每个勾选的档读两个行组，Authors 也读两个。视图的汇总值一次全部加载，因为排名需要所有机构。

数据包每篇论文一行。某个条目的复选框与其所在档的复选框状态不同时，Count 会在某些年份变动一个 venue 的论文，所以网站加载该 venue 这些年份的数据包，重新算出整数 $n(p, i, c)$ 并加上或减去。展开机构会加载它在所选年份的数据包。

每次部署前会运行一项检查，在 Bun 中用网站自己的数据代码读取本地版本。检查针对一组固定的选择，把网站将要显示的 Count 与从数据包独立重算的结果比较，精确到百万分之一，出现任何差异都会终止部署。

# 引用 AllRankings {-}

排名随每次发布变化，引用时写明标题下方的版本号。引用网站上的具体排名时，再附上网址和访问日期，网址记录了当时的选择。

clareLab ({{year|raw}}). AllRankings, release {{release|raw}}. <https://ar.clarelab.moe>

```
@misc{allrankings,
  author = {clareLab},
  title = {{AllRankings}},
  year = {{{year|raw}}},
  note = {Release {{release|raw}}},
  howpublished = {\url{https://ar.clarelab.moe}}
}
```

# 参考文献 {-}

::: {#refs}
[r1] Priem, J., Piwowar, H., and Orr, R. (2022). OpenAlex: A fully-open index of scholarly works, authors, venues, institutions, and concepts. arXiv:2205.01833. <https://doi.org/10.48550/arXiv.2205.01833>

[r2] OpenAlex. Work attributes. <https://help.openalex.org/data/works/attributes/>

[r3] Berger, E. D. CSRankings: Computer science rankings. <https://csrankings.org>

[r4] Waltman, L., and van Eck, N. J. (2015). Field-normalized citation impact indicators and the choice of an appropriate counting method. Journal of Informetrics, 9(4), 872–894. <https://doi.org/10.1016/j.joi.2015.08.001>

[r5] Waltman, L., Calero-Medina, C., Kosten, J., Noyons, E. C. M., Tijssen, R. J. W., van Eck, N. J., van Leeuwen, T. N., van Raan, A. F. J., Visser, M. S., and Wouters, P. (2012). The Leiden Ranking 2011/2012: Data collection, indicators, and interpretation. Journal of the American Society for Information Science and Technology, 63(12), 2419–2432. <https://doi.org/10.1002/asi.22708>

[r6] Haak, L. L., Fenner, M., Paglione, L., Pentz, E., and Ratner, H. (2012). ORCID: A system to uniquely identify researchers. Learned Publishing, 25(4), 259–264. <https://doi.org/10.1087/20120404>

[r7] Barrett, J. (2024). OpenAlex topic classification v1 model artifacts and training data. Zenodo. <https://doi.org/10.5281/zenodo.11235511>

[r8] clareLab. Open Scholar Ranking. <https://osr.clarelab.moe>

[r9] Bradley, R. A., and Terry, M. E. (1952). Rank analysis of incomplete block designs: I. The method of paired comparisons. Biometrika, 39(3/4), 324–345. <https://doi.org/10.2307/2334029>

[r10] Stigler, S. M. (1994). Citation patterns in the journals of statistics and probability. Statistical Science, 9(1), 94–108. <https://doi.org/10.1214/ss/1177010655>

[r11] Varin, C., Cattelan, M., and Firth, D. (2016). Statistical modelling of citation exchange between statistics journals. Journal of the Royal Statistical Society Series A, 179(1), 1–63. <https://doi.org/10.1111/rssa.12124>

[r12] Cattelan, M., Varin, C., and Firth, D. (2013). Dynamic Bradley-Terry modelling of sports tournaments. Journal of the Royal Statistical Society Series C, 62(1), 135–150. <https://doi.org/10.1111/j.1467-9876.2012.01046.x>

[r13] GeoNames. Country information. <https://download.geonames.org/export/dump/countryInfo.txt>

[r14] Waltman, L., and Schreiber, M. (2013). On the calculation of percentile-based bibliometric indicators. Journal of the American Society for Information Science and Technology, 64(2), 372–379. <https://doi.org/10.1002/asi.22775>

[r15] Waltman, L., van Eck, N. J., van Leeuwen, T. N., Visser, M. S., and van Raan, A. F. J. (2011). Towards a new crown indicator: Some theoretical considerations. Journal of Informetrics, 5(1), 37–47. <https://doi.org/10.1016/j.joi.2010.08.001>

[r16] Lorenz, M. O. (1905). Methods of measuring the concentration of wealth. Publications of the American Statistical Association, 9(70), 209–219. <https://doi.org/10.1080/15225437.1905.10503443>

[r17] Spearman, C. (1904). The proof and measurement of association between two things. The American Journal of Psychology, 15(1), 72–101. <https://doi.org/10.2307/1412159>

[r18] Apache Parquet. File format. <https://parquet.apache.org/docs/file-format/>
:::
