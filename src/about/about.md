---
title: How AllRankings works
author: clareLab
abstract: |
  AllRankings ranks research institutions in every area of science by their papers in the strongest venues of that area. This text follows one real paper through each step that turns it into the numbers on the site. The paper is split among areas by the primary topics of the works it cites. Each area orders its venues by their Open Scholar Ranking score, a measure built on citation flows between venues, and T1 holds the strongest venues, which together publish about a twenty-seventh of the area's papers. Count adds up an institution's fractional credit for the papers in the selected tiers and years, and Authors estimates how many of its people publish in the area in an average year. The table ranks institutions by Excess, their Count minus the Count expected at their size from a power law in Authors fitted to the whole area. In all {{validity.falls.views|int}} areas tested, papers in a higher tier have a higher mean field-weighted citation impact and are more often among the most cited 1%. They are more often among the most cited 10% in {{validity.falls.top10|int}} of the {{validity.falls.views|int}} areas. This is the main evidence that the tiers carry meaning.
---

# Introduction

AllRankings, at <https://ar.clarelab.moe>, ranks research institutions by their papers in selected venues, in every area of science. It follows CSRankings [@r3], which ranks computer science departments by their papers at a hand-picked list of selective conferences and splits each paper's credit evenly across its co-authors. To cover every area, AllRankings picks the venues by a fixed rule on citation-based venue scores and paper volume, places each paper in areas through the works it cites, and passes credit to institutions by fractional counting over authors and their listed institutions, as the Leiden Ranking does for whole universities [@r4; @r5].

An area is a node of the OpenAlex topic hierarchy [@r1; @r2], which has {{corpus.levels.domains|int}} domains, {{corpus.levels.fields|int}} fields, {{corpus.levels.subfields|int}} subfields and {{corpus.levels.topics|int}} topics. The site calls the whole of science All and each node a view. The children of All are the domains, the children of a domain are its fields, and so on down to the topics, which are the leaves.

The sections below follow one paper through the rules that turn its references into Count at an institution. They then define Authors, Per author and Excess, describe the tables and test the tiers against citation impact. Side findings and a short account of how the site runs close the text, and every number and figure comes from the data release named under the title.

# The paper set

The source is the OpenAlex snapshot of {{snapshot|raw}} [@r1]. AllRankings takes the papers that meet five conditions.

- Published from {{years.0|raw}} to {{years.1|raw}}.
- Of type article, review or conference-paper.
- In a venue with an Open Scholar Ranking score in at least one of these years.
- Free of the retraction and paratext flags of OpenAlex.
- Citing at least one work with a primary topic, read from the 1990 to 2025 works of the main OpenAlex corpus [@r2].

A venue is an OpenAlex source, and a paper belongs to the venue of its primary location and to its publication year. OSR scores journal and conference sources, so proceedings that OpenAlex files as book series, such as Lecture Notes in Computer Science, fall outside the set. OpenAlex sometimes splits one conference across several source records, each then scored and tiered on its own. Its records of NeurIPS, ICML and ICLR hold a small share of these conferences' papers, and the ACL record covers part of its years. Every paper of the set counts towards Authors, and a paper enters the tiers and Count in the years its venue has a score.

The set holds {{corpus.papers|int}} papers in {{corpus.venues|int}} venues. Their authorships name {{corpus.people|int}} people with a listed institution, at {{corpus.institutions|int}} institutions, and {{corpus.people_orcid|int}} of these people have an ORCID iD. Together the papers make {{corpus.references|int}} references to works with a primary topic.

An authorship pairs an author with the institutions listed for that author on the paper at publication, so each paper stays with the institutions its authors named at the time. A person is an ORCID iD [@r6] when the OpenAlex author record has one and the OpenAlex author id otherwise, so author records that share an ORCID iD form one person.

# Topic shares

OpenAlex gives each work up to three topics from a classifier, best first, and the first is the primary topic [@r2; @r7]. AllRankings places a paper by the primary topics of the works it cites. Let $K(p)$ be the number of references of paper $p$ whose cited work has a primary topic, and $k_t(p)$ the number of those whose primary topic is $t$. The share of $p$ in topic $t$ and in any node $n$ of the hierarchy is

