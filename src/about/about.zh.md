---
title: AllRankings 如何运作
author: clareLab
abstract: |
  AllRankings 在科学的每个范围里，按研究机构在该范围最强 venue 上发表的论文为机构排名。本文跟随一篇真实论文，逐步说明它如何变成网站上的数字。论文按其所引作品的主要主题分到各个范围。每个范围按 Open Scholar Ranking 分数为 venue 排序，这一分数来自 venue 之间的引用流。T1 由最强的那些 venue 组成，它们合计发表该范围约二十七分之一的论文。Count 累加机构在所选档和年份内论文上的分数署名，Authors 估计机构平均每年有多少人在该范围发表论文。表格按 Excess 为机构排名，Excess 等于机构的 Count 减去按其规模预期的 Count，预期值来自对整个范围拟合的 Authors 幂律。在检验的全部 {{validity.falls.views|int}} 个范围中，高一档的论文平均学科加权引用影响更高，也更常进入被引前 1%。在其中 {{validity.falls.top10|int}} 个范围中，高一档的论文也更常进入被引前 10%。这是分档具有实际意义的主要证据。
---

# 引言

AllRankings 的网址是 <https://ar.clarelab.moe>，它在科学的每个范围里按研究机构在选定 venue 上发表的论文为机构排名。它的原型是 CSRankings [@r3]，后者依据一份人工挑选的高选择性会议名单，按论文为计算机科学院系排名，每篇论文的署名在合作者之间平分。为了覆盖所有范围，AllRankings 用一条依据引用的 venue 分数和论文量的固定规则挑选 venue，并通过论文所引的作品把论文放进各个范围。署名按作者及其所列机构做分数计数后传给机构，Leiden Ranking 统计整所大学时也这样做 [@r4; @r5]。

范围是 OpenAlex 主题层级 [@r1; @r2] 中的节点。这个层级有 {{corpus.levels.domains|int}} 个领域、{{corpus.levels.fields|int}} 个学科、{{corpus.levels.subfields|int}} 个子领域和 {{corpus.levels.topics|int}} 个主题。网站把整个科学称为 All，把每个节点称为视图。All 的子节点是各个领域，领域的子节点是它下面的学科，依此类推，直到作为叶节点的主题。

下面各节跟随一篇论文，说明把它的参考文献变成某个机构 Count 的规则。之后定义 Authors、Per author 和 Excess，介绍表格，并用引用影响检验分档。最后是几项附带发现和网站运行的简要说明。文中所有数字和图都来自标题下注明的数据版本。

# 论文集

数据源是 {{snapshot|raw}} 的 OpenAlex 快照 [@r1]。AllRankings 收录同时满足以下五个条件的论文。

- 发表于 {{years.0|raw}} 至 {{years.1|raw}} 年。
- 类型为 article、review 或 conference-paper。
- 所在 venue 在这些年份中至少有一年带 Open Scholar Ranking 分数。
- OpenAlex 的撤稿标记和附属文本（paratext）标记都为 false。
- 至少引用一篇带主要主题的作品，主要主题取自 OpenAlex 主语料中 1990 至 2025 年的作品 [@r2]。

venue 就是 OpenAlex 的来源（source），论文归属于其主要位置（primary location）所在的 venue 和它的发表年份。OSR 为期刊和会议来源打分，因此 OpenAlex 记作丛书（book series）的会议录，例如 Lecture Notes in Computer Science，落在论文集之外。OpenAlex 有时把一个会议拆成几条来源记录，每条记录各自打分、各自分档。它对 NeurIPS、ICML 和 ICLR 的记录含有这些会议的一小部分论文，ACL 的记录覆盖其中部分年份。论文集里的每篇论文都计入 Authors，在 venue 带分数的年份里，它的论文也参与分档和 Count。

论文集共有 {{corpus.papers|int}} 篇论文，分布在 {{corpus.venues|int}} 个 venue。署名中带所列机构的人员有 {{corpus.people|int}} 人，分属 {{corpus.institutions|int}} 个机构，其中 {{corpus.people_orcid|int}} 人有 ORCID iD。这些论文共有 {{corpus.references|int}} 条参考文献指向带主要主题的作品。