$$
s_t(p) = \frac{k_t(p)}{K(p)}, \qquad s_n(p) = \sum_{t \in n} s_t(p),
$$

where $t \in n$ runs over the topics under $n$. Each topic sits in one subfield, each subfield in one field and each field in one domain, so shares add up the hierarchy and a paper's share in All is 1.

The paper this text follows is ‘{{example.title|raw}}’, published in the {{example.venue|raw}} in {{example.year|raw}}. The pipeline picks it by a fixed rule: a paper of {{example.year|raw}} in a venue that is T1 in {{tier_example.name|raw}} that year, whose moderate reference list places at least half of the paper in that field and reaches several subfields. Of its {{example.references|int}} references, {{example.K|int}} cite works with a primary topic, so $K$ is {{example.K|int}}. The largest group, {{example.largest.k|int}} references, cites works in {{example.largest.name|raw}} and gives the paper a share of {{example.largest.k|int}}/{{example.K|int}} in that topic.

@fig:apportion sums these units up the hierarchy. The paper lies mostly in {{tier_example.name|raw}}, with {{example.fields[field=17].k|int}} of the {{example.K|int}} references, so it counts in that field with a share of {{example.fields[field=17].k|int}}/{{example.K|int}}. Its other references reach further fields, led by {{example.fields.1.name|raw}} with {{example.fields.1.k|int}} and {{example.fields.2.name|raw}} with {{example.fields.2.k|int}}. The later sections follow the paper in {{tier_example.name|raw}}.