署名把作者和发表时论文上为其列出的机构配在一起，每篇论文因此始终归于作者当时署名的机构。OpenAlex 作者记录带 ORCID iD [@r6] 时，人员就是这个 ORCID iD，其余情况下是 OpenAlex 作者 id，因此共用一个 ORCID iD 的几条作者记录算作同一个人。

# 主题份额

OpenAlex 用分类器给每篇作品最多三个主题，按把握从高到低排列，第一个就是主要主题 [@r2; @r7]。AllRankings 按论文所引作品的主要主题为论文定位。设 $K(p)$ 为论文 $p$ 的参考文献中所引作品带主要主题的条数，$k_t(p)$ 为其中主要主题为 $t$ 的条数。$p$ 在主题 $t$ 以及层级中任一节点 $n$ 上的份额为

$$
s_t(p) = \frac{k_t(p)}{K(p)}, \qquad s_n(p) = \sum_{t \in n} s_t(p),
$$

其中 $t \in n$ 取遍 $n$ 下的所有主题。主题、子领域和学科各自属于唯一的上级节点，份额因此沿层级向上相加，论文在 All 上的份额是 1。

本文跟随的论文是 {{example.year|raw}} 年发表在 {{example.venue|raw}} 上的“{{example.title|raw}}”。流程按一条固定规则选出它。规则要求论文发表于 {{example.year|raw}} 年，所在 venue 当年在 {{tier_example.name|raw}} 中属于 T1，参考文献数量适中，至少一半落在这个学科，同时涉及几个子领域。它的 {{example.references|int}} 条参考文献中有 {{example.K|int}} 条引用带主要主题的作品，$K$ 即为 {{example.K|int}}。最大的一组有 {{example.largest.k|int}} 条，所引作品属于 {{example.largest.name|raw}}，因此论文在这个主题上的份额是 {{example.largest.k|int}}/{{example.K|int}}。

@fig:apportion 把这些单位沿层级逐级相加。论文主要落在 {{tier_example.name|raw}}，{{example.K|int}} 条参考文献中有 {{example.fields[field=17].k|int}} 条在这里，所以它以 {{example.fields[field=17].k|int}}/{{example.K|int}} 的份额计入该学科。其余参考文献延伸到其他学科，排在前面的是 {{example.fields.1.name|raw}}（{{example.fields.1.k|int}} 条）和 {{example.fields.2.name|raw}}（{{example.fields.2.k|int}} 条）。后面各节跟随这篇论文在 {{tier_example.name|raw}} 中的情况。

::: {#fig:apportion .figure .wide}
示例论文按参考文献拆分。每条带主要主题的参考文献是一个单位，四列按主题、子领域、学科和领域汇总这些单位。节点旁的数字是它的条数 $k$，条形是它的份额 $k/K$，连线把每个节点引向它的上级。后面各节跟随的是经过 {{tier_example.name|raw}} 的那条路径。
:::

# venue 分数

venue 分数来自 Open Scholar Ranking（OSR）[@r8]，网址是 <https://osr.clarelab.moe>。OSR 沿用 Stigler [@r10] 以及 Varin 等人 [@r11] 的思路，对 venue 之间的引用流拟合 Bradley-Terry 模型 [@r9]。分数随年份做随机游走，与动态 Bradley-Terry 模型 [@r12] 相同。引用在施引作品的发表年份，从施引作品的来源流向被引作品的来源。设 $m_{ij,t}$ 为第 $t$ 年 venue $i$ 对 venue $j$ 的引用数，$R_{i,t}$ 为 $i$ 当年对其他 venue 发出的全部引用，$B_{i,t}$ 为 $i$ 的可被引存量，定义见下文。给定两者之间的引用总数，模型为

$$
m_{ij,t} \sim \operatorname{Binomial}\!\left(m_{ij,t} + m_{ji,t},\; \pi_{ij,t}\right),
\qquad \pi_{ij,t} = \sigma\!\left(\log \frac{R_{i,t}\, B_{j,t}}{R_{j,t}\, B_{i,t}} + \varphi_{j,t} - \varphi_{i,t}\right),
$$

其中 $\sigma(x) = 1/(1 + e^{-x})$ 是 logistic 函数，$\varphi_{i,t} - \varphi_{i,t-1}$ 服从均值为零的正态分布。考虑双方各自的引用量和可被引存量之后，$\varphi$ 较高的 venue 在与其他 venue 的引用往来中得到更多引用。第 $t$ 年的分数来自对 2004 年至第 $t$ 年数据的拟合。被引的一方提供的是全部往期作品，所以可被引存量计入此前每一年的作品，并按该年龄作品的被引频率加权，定义为

$$
B_{v,t} = \sum_{t' \le t} Q_{v,t'}\, g(t - t'),
$$

其中 $Q_{v,t'}$ 是 venue $v$ 在第 $t'$ 年发表的合格作品数，$g(k)$ 是一篇作品在发表 $k$ 年后平均得到的引用数。它把 2004 年至 2025 年每个施引年份对 $k$ 年前作品的引用加总，再除以这些年份各自 $k$ 年前发表的合格作品数。公布的分数为

$$
S_{v,t} = \sigma\!\left(\varphi_{v,t} - \tilde\varphi_t\right),
$$

其中 $\tilde\varphi_t$ 是 OSR 在第 $t$ 年排名的各 venue 的 $\varphi$ 中位数，$S_{v,t}$ 因此是考虑引用量和存量之后，$v$ 与中位 venue 之间的一次引用流向 $v$ 的概率。

AllRankings 按 $\varphi$ 为 venue 排序，显示 $S$。它使用 OSR 打分的每个 venue 年份，其中包括引用核心里排在当年公开排名之外的 venue。展开 Venues 表的一行，可以看到这个 venue 每年的分数，与 OSR 一样保留四位小数。

# 分档

层级中每一级的每个视图，每年都用自己的论文定出自己的档。venue $v$ 在视图 $n$ 和年份 $y$ 的论文量，是它当年各篇论文在 $n$ 的每个子节点 $c$ 上的份额之和，

$$
M_{v,y}(n) = \sum_{p \in v,\; y(p) = y} \; \sum_{c} s_c(p),
$$

每个子节点的份额先以百万分之一篇为单位计，再相加，主题视图取论文在该主题上的份额。候选池包含第 $y$ 年带分数、在该视图中论文量为正的 venue，按 $\varphi$ 从高到低排列，$\varphi$ 相同时 OpenAlex 来源 id 较小的在前。设 $M_1, \dots, M_m$ 为按此顺序排列的论文量，$T = \sum_r M_r$ 为该视图当年带分数的产出。第 $r$ 个 venue 的中点等于排在它之前的论文量加上它自身的一半，

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

规则从最强的 venue 开始沿候选池往下走，在该视图产出的二十七分之一、九分之一和三分之一处切开，再按每个 venue 自身论文的中点落在哪一段为它定档。因此 T1 约占该视图带分数产出的二十七分之一，前两档合计约九分之一，前三档合计约三分之一。若候选池有 30 个论文量相等的 venue，第一个是 T1，接下来两个是 T2，再往后七个是 T3，其余是 T4。排在前面的 venue 论文量越大，上面几档容纳的 venue 越少。

venue 当年在哪些视图有论文，就在这些视图各有一档，因此学科的顶档也包括论文涉及该学科的综合期刊和其他范围的强势期刊。同一个 venue 可以在一个学科是 T1，在另一个学科是 T3，也可以逐年换档。

@fig:tiers 把规则用于 {{tier_example.year|raw}} 年的 {{tier_example.name|raw}}，当年候选池有 {{tier_example.pool|int}} 个 venue，论文量合计 {{tier_example.mass|int}} 篇。沿 $\varphi$ 的顺序，T1 止于第 {{tier_example.cuts.0|int}} 名，T2 止于第 {{tier_example.cuts.1|int}} 名，T3 止于第 {{tier_example.cuts.2|int}} 名。排在最前面的是其他范围的强势期刊，第一名 {{tier_example.lead.name|raw}} 在该学科的论文量为 {{tier_example.lead.mass|d1}} 篇。{{tier_example.cuts.0|int}} 个 T1 venue 中，论文量最大的 {{tier_example.heavy|int}} 个占 T1 论文量的 {{tier_example.heavy_share|pct1}}，最大的一个独占 {{t1.rows[view=field/17].top|pct1}}。T1 的 venue 合计占该学科带分数产出的 {{t1.rows[view=field/17].share|pct1}}，接近二十七分之一。{{example.venue|raw}} 在 T1 之列，所以在默认选择下，示例论文以 {{example.fields[field=17].k|int}}/{{example.K|int}} 的份额计入 {{tier_example.name|raw}}。

::: {#fig:tiers .figure .wide}
{{tier_example.year|raw}} 年 {{tier_example.name|raw}} 候选池上的分档规则。venue 按 $\varphi$ 排列在对数横轴上，曲线是池中论文量的累计份额，按档着色。曲线与 1/27、1/9 和 1/3 三条线相交处就是各档的终点，图例给出每档的 venue 数。列表给出论文量最大的那些 T1 venue，附它们在这一顺序中的名次、$\varphi$ 和论文量。
:::

# 选择

视图中的选择由四部分组成。

- 年份 $y_0$ 至 $y_1$，取在 {{years.0|raw}} 至 {{years.1|raw}} 年之内，默认为 {{default_years.0|raw}} 至 {{default_years.1|raw}} 年。
- 条目集合 $L$，每个条目是一档与一个 venue 组成的对。Venues 列表把每个 venue 列在它所选年份内在该视图占据的每一档下，每个条目一个复选框，勾选一档就勾选它下面的所有条目。
- 视图中勾选的子节点。主题视图计入它自己的主题。
- 选中的国家，默认全选。

第 $y$ 年发表在 venue $v$ 上的论文 $p$ 计入，当且仅当 $y_0 \le y \le y_1$ 且 $(\tau(v, y), v) \in L$，其中 $\tau(v, y)$ 是 $v$ 第 $y$ 年在该视图中的档。默认选择勾选所有 T1 条目、所有子节点和所有国家。若某个 venue 在默认年份的前两年是某学科的 T1，后两年是 T2，它在这个学科就有两个条目，一个在 T1 下，一个在 T2 下。默认计入的是它前两年的论文，勾选它的 T2 条目后，后两年的论文也会加进来。

# 计数

论文 $p$ 在勾选的子节点 $C$ 上的份额为 $s_C(p) = \sum_{c \in C} s_c(p)$，在主题视图中就是它在该主题上的份额。设 $N(p)$ 为 $p$ 的署名数，$I(a, p)$ 为作者 $a$ 在 $p$ 上所列的机构，$A(p, i)$ 为 $p$ 中列出机构 $i$ 的作者。机构 $i$ 在 $p$ 上的权重，以及它在某个选择下的 Count 为

$$
W(p, i) = \sum_{a \in A(p, i)} \frac{1}{N(p)\,|I(a, p)|}, \qquad
\mathrm{Count}(i) = \sum_{p \in Q} s_C(p)\, W(p, i),
$$

其中 $Q$ 是该选择下计入的论文。每条署名占论文的 $1/N(p)$，再在该作者于这篇论文所列的机构之间平分 [@r4]，Count 因此以论文篇数计。$N(p)$ 包括所有署名，机构列表为空的署名也算在内，因此一篇论文的权重之和等于列出机构的署名所占的比例。

在勾选全部子领域的 {{tier_example.name|raw}} 视图中，示例论文上的每个机构得到其权重 $W$ 乘以论文在该学科的份额。@fig:counting 在一篇有三条署名的小论文上演示权重。作者 a 列出机构 X 和 Y，作者 b 列出 X，作者 c 的机构列表为空。于是 $W(p, X) = 1/6 + 1/3 = 1/2$，$W(p, Y) = 1/6$。论文在勾选子节点上的份额为 0.75 时，它给 X 的 Count 加 0.375，给 Y 的 Count 加 0.125。

::: {#fig:counting .figure .wide}
三位作者的小论文上的分数计数。每位作者占论文的三分之一，在该作者一行标出的机构之间平分，机构的权重 $W$ 是它那一列的和。空列表一行放的是作者 c 的三分之一。表格把 $W$ 换成存储的整数权重 $w$，并对 4 条参考文献中有 3 条在勾选子节点下的论文给出微论文数。
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

个百万分之一篇，其中 $k_c(p)$ 是 $c$ 下各主题的 $k_t(p)$ 之和。在上面的小例子中，$w(p, X) = 500{,}000{,}000$，$w(p, Y) = 166{,}666{,}667$。当 $K = 4$ 且有三条参考文献在子节点 $c$ 下时，$n(p, X, c) = 375{,}000$。Y 的商是 $125{,}000.00025$，取整后 $n(p, Y, c) = 125{,}000$。存储的每个汇总值都恰好是这些整数之和，网站每次重算时都会得到流程的 Count，精确到百万分之一。

# Authors

Authors 估计机构平均每年有多少人在该范围发表论文。它计入所有列出机构的作者，任何署名位次都算，按 ORCID iD 识别和按 OpenAlex 作者 id 识别的人员都计入。

每个人年是一个单位，某人某年在论文集中至少有一条带机构的署名时，这个人年就存在。设 $P(a, y)$ 为人员 $a$ 第 $y$ 年的这些论文。这个单位先在 $P(a, y)$ 上平分，每篇论文分到的部分再在这个人于该论文所列的机构之间平分，最后按论文的份额分到各个主题，

$$
F(i, y, c) = \sum_{a} \sum_{p \in P(a, y)} \frac{\mathbf{1}[i \in I(a, p)]\; s_c(p)}{|P(a, y)|\,|I(a, p)|}.
$$

$F$ 按机构、子节点和年份汇总，并取整到百万分之一人年。选择下的 Authors，是所选各年里勾选子节点上 $F$ 之和的平均值，

$$
\mathrm{Authors}(i) = \frac{1}{y_1 - y_0 + 1} \sum_{y = y_0}^{y_1} \sum_{c \in C} F(i, y, c).
$$

在勾选所有领域的 All 视图中，一年内所有机构的 $F$ 之和在取整误差内等于当年的人年数。在较小的视图中，每个人按其工作落在该视图的部分计入，所以作者投入示例论文的那部分人年，按论文在该学科的份额进入 {{tier_example.name|raw}}。

@fig:faculty 给出一个例子。人员 a 当年有两篇论文，第一篇列 X 和 Y，第二篇列 X，人员 b 只有第一篇，列 X。a 的单位给每篇论文一半，第一篇的一半再分成 X 的四分之一和 Y 的四分之一，b 的整个单位归 X。拆分到主题之前，X 有 1.75 人年，Y 有 0.25 人年，合计两个单位。

::: {#fig:faculty .figure .wide}
小例子上的 Authors 计算。树图把两个人一年的单位先分到各自的论文，再分到他们在每篇论文上的机构。表格按论文的份额把每个机构的合计分给两个子节点，其中 Physics 占论文 1 的四分之三和论文 2 的一半。
:::

# Per author 与 Excess

Per author 等于 Count 除以 Authors。Authors 覆盖论文集中的全部论文，所以一个人的工作进入所选 venue 的比例越高，Per author 越大。Count 在所选年份上累加，Authors 是年均值，所以 Per author 是所选论文的篇数除以平均每年发表论文的人数，年产出相同时，年份范围加倍，它也随之加倍。

Count 随机构规模增长，Per author 则偏向小机构，因为较小的 Authors 值配上几篇论文就能得到很大的比值。Excess 把每个机构与它在该视图中按规模预期的 Count 比较。对视图中 Authors 为正的每个机构，包括 Count 为零的机构，设 $C_i$ 为机构 $i$ 的 Count，$A_i$ 为它的 Authors。Expected 按 $A_i^{\beta}$ 的比例把视图的 Count 总量分给这些机构，Excess 是实际 Count 与 Expected 之差，

$$
\mathrm{Expected}(i) = \frac{A_i^{\beta}}{\sum_j A_j^{\beta}} \sum_j C_j, \qquad
\mathrm{Excess}(i) = C_i - \mathrm{Expected}(i).
$$

指数 $\beta$ 取下式的根，

$$
\frac{\sum_i C_i \ln A_i}{\sum_i C_i} = \frac{\sum_i A_i^{\beta} \ln A_i}{\sum_i A_i^{\beta}},
$$

也就是让按 Count 加权的 $\ln A$ 均值等于按 $A^{\beta}$ 加权的均值的那个值。右边随 $\beta$ 递增，因此根唯一。它就是泊松模型的最大似然拟合，模型中 $\ln \mathrm{Expected}$ 是 $\ln A$ 的线性函数。Excess 的单位是论文篇数，读作机构高于或低于同等规模机构在这个视图中应有水平的篇数。

Excess 在参与拟合的机构上总和为零。拟合始终覆盖视图中的全部机构，国家选择只决定列出哪些行，所以一个机构在世界列表和本国列表里的 Excess 相同。每个选择拟合自己的 $\beta$，多个年份或多个子节点合在一起的 Excess 因此与它们各自 Excess 之和有差别。

默认选择下，All 视图的 $\beta$ 是 {{scaling.rows[view=all].slope|d2}}，拟合了 {{scaling.rows[view=all].n|int}} 个机构，因此一个机构的 Authors 是另一个的两倍时，它的预期 T1 Count 超过后者的两倍。@fig:scaling 画出这一拟合。各学科中，$\beta$ 最低的是 {{scaling.low.name|raw}}，为 {{scaling.low.slope|d2}}，最高的是 {{scaling.high.name|raw}}，为 {{scaling.high.slope|d2}}。在 All 视图中，Excess 最大的是 {{scaling.top.0.name|raw}}，比它 {{scaling.top.0.expected|int}} 篇的 Expected 高出 {{scaling.top.0.excess|int}} 篇。

::: {#fig:scaling .figure .wide}
默认选择下 All 视图的 Count 与 Authors，双对数坐标，机构在 Count 为正的机构中按 Authors 名次等距抽取。直线是 Expected，在这组坐标上的斜率为 $\beta$ = {{scaling.rows[view=all].slope|d2}}。实心点在直线上方，Excess 为正，空心点在直线下方。菱形是按 Authors 每四分之一个数量级分组后的平均 Count，含 Count 为零的机构，横轴下方的条带给出每组中 Count 为零的比例。Authors 低于约 0.3 时，平均 Count 稳定在 0.01 篇左右，位于直线上方，差距在百分之一篇的量级。标出名字的是 Excess 最大的五个机构。第二个面板给出每个视图的 $\beta$，并在 1 处标出参考线。
:::

# 表格

Institutions 表列出国家筛选之后、该选择下 Count 为正的每个机构，显示 Count、Authors、Per author 和 Excess，保留两位小数，Excess 带正负号。表格默认按 Excess 排序，点击其他列的表头就按该列从大到小排序，数值相等的名次相同。旗帜表示 OpenAlex 为该机构记录的国家，选中所有国家时，国家为空的机构也会出现。Count 和 Authors 前各有一个复选框，分别保留该列数值高于列出各行均值的机构。两个复选框默认为空，名次是剩下列表中的位置。

展开机构会列出在其计入论文上得分为正的每个人。某人的得分是 Count 公式中只取此人那一项的结果，即对此人在该机构的计入论文求 $\sum_p s_C(p) / (N(p)\,|I(a, p)|)$。名字取自此人的作者记录，ORCID iD 取作品最多的那条记录，作品数相同时取作者 id 最小的一条，名字链接到 OpenAlex 上的这条记录。

Venues 表列出 Count 为正的每个 venue，并给出它在每个所选年份的档。它的 Count 按所选条目的年份，把该 venue 在勾选子节点上的论文量相加，用的正是分档时那些按子节点计的论文量。Count 前有一个复选框，默认为空，勾选后保留 Count 高于均值的 venue。venue 的旗帜表示 OpenAlex 为其来源记录的国家，通常是出版者所在国。Countries 选择按这个国家筛选这些行，各项数值保持原样。

左侧面板有 Areas、Countries 和 Venues 三个列表，国家按 GeoNames [@r13] 归入各大洲。点击名称会打开该节点并列出其子节点，复选框改变选择。在 Countries 和 Venues 中，复选框作用于其节点下的整棵子树。在 Areas 中，墨色节点是当前视图。勾选路径上的另一个节点，它就成为视图，其子节点全部勾选。勾选某个列出节点而它的上级是另一个节点时，这个上级成为视图，只勾选该节点。视图改变时，每个条目重置为所在档的复选框状态。

# 分档与引用影响

分档来自 venue 之间的引用流，这项检验衡量每一档中单篇论文的引用影响。对每个视图和每一档，检验取 {{validity.window.0|raw}} 至 {{validity.window.1|raw}} 年间、所在 venue 在发表当年属于该视图该档的论文，每篇按其在视图中的份额加权，计算三个比率。

- 被引前 10% 份额，即 OpenAlex 按标准化引用排在前 10% 的论文所占的加权份额 [@r2; @r14]。
- 被引前 1% 份额，按同样方法计算前 1%。
- 平均 FWCI，即 OpenAlex 的学科加权引用影响的加权均值。FWCI 等于作品所得引用除以同类型、同年份、同子领域作品的预期引用 [@r2; @r15]。

覆盖率是三个值齐全的论文所占的加权份额，窗口止于 {{validity.window.1|raw}} 年，让论文有时间积累引用。

在 {{names.fields.17|raw}} 中，被引前 10% 份额在 T1 是 {{validity.rows[view=field/17,tier=1].top10|pct1}}，在 T4 是 {{validity.rows[view=field/17,tier=4].top10|pct1}}。平均 FWCI 由 T1 的 {{validity.rows[view=field/17,tier=1].fwci|d2}} 降到 T4 的 {{validity.rows[view=field/17,tier=4].fwci|d2}}，T1 的覆盖率是 {{validity.rows[view=field/17,tier=1].coverage|pct0}}。在 All 和各学科这全部 {{validity.falls.views|int}} 个视图中，被引前 1% 份额和平均 FWCI 都自 T1 至 T4 逐档下降。被引前 10% 份额在其中 {{validity.falls.top10|int}} 个视图中逐档下降，在 {{names.fields.18|raw}} 中 T2 和 T3 基本持平，分别为 {{validity.rows[view=field/18,tier=2].top10|pct1}} 和 {{validity.rows[view=field/18,tier=3].top10|pct1}}。@fig:validity 给出全部视图。

::: {#fig:validity .figure .wide}
各档的引用影响，All 占一行，每个学科占一行，三列分别是被引前 10% 份额、被引前 1% 份额和平均 FWCI。每个点是一档，按 T1 至 T4 着色，越靠右影响越高。
:::

# 附带发现

构成和集中度覆盖默认年份，国家一节逐年计算 T1 Count。

## 构成

All 视图按每个 venue 的全部产出为它分档，各学科的论文再通过所在 venue 落入这些全局档。@fig:composition 按所在 venue 在 All 视图中的档，拆分每个学科在默认年份内的产出。上游学科的成果被科学中大量研究引用和借鉴。这些学科落在全局 T1 的产出比例最大，依次是 {{upstream.top.0.name|raw}}、{{upstream.top.1.name|raw}} 和 {{upstream.top.2.name|raw}}。{{upstream.bottom.0.name|raw}} 的比例最小，其次是 {{upstream.bottom.1.name|raw}}、{{upstream.bottom.2.name|raw}} 和 {{upstream.bottom.3.name|raw}} 等应用和临床学科。{{t1.year|raw}} 年，All 视图的 T1 包含 {{t1.rows[view=all].venues|int}} 个 venue，占当年带分数产出的 {{t1.rows[view=all].share|pct1}}，其中最大的 {{t1.rows[view=all].venue|raw}} 占这一 T1 的 {{t1.rows[view=all].top|pct1}}。

::: {#fig:composition .figure}
默认年份内按 All 视图的档划分的论文量，All 一条，每个学科一条，按右侧标出的 T1 份额排序。学科的 T1 段是它在 All 视图中属于 T1 的 venue 上的产出。
:::

## 集中度

在 All 视图中，T1 Count 最大的 10 个机构占其 {{concentration[view=all].top10|pct1}}，最大的 100 个占 {{concentration[view=all].top100|pct1}}。在 T1 Count 为正的机构上，基尼系数为 {{concentration[view=all].gini|d2}}，它等于洛伦兹曲线 [@r16] 与对角线之间面积的两倍，@fig:concentration 给出每个学科的同样指标。

::: {#fig:concentration .figure}
All 和各学科 T1 Count 的集中度，范围是 T1 Count 为正的机构。第一个面板在对数坐标轴上给出最大的那些机构占 T1 Count 的份额与它们在机构中所占比例的关系，曲线越高，Count 越集中。第二个面板给出最大的 10 个和 100 个机构的份额。
:::

## 国家

国家份额按机构所属国家拆分 All 视图的 T1 Count，逐年计算。United States 的份额由 {{years.0|raw}} 年的 {{countries.series[country=US].share.0|pct1}} 降到 {{years.1|raw}} 年的 {{countries.series[country=US].share.21|pct1}}。同期 China 的份额由 {{countries.series[country=CN].share.0|pct1}} 升到 {{countries.series[country=CN].share.21|pct1}}。@fig:countries 画出 {{years.1|raw}} 年份额最大的几个国家、其他所有国家的合计，以及国家为空的机构。

::: {#fig:countries .figure}
按国家和年份的 T1 Count 份额，每个国家一条线，其他国家合计和国家为空的机构是两条虚线。这段时间份额变化最大的两个国家用黑色和蓝色画出。
:::

# 网站如何运行

网站是静态页面，用 HTTP Range 请求从静态存储读取 Parquet 文件 [@r18]，取文件中需要的部分。每次构建读取一个数据版本，以 SHA-256 摘要的前 16 位十六进制数命名，摘要涵盖流程的代码、配置和各项输入的标识。

数据版本包含主题层级、机构和 venue 的名称与国家、每个 venue 每年的分数，以及每个视图的三个文件。第一个文件按年份和子节点给出每个 venue 的档和论文量。另外两个文件按机构和子节点存放 Count 和 Authors 的累计值，以百万分之一为单位，从 {{years.0|raw}} 年累计到每一年，Count 还按档分开。从 $y_0$ 到 $y_1$ 的选择读取 $y_1$ 和 $y_0 - 1$ 的累计值再相减，每个勾选的档读两个行组，Authors 也读两个。视图的汇总值一次全部加载，因为排名和 Excess 的拟合都需要所有机构。

数据包每篇论文一行。某个条目的复选框与所在档的复选框状态相反时，Count 会在某些年份增减一个 venue 的论文，所以网站加载该 venue 这些年份的数据包，重新算出整数 $n(p, i, c)$ 并加上或减去。乘积 $k_c(p)\, w(p, i)$ 始终小于 $2^{53}$，浏览器的双精度运算因此与流程得到相同的商和相同的取整。展开机构会加载它在所选年份的数据包。

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

[r18] Apache Parquet. File format. <https://parquet.apache.org/docs/file-format/>
:::