::: {#fig:apportion .figure .wide}
The example paper split by its references. Each reference with a primary topic is one unit, and the four columns sum the units by topic, subfield, field and domain. Beside each node stand its count $k$ and a bar for its share $k/K$, and lines lead each node to its parent. The path through {{tier_example.name|raw}} is the one the later sections follow.
:::

# Venue scores

Venue scores come from Open Scholar Ranking (OSR) [@r8], at <https://osr.clarelab.moe>. OSR fits a Bradley-Terry model [@r9] to citation flows between venues, in the line of Stigler [@r10] and Varin and colleagues [@r11], with a random walk over years as in dynamic Bradley-Terry models [@r12]. A citation flows from the citing work's source to the cited work's source in the citing work's publication year. Let $m_{ij,t}$ be the citations from venue $i$ to venue $j$ in year $t$, $R_{i,t}$ all citations venue $i$ makes to other venues in year $t$, and $B_{i,t}$ its citable stock, defined below. Given the pair total, the model is

$$
m_{ij,t} \sim \operatorname{Binomial}\!\left(m_{ij,t} + m_{ji,t},\; \pi_{ij,t}\right),
\qquad \pi_{ij,t} = \sigma\!\left(\log \frac{R_{i,t}\, B_{j,t}}{R_{j,t}\, B_{i,t}} + \varphi_{j,t} - \varphi_{i,t}\right),
$$

where $\sigma(x) = 1/(1 + e^{-x})$ is the logistic function and $\varphi_{i,t} - \varphi_{i,t-1}$ is normal with mean zero. A venue with higher $\varphi$ draws more of the citations it exchanges with other venues, after allowing for how much each side cites and how much it offers to be cited, and the scores for year $t$ come from a fit on the years from 2004 to $t$. A cited venue offers its whole back catalogue, so the citable stock counts the works of every earlier year, each weighted by how often works of that age are cited:

$$
B_{v,t} = \sum_{t' \le t} Q_{v,t'}\, g(t - t'),
$$

where $Q_{v,t'}$ is the number of eligible works venue $v$ published in year $t'$ and $g(k)$ is the mean number of citations a work receives at age $k$. It sums, over the citing years from 2004 to 2025, the citations to works published $k$ years earlier, and divides by the eligible works published $k$ years before each of those years. The published score is

$$
S_{v,t} = \sigma\!\left(\varphi_{v,t} - \tilde\varphi_t\right),
$$

where $\tilde\varphi_t$ is the median $\varphi$ of the venues OSR ranks in year $t$, so $S_{v,t}$ is the chance that a citation between $v$ and a median venue goes to $v$ once citing volume and stock are allowed for.

AllRankings orders venues by $\varphi$ and shows $S$. It uses every venue-year that OSR scores, which includes the venues of its citation core beyond each year's published ranking. The Venues table shows each venue's score in the last selected year to four decimals, as OSR does.

# Tiers

Every view at every level of the hierarchy sets its own tiers for each year from its own papers. The mass of venue $v$ in view $n$ and year $y$ adds up each paper's share in every child $c$ of $n$, over the venue's papers of that year,

$$
M_{v,y}(n) = \sum_{p \in v,\; y(p) = y} \; \sum_{c} s_c(p),
$$

with each child's share counted in millionths of a paper before the sum, and a topic view takes the share in its topic. The pool holds the venues with a score in year $y$ and a positive mass in the view, ordered by $\varphi$ from the highest, with ties going to the lower OpenAlex source id. Let $M_1, \dots, M_m$ be the masses in this order and $T = \sum_r M_r$ the view's scored output in that year. The midpoint of venue $r$ is the mass before it plus half its own,

$$
c_r = \sum_{q < r} M_q + \frac{M_r}{2},
$$

and its tier is

$$
\tau_r =
\begin{cases}
1 & \text{if } c_r \le T/27, \\
2 & \text{if } T/27 < c_r \le T/9, \\
3 & \text{if } T/9 < c_r \le T/3, \\
4 & \text{otherwise.}
\end{cases}
$$

The rule walks down the pool from the strongest venue, cuts the view's output at one twenty-seventh, one ninth and one third, and places each venue by where the middle of its own papers falls. T1 thus holds about a twenty-seventh of the view's scored output, the first two tiers about a ninth and the first three about a third. In a pool of 30 venues of equal mass the first venue is T1, the next two are T2, the next seven T3 and the rest T4, and when the venues at the top carry more mass the upper tiers hold fewer venues.

A venue holds a tier in every view where it has papers that year, so the top tiers of a field include general journals and strong journals of other areas whose papers reach the field. The same venue can be T1 in one field and T3 in another, and it can change tier from year to year.

@fig:tiers applies the rule to {{tier_example.name|raw}} in {{tier_example.year|raw}}, where the pool holds {{tier_example.pool|int}} venues with a mass of {{tier_example.mass|int}} papers. Along the $\varphi$ order T1 ends at rank {{tier_example.cuts.0|int}}, T2 at rank {{tier_example.cuts.1|int}} and T3 at rank {{tier_example.cuts.2|int}}. The order opens with strong journals of other areas, led by {{tier_example.lead.name|raw}} with a mass of {{tier_example.lead.mass|d1}} papers in the field. The {{tier_example.heavy|int}} largest of the {{tier_example.cuts.0|int}} T1 venues hold {{tier_example.heavy_share|pct1}} of the T1 mass, and the largest alone holds {{t1.rows[view=field/17].top|pct1}}. Together the T1 venues hold {{t1.rows[view=field/17].share|pct1}} of the field's scored output, close to a twenty-seventh. The {{example.venue|raw}} is among them, so the example paper counts in {{tier_example.name|raw}} under the default selection with its share of {{example.fields[field=17].k|int}}/{{example.K|int}}.

::: {#fig:tiers .figure .wide}
The tier rule on the pool of {{tier_example.name|raw}} in {{tier_example.year|raw}}. Venues run in $\varphi$ order along a logarithmic axis, and the curve is the running share of the pool's mass, coloured by tier. Each tier ends where the curve crosses the lines at 1/27, 1/9 and 1/3, and the key gives the number of venues in each tier. The list names the T1 venues with the largest mass, with their rank in this order, $\varphi$ and mass.
:::

# Selection

A selection in a view has four parts.

- Years from $y_0$ to $y_1$ within {{years.0|raw}} to {{years.1|raw}}, by default {{default_years.0|raw}} to {{default_years.1|raw}}.
- A set $L$ of listings, each a pair of a tier and a venue. The Venues list shows each venue under every tier it holds in the view in the selected years, with one checkbox per listing, and checking a tier checks all its listings.
- The checked children of the view. A topic view counts its own topic.
- The selected countries, by default all of them.

A paper $p$ of venue $v$ published in year $y$ counts if and only if $y_0 \le y \le y_1$ and $(\tau(v, y), v) \in L$, where $\tau(v, y)$ is the tier of $v$ in this view in year $y$. The default selects every T1 listing, every child and every country. A venue that is T1 in a field in the first two default years and T2 in the last two has two listings there, one under T1 and one under T2. By default its papers from the first two years count, and checking its T2 listing adds the later ones.

# Counting

The share of paper $p$ in the checked children $C$ is $s_C(p) = \sum_{c \in C} s_c(p)$, and in a topic view it is the share in the topic. Let $N(p)$ be the number of authorships on $p$, $I(a, p)$ the institutions listed for author $a$ on $p$, and $A(p, i)$ the authors of $p$ who list institution $i$. The weight of institution $i$ on $p$ and its Count under a selection are

$$
W(p, i) = \sum_{a \in A(p, i)} \frac{1}{N(p)\,|I(a, p)|}, \qquad
\mathrm{Count}(i) = \sum_{p \text{ counted}} s_C(p)\, W(p, i).
$$

Each authorship carries $1/N(p)$ of the paper, split evenly over the author's institutions on the paper [@r4], and Count is a number of papers. $N(p)$ counts every authorship, including those with an empty list of institutions, so a paper's weights add up to the share of its authorships that list an institution.

In the {{tier_example.name|raw}} view with every subfield checked, each institution on the example paper gains its weight $W$ times the paper's share in the field. @fig:counting works the weights on a small paper with three authorships. Author a lists institutions X and Y, author b lists X, and the list of author c is empty. Then $W(p, X) = 1/6 + 1/3 = 1/2$ and $W(p, Y) = 1/6$. With a share of 0.75 in the checked children, the paper adds 0.375 to the Count of X and 0.125 to the Count of Y.

::: {#fig:counting .figure .wide}
Fractional counting on a paper with three authors. Each author holds one third of the paper, split evenly over the institutions marked in that author's row, and the weight $W$ of an institution is the sum of its column. The row Empty list holds the third of author c. The table carries $W$ into the stored integer weight $w$ and the micro-papers for a paper with 3 of its 4 references under the checked children.
:::

## Exact arithmetic

Count is computed in integers. Write $[x]$ for $x$ rounded to the nearest integer, halves away from zero. The pipeline stores

$$
w(p, i) = \left[10^9\, W(p, i)\right]
$$

and the contribution of $p$ to institution $i$ in child $c$ is

$$
n(p, i, c) = \left[\frac{k_c(p)\, w(p, i)}{1000\, K(p)}\right]
$$

millionths of a paper, where $k_c(p)$ is the sum of $k_t(p)$ over the topics under $c$. In the small example $w(p, X) = 500{,}000{,}000$ and $w(p, Y) = 166{,}666{,}667$. With $K = 4$ and three references under a child $c$, $n(p, X, c) = 375{,}000$. For Y the quotient $125{,}000.00025$ rounds to $n(p, Y, c) = 125{,}000$. Every stored aggregate is a sum of exactly these integers, so the site reaches the pipeline's Count to the millionth whenever it recomputes them.

# Authors

Authors estimates how many people at an institution publish in the area in an average year. It counts every author who lists an institution, in any position, whether known by an ORCID iD or by an OpenAlex author id.

Each person-year is one unit, and a person-year exists when a person has at least one authorship with an institution on a paper of the set in that year. Let $P(a, y)$ be those papers of person $a$ in year $y$. The unit is split evenly over $P(a, y)$, each paper's part evenly over the person's institutions on that paper, and then over topics by the paper's shares:

$$
F(i, y, c) = \sum_{a} \sum_{p \in P(a, y)} \frac{\mathbf{1}[i \in I(a, p)]\; s_c(p)}{|P(a, y)|\,|I(a, p)|}.
$$

$F$ is summed per institution, child and year and rounded to millionths of a person-year. Authors for a selection is the mean over the selected years of the sum over the checked children,

$$
\mathrm{Authors}(i) = \frac{1}{y_1 - y_0 + 1} \sum_{y = y_0}^{y_1} \sum_{c \in C} F(i, y, c).
$$

In the All view with every domain checked, one year's $F$ adds up over all institutions to that year's number of person-years, up to rounding. In a smaller view each person counts with the part of their work that falls in the view, so the part of a person-year that an author gives to the example paper reaches {{tier_example.name|raw}} with the paper's share in that field.

@fig:faculty works an example. Person a has two papers in the year and lists X and Y on the first and X on the second, while person b has the first paper alone and lists X. The unit of a gives half to each paper, and on the first paper that half splits into a quarter for X and a quarter for Y, while the whole unit of b goes to X. Before the topic split X holds 1.75 person-years and Y holds 0.25, two units in all.

::: {#fig:faculty .figure .wide}
Authors on a small example. The tree splits the units of two people in one year over their papers and then over their institutions on each paper. The table divides each institution's total between two children by the papers' shares, three quarters of paper 1 and half of paper 2 in Physics.
:::

# Per author and Excess

Per author is Count divided by Authors. Authors covers every paper of the set, so Per author grows with the share of a person's work that reaches the selected venues. Count adds up over the selected years and Authors is a yearly mean, so Per author gives the selection's papers per person publishing in an average year, and doubling the range at the same yearly output doubles it.

Count grows with the size of an institution, and Per author favours small institutions, where a few papers over a small Authors value make a large ratio. Excess compares each institution with the Count expected at its size in the view. Let $C_i$ be the Count and $A_i$ the Authors of institution $i$, over every institution of the view with positive Authors, those with zero Count included. Expected splits the view's total Count among them in proportion to $A_i^{\beta}$, and Excess is the remainder:

$$
\mathrm{Expected}(i) = \frac{A_i^{\beta}}{\sum_j A_j^{\beta}} \sum_j C_j, \qquad
\mathrm{Excess}(i) = C_i - \mathrm{Expected}(i).
$$

The exponent $\beta$ is the root of

$$
\frac{\sum_i C_i \ln A_i}{\sum_i C_i} = \frac{\sum_i A_i^{\beta} \ln A_i}{\sum_i A_i^{\beta}},
$$

the value at which the Count-weighted mean of $\ln A$ equals the $A^{\beta}$-weighted mean. The right side rises with $\beta$, so the root is unique. It is the maximum-likelihood fit of a Poisson model in which $\ln \mathrm{Expected}$ is linear in $\ln A$. Excess is in papers, read as the papers above or below what an institution of that size reaches in this view.

Excess sums to zero over the institutions of the fit. The fit takes in every institution of the view whatever the countries selected, so an institution has the same Excess in the world list and in its own country's list. Each selection fits its own $\beta$, so Excess over several years or several children differs from the sum of their separate values.

At the default selection $\beta$ is {{scaling.rows[view=all].slope|d2}} in All, over {{scaling.rows[view=all].n|int}} institutions, so an institution with twice the Authors of another is expected to reach more than twice its T1 Count. @fig:scaling draws the fit. Among the fields $\beta$ is lowest in {{scaling.low.name|raw}}, at {{scaling.low.slope|d2}}, and highest in {{scaling.high.name|raw}}, at {{scaling.high.slope|d2}}. In All, {{scaling.top.0.name|raw}} has the largest Excess, {{scaling.top.0.excess|int}} papers above its Expected of {{scaling.top.0.expected|int}}.

::: {#fig:scaling .figure .wide}
Count against Authors in All at the default selection, on logarithmic axes, for institutions taken at even steps of Authors rank among those with positive Count. The line is Expected, with slope $\beta$ = {{scaling.rows[view=all].slope|d2}} on these axes. Filled points lie above it and have positive Excess, and open points lie below it. The diamonds give the mean Count in bins of a quarter decade of Authors, zero Count included, and the strip under the axis gives the share of each bin with zero Count. Below about 0.3 authors the mean Count levels off near 0.01 papers and lies above the line by hundredths of a paper. The labelled points are the five institutions with the largest Excess. The second panel gives $\beta$ for each view, with a mark at 1.
:::

# The tables

The Institutions table lists every institution with a positive Count under the selection, after the country filter, with Count, Authors, Per author and Excess to two decimals and Excess signed. It sorts by Excess by default. Clicking another column header sorts by that column, largest first, and equal values share a rank. The flag shows the country OpenAlex records for the institution, and institutions with a blank country appear when every country is selected. A box before Count and one before Authors each keep the institutions above that column's mean over the listed rows. Both boxes start empty, and ranks are positions in the list that remains.

Expanding an institution lists every person with positive credit on its counted papers. A person's credit is the Count formula with that person's term alone, $\sum_p s_C(p) / (N(p)\,|I(a, p)|)$ over the person's counted papers at the institution. The name comes from the person's author record, for an ORCID iD the record with the most works and ties to the lowest author id. An icon in the place of an institution's flag links to that record on OpenAlex. A person expands in turn to the venues of their papers at that institution, with their credit in each venue.

The Venues table lists each venue with a positive Count in three columns. Tier gives its tier in each selected year and Score its score in the last selected year. Count adds up the venue's mass in the checked children over the years of its selected listings, the same per-child masses the tiers use. The table sorts by Count, and a click on Score sorts it by score from the highest, with unscored venues last. A box before Count, empty by default, keeps the venues above the mean Count. Expanding a venue lists the institutions with papers in it under the selection, after the country filter, and one of these institutions expands to its authors in that venue. A venue's flag shows the country OpenAlex records for its source, often the publisher's. The table keeps a venue when an institution of a selected country has papers in it under the selection. Its Count still sums over every country, and the mean and the ranks run over the venues kept.

The left panel holds three lists, Areas, Countries and Venues, with countries grouped by continent following GeoNames [@r13]. A click on a name opens that node and lists its children, and the checkboxes change the selection. In Countries and Venues a checkbox covers the whole subtree under its node. In Areas the view is the node in ink. Checking another node on the path makes it the view with every child checked, and checking a listed node under any other parent makes that parent the view with that node alone checked. A change of view resets every listing to its tier's checkbox. The figure at the right of each row is a share in the selected years. In Countries it is the country's share of the view's Count under the selection, over every country whatever the Countries selection. In Areas it is the node's share of all its parent's papers in the selected listings. In Venues it is the venue's share of its tier's papers in the checked children, and for a tier its share of all four tiers. Shares show two significant figures, and those below 0.01% read <0.01%. In search results the Venues list gives each venue's tier in that place.

Two icons at the right of the top bar save the view. The table icon writes the open table to a CSV file with every row and each row's country. The poster icon builds a poster of the view under the current selection in the browser and saves a zip with the poster as a PNG of 7200 by 9600 pixels, as an SVG and as a PDF of 5400 by 7200 points with vector text and shapes. The poster gives the date it was made, the OpenAlex snapshot and the release.

# Tiers and citation impact

The tiers come from citation flows between venues, and this test measures the citation impact of the single papers in each tier. For each view and tier it takes the papers from {{validity.window.0|raw}} to {{validity.window.1|raw}} whose venue held that tier in the view in the paper's year, weights each by its share in the view and computes three rates.

- Top 10% share: the weighted share of papers that OpenAlex places in the top 10% by normalised citations [@r2; @r14].
- Top 1% share: the same for the top 1%.
- Mean FWCI: the weighted mean of OpenAlex's field-weighted citation impact, citations received over citations expected for works of the same type, year and subfield [@r2; @r15].

Coverage is the weighted share of papers with all three values, and the window ends in {{validity.window.1|raw}} so that the papers have had time to collect citations.

In {{names.fields.17|raw}} the top 10% share is {{validity.rows[view=field/17,tier=1].top10|pct1}} in T1 and {{validity.rows[view=field/17,tier=4].top10|pct1}} in T4. Mean FWCI drops from {{validity.rows[view=field/17,tier=1].fwci|d2}} in T1 to {{validity.rows[view=field/17,tier=4].fwci|d2}} in T4, with a coverage of {{validity.rows[view=field/17,tier=1].coverage|pct0}} in T1. The top 1% share and the mean FWCI fall at every step from T1 to T4 in all {{validity.falls.views|int}} views, All and each field. The top 10% share does so in {{validity.falls.top10|int}} of them, and in {{names.fields.18|raw}} its values for T2 and T3 are level, at {{validity.rows[view=field/18,tier=2].top10|pct1}} and {{validity.rows[view=field/18,tier=3].top10|pct1}}. @fig:validity shows every one of them.

::: {#fig:validity .figure .wide}
Citation impact by tier, one row for All and one per field, with one panel each for the top 10% share, the top 1% share and the mean FWCI. Each dot is one tier, coloured from T1 to T4, and dots further right mean higher impact.
:::

# Side findings

Composition and Concentration cover the default years, and Countries follows T1 Count one year at a time.

## Composition

The All view tiers every venue by its whole output, and each field's papers fall into these global tiers through their venues. @fig:composition splits each field's output over the default years by the All view's tier of its venues. Upstream fields, whose work much of science cites and builds on, place the largest parts of their output in the global T1, led by {{upstream.top.0.name|raw}}, {{upstream.top.1.name|raw}} and {{upstream.top.2.name|raw}}. {{upstream.bottom.0.name|raw}} places the smallest part there, followed by applied and clinical fields such as {{upstream.bottom.1.name|raw}}, {{upstream.bottom.2.name|raw}} and {{upstream.bottom.3.name|raw}}. In {{t1.year|raw}} the T1 of All spans {{t1.rows[view=all].venues|int}} venues with {{t1.rows[view=all].share|pct1}} of the year's scored output, and its largest venue, {{t1.rows[view=all].venue|raw}}, holds {{t1.rows[view=all].top|pct1}} of that T1.

::: {#fig:composition .figure}
Paper mass by the All view's tier over the default years, one bar for All and one per field, ordered by the T1 share given at the right. A field's T1 segment is the part of its output in venues that are T1 in All.
:::

## Concentration

In All the 10 institutions with the largest T1 Count hold {{concentration[view=all].top10|pct1}} of it and the 100 largest hold {{concentration[view=all].top100|pct1}}. Over the institutions with positive T1 Count the Gini coefficient, twice the area between the Lorenz curve [@r16] and the diagonal, is {{concentration[view=all].gini|d2}}, and @fig:concentration draws the same measures for every field.

::: {#fig:concentration .figure}
Concentration of T1 Count for All and each field, over the institutions with positive T1 Count. The first panel gives the share of T1 Count held by the largest institutions against the share of institutions they make up, on a logarithmic axis, and a higher curve means a more concentrated Count. The second panel gives the shares of the 10 and 100 largest institutions.
:::

## Countries

Country shares split T1 Count in All by the country of each institution, year by year. The share of the United States fell from {{countries.series[country=US].share.0|pct1}} in {{years.0|raw}} to {{countries.series[country=US].share.21|pct1}} in {{years.1|raw}}. China's share rose over the same years from {{countries.series[country=CN].share.0|pct1}} to {{countries.series[country=CN].share.21|pct1}}. @fig:countries draws the largest countries of {{years.1|raw}}, all other countries together and the institutions with a blank country.

::: {#fig:countries .figure}
Share of T1 Count by country and year, one line per country, with all other countries and the institutions with a blank country as two dashed lines. The two countries whose shares move most over the period are drawn in black and blue.
:::

# How the site runs

The site is a static page that reads Parquet files [@r18] from a static store with HTTP Range requests, fetching the parts of a file it needs. Each site build reads one release, named by the first 16 hexadecimal digits of a SHA-256 digest over the pipeline's code, its configuration and the identities of its inputs.

A release holds the hierarchy, the names and countries of institutions and venues, each venue's score per year and three files per view. The first gives each venue's tier and mass per year and child. The other two hold running totals of Count and Authors in millionths from {{years.0|raw}} to each year, per institution and child and for Count also per tier. A selection from $y_0$ to $y_1$ reads the totals for $y_1$ and $y_0 - 1$ and subtracts, two row groups per checked tier and two for Authors. The view's aggregates load at once, because the ranking and the fit of Excess need every institution.

The bundles hold one row per paper. A listing whose checkbox differs from its tier's changes Count by one venue's papers in some years, so the site loads that venue's bundle for those years, recomputes the integers $n(p, i, c)$ and adds or subtracts them. The product $k_c(p)\, w(p, i)$ stays below $2^{53}$, so the browser's double precision and the pipeline reach the same quotient and the same rounding. Expanding an institution loads its bundle for the selected years.

Before each deploy a check runs the site's own data code in Bun against the local release. For a fixed set of selections it compares the Count the site would show with a separate recomputation from the bundles, exactly to the millionth, and any mismatch stops the deploy.

# Citing AllRankings {-}

Rankings change with each release, so a citation names the release shown under the title. A ranking taken from the site also gives its address, which records the selection, and the date it was read.

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

# References {-}

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
