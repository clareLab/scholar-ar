---
title: How AllRankings works
author: clareLab
abstract: |
  AllRankings ranks research institutions in every area of science by their papers in the strongest venues of that area. This text follows one real paper through each step that turns it into Count, the number an institution is ranked by. The paper is split among areas by the primary topics of the works it cites. Its journal takes a tier in each area and year by a fixed rule: the area's venues are ordered by their Open Scholar Ranking score, which comes from citation flows between venues, and T1 holds the strongest of them, which together publish about a twenty-seventh of the area's papers. Its credit is split among its authors and their institutions, exact to one millionth of a paper. Authors estimates how many people at an institution publish in the area in an average year, and Per author divides Count by it. Papers in a higher tier are more often among the most cited 10% and 1% than those in the tier below, and their mean field-weighted citation impact is higher. This holds in {{validity.falls.every|int}} of the {{validity.falls.views|int}} areas tested, All and each field, and it is the main evidence that the tiers carry meaning.
---

# Introduction

AllRankings, at <https://ar.clarelab.moe>, ranks research institutions by the papers they publish in selected venues, in every area of science. Its model is CSRankings [@r3], which ranks computer science departments by their papers at a hand-picked list of selective conferences and splits each paper's credit evenly across its co-authors. Bibliometric rankings such as the Leiden Ranking [@r5] count papers and citations across whole universities. AllRankings keeps the CSRankings idea of counting papers at selective venues. To extend it to every area, it lets a fixed rule on citation-based venue scores and paper volume pick the venues, places each paper in areas through the works it cites, and passes credit to institutions by fractional counting over authors and their listed institutions [@r4; @r5].

An area is a node of the OpenAlex topic hierarchy [@r1; @r2], which has {{corpus.levels.domains|int}} domains, {{corpus.levels.fields|int}} fields, {{corpus.levels.subfields|int}} subfields and {{corpus.levels.topics|int}} topics. The site calls the whole of science All and each node a view. The children of All are the domains, the children of a domain are its fields, and so on down to the topics, which are the leaves.

The sections below follow one paper through each rule that turns its references into Count at an institution, with equations and figures where they help. A test of the tiers against citation impact comes next, then a set of side findings and a short account of how the site runs. Every number and figure comes from the data release named under the title.

# The paper set

The source is the OpenAlex snapshot of {{snapshot|raw}} [@r1]. AllRankings takes the papers that meet five conditions.

- Published from {{years.0|raw}} to {{years.1|raw}}.
- Of type article, review or conference-paper.
- In a venue with an Open Scholar Ranking score in at least one of these years.
- Clear of the retraction and paratext flags of OpenAlex.
- Citing at least one work with a primary topic, where primary topics come from the works of 1990 to 2025 outside the OpenAlex expansion corpus [@r2].

A venue is an OpenAlex source, and a paper belongs to the venue of its primary location and to its publication year. OpenAlex sometimes splits one conference across several source records, and each record is then scored and tiered on its own with its own share of the papers. Proceedings that OpenAlex files as book series, such as Lecture Notes in Computer Science, sit outside the set, since OSR scores journal and conference sources. The OpenAlex records of NeurIPS, ICML and ICLR hold few papers, and the ACL record lacks many years. Every paper of the set counts towards Authors, and a paper takes part in the tiers and in Count when its venue has a score in the paper's year.

The set holds {{corpus.papers|int}} papers in {{corpus.venues|int}} venues. Their authorships name {{corpus.people|int}} people with a listed institution, at {{corpus.institutions|int}} institutions, and {{corpus.people_orcid|int}} of these people have an ORCID iD. Together the papers make {{corpus.references|int}} references to works with a primary topic.

An authorship pairs an author with the institutions listed for that author on the paper, as given at publication, so each paper stays with the institutions its authors named at the time. A person is an ORCID iD [@r6] when the OpenAlex author record has one and the OpenAlex author id otherwise, so author records that share an ORCID iD form one person.

# Topic shares

OpenAlex gives each work up to three topics from a classifier, best first, and the first is the primary topic [@r2; @r7]. AllRankings places a paper by the primary topics of the works it cites. Let $K(p)$ be the number of references of paper $p$ whose cited work has a primary topic, and $k_t(p)$ the number of those whose primary topic is $t$. The share of $p$ in topic $t$ and in any node $n$ of the hierarchy is

$$
s_t(p) = \frac{k_t(p)}{K(p)}, \qquad s_n(p) = \sum_{t \in n} s_t(p),
$$

where $t \in n$ runs over the topics under $n$. Every topic has one subfield, every subfield one field and every field one domain, so shares add up the hierarchy and a paper's share in All is 1.

The paper this text follows is ‘{{example.title|raw}}’, published in the {{example.venue|raw}} in {{example.year|raw}}. The pipeline picks it by a fixed rule: a paper of {{example.year|raw}} in a venue that is T1 in {{tier_example.name|raw}} that year, with a moderate reference list that places at least half of the paper in that field and reaches several subfields. Of its {{example.references|int}} references, {{example.K|int}} cite works with a primary topic, so $K$ is {{example.K|int}}. The largest group, {{example.largest.k|int}} references, cites works in {{example.largest.name|raw}}, which gives the paper a share of {{example.largest.k|int}}/{{example.K|int}} in that topic.

@fig:apportion sums the units up the hierarchy. The paper lies mostly in {{tier_example.name|raw}}, with {{example.fields[field=17].k|int}} of the {{example.K|int}} references, and counts in that field with a share of {{example.fields[field=17].k|int}}/{{example.K|int}}. Its other references go to further fields, led by {{example.fields.1.name|raw}} with {{example.fields.1.k|int}} and {{example.fields.2.name|raw}} with {{example.fields.2.k|int}}. The later sections follow the paper in {{tier_example.name|raw}}.

::: {#fig:apportion .figure .wide}
The example paper split by its references. Each reference with a primary topic is one unit, and the columns sum the units by topic, subfield, field and domain. The number beside a node is its count $k$, its bar is its share $k/K$, and the lines lead each node to its parent.
:::

# Venue scores

Venue scores come from Open Scholar Ranking (OSR) [@r8], at <https://osr.clarelab.moe>. OSR fits a Bradley-Terry model [@r9] to citation flows between venues, in the line of Stigler [@r10] and Varin and colleagues [@r11], with a random walk over years as in dynamic Bradley-Terry models [@r12]. In OSR a citation is a distinct pair of a citing and a cited research work, each at an OpenAlex journal or conference source outside the preprint repositories and each clear of the retraction and paratext flags. A citation flows from the citing work's source to the cited work's source in the citing work's publication year, and the model takes the flows between distinct sources.

Let $m_{ij,t}$ be the citations from venue $i$ to venue $j$ in year $t$ and $E_{i,t}$ the exposure of $i$, the citations its works made per eligible work in that year. Given the pair total, the model is

$$
m_{ij,t} \sim \operatorname{Binomial}\!\left(m_{ij,t} + m_{ji,t},\; \sigma\!\left(\log \frac{E_{i,t}}{E_{j,t}} + \varphi_{j,t} - \varphi_{i,t}\right)\right),
\qquad \sigma(x) = \frac{1}{1 + e^{-x}},
$$

with $\varphi_{i,t} - \varphi_{i,t-1}$ normal with mean zero. A venue with higher $\varphi$ draws more of the citations it exchanges with other venues, after allowing for how much each side cites. The scores for year $t$ come from a fit on the years from 2004 to $t$. The published score is

$$
S_{v,t} = \sigma\!\left(\varphi_{v,t} - \tilde\varphi_t\right),
$$

where $\tilde\varphi_t$ is the median $\varphi$ of the venues OSR ranks in year $t$, so $S_{v,t}$ is the chance that a citation between $v$ and a median venue, at equal exposure, goes to $v$. The OSR site documents the model, its fitting and its diagnostics.

AllRankings reads $\varphi$ and $S$ for every venue and year, orders venues by $\varphi$ and shows $S$. OSR writes a score for every venue of its citation core, including venues outside its published ranking for a year, and AllRankings uses every venue-year with a score. An expanded row of the Venues table shows the venue's score per year with four decimals, as OSR does.

# Tiers

Tiers are set for each view and each year, and every view at every level of the hierarchy applies the rule below to its own papers. The mass of venue $v$ in view $n$ and year $y$ adds up, over the venue's papers of that year, each paper's share in every child $c$ of $n$,

$$
M_{v,y}(n) = \sum_{p \in v,\; y(p) = y} \; \sum_{c} s_c(p),
$$

with each child's share counted in millionths of a paper before the sum. A topic view is a leaf and takes the share in its topic. The pool holds the venues with a score in year $y$ and a positive mass in the view, ordered by $\varphi$ from the highest, with ties going to the lower OpenAlex source id. Let $M_1, \dots, M_m$ be the masses in this order and $T = \sum_r M_r$ the view's scored output in that year. The midpoint of venue $r$ is the mass before it plus half its own,

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

The rule walks down the pool from the strongest venue, cuts the view's output at one twenty-seventh, one ninth and one third, and places each venue by where the middle of its own papers falls. T1 thus holds about a twenty-seventh of the view's scored output, T1 and T2 together about a ninth and the first three tiers about a third. Take a pool of 30 venues with equal mass $M$, so that $T = 30M$. The cuts then lie at about $1.11M$, $3.33M$ and $10M$. The midpoints fall at $0.5M, 1.5M, 2.5M$ and so on. The first venue is therefore T1, the next two are T2, the next seven T3 and the last twenty T4. When the venues at the top carry more mass, the upper tiers hold fewer venues.

A venue has one tier per view and year, and it holds one in every view where it has papers that year, so the top tiers of a field include general journals and strong journals of other areas whose papers reach the field. A venue can be T1 in one field and T3 in another and move between tiers from year to year. Its tier in a view depends only on its place in that view's pool, and a domain's tiers come from the domain's own pool in the same way.

@fig:tiers applies the rule to {{tier_example.name|raw}} in {{tier_example.year|raw}}. The pool holds {{tier_example.pool|int}} venues with a mass of {{tier_example.mass|int}} papers. Along the $\varphi$ order T1 ends at rank {{tier_example.cuts.0|int}}, T2 at rank {{tier_example.cuts.1|int}} and T3 at rank {{tier_example.cuts.2|int}}. The order opens with strong journals of other areas, led by {{tier_example.lead.name|raw}} with a mass of {{tier_example.lead.mass|d1}} papers in the field. The {{tier_example.heavy|int}} largest of the {{tier_example.cuts.0|int}} T1 venues hold {{tier_example.heavy_share|pct1}} of the T1 mass, and the largest alone holds {{t1.rows[view=field/17].top|pct1}}. Together the T1 venues hold {{t1.rows[view=field/17].share|pct1}} of the field's scored output, close to a twenty-seventh. The {{example.venue|raw}} is among them, so the example paper counts in {{tier_example.name|raw}} under the default selection, with its share of {{example.fields[field=17].k|int}}/{{example.K|int}}.

::: {#fig:tiers .figure .wide}
The tier rule on the pool of {{tier_example.name|raw}} in {{tier_example.year|raw}}. Venues are ordered by $\varphi$ along a logarithmic horizontal axis and the curve is the running share of the pool's mass, coloured by tier. The key gives the number of venues in each tier. The tier boundaries lie where the curve crosses the lines at 1/27, 1/9 and 1/3. The list names the T1 venues with the largest mass, with their rank in this order, $\varphi$ and mass.
:::

# Selection

A selection in a view has four parts.

- Years from $y_0$ to $y_1$, anywhere from {{years.0|raw}} to {{years.1|raw}}, by default {{default_years.0|raw}} to {{default_years.1|raw}}.
- A set $L$ of listings. A listing is a pair of a tier and a venue. The Venues list shows each venue under every tier it holds in the view in the selected years, with one checkbox per listing, and checking a tier checks all its listings.
- The checked children of the view. A topic view is a leaf and counts its own topic.
- The selected countries, by default all of them.

A paper $p$ of venue $v$ published in year $y$ counts if and only if $y_0 \le y \le y_1$ and $(\tau(v, y), v) \in L$, where $\tau(v, y)$ is the tier of $v$ in this view in year $y$. The default selects every T1 listing, every child and every country. Take a venue that is T1 in a field in the first two default years and T2 in the last two. Under the default years it has two listings in the field, one under T1 and one under T2. With the default listings its papers from the first two years count, and checking its T2 listing adds its later papers.

# Counting

The share of paper $p$ in the checked children $C$ is $s_C(p) = \sum_{c \in C} s_c(p)$, and in a topic view it is the share in the topic. Let $N(p)$ be the number of authorships on $p$, $I(a, p)$ the institutions listed for author $a$ on $p$, and $A(p, i)$ the authors of $p$ who list institution $i$. The weight of institution $i$ on $p$ and its Count under a selection are

$$
W(p, i) = \sum_{a \in A(p, i)} \frac{1}{N(p)\,|I(a, p)|}, \qquad
\mathrm{Count}(i) = \sum_{p \text{ counted}} s_C(p)\, W(p, i).
$$

Each authorship carries $1/N(p)$ of the paper, split evenly over the author's institutions on the paper [@r4], and Count is a number of papers. $N(p)$ counts every authorship, those with an empty list of institutions included, so the weights of a paper add up to the share of its authorships that list an institution.

In the {{tier_example.name|raw}} view with every subfield checked, the example paper has a share of {{example.fields[field=17].k|int}}/{{example.K|int}} in the checked children, and each institution on it gains that fraction of its weight $W$. @fig:counting works the weights on a small paper with three authorships. Author a lists institutions X and Y, author b lists X, and the list of author c is empty. Then $W(p, X) = 1/6 + 1/3 = 1/2$ and $W(p, Y) = 1/6$. With a share of 0.75 in the checked children, the paper adds 0.375 to the Count of X and 0.125 to the Count of Y.

::: {#fig:counting .figure .wide}
Fractional counting on a paper with three authors. Each author holds one third of the paper, split evenly over the institutions marked in that author's row, and the weight $W$ of an institution is the sum of its column. The row Empty list holds the third of author c. The table carries $W$ into the stored weight $w$ and the micro-papers for a paper with 3 of its 4 references under the checked children.
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

millionths of a paper, where $k_c(p)$ is the sum of $k_t(p)$ over the topics under $c$. In the small example, $w(p, X) = 500{,}000{,}000$ and $w(p, Y) = 166{,}666{,}667$. With $K = 4$ and three references under a child $c$, $n(p, X, c) = 375{,}000$. For Y the quotient is $125{,}000.00025$, which rounds to $n(p, Y, c) = 125{,}000$.

Every stored aggregate is a sum of exactly these integers. The site recomputes the same integers from the bundles when it adds or removes a venue's papers, so its result equals the pipeline's to the millionth. The product $k_c(p)\, w(p, i)$ stays below $2^{53}$, which gives the browser's double precision and the pipeline's the same quotient and the same rounding.

# Authors

Authors estimates how many people at an institution publish in the area in an average year. It counts every author who lists an institution, in any position, people with an ORCID iD and people known by an OpenAlex author id alike.

Every person-year is one unit, and a person-year exists when a person has at least one authorship with an institution on a paper of the set in that year. Let $P(a, y)$ be those papers of person $a$ in year $y$. The unit is split evenly over $P(a, y)$, each paper's part evenly over the person's institutions on that paper, and then over topics by the paper's shares:

$$
F(i, y, c) = \sum_{a} \sum_{p \in P(a, y)} \frac{1}{|P(a, y)|} \cdot \frac{\mathbf{1}[i \in I(a, p)]}{|I(a, p)|} \cdot s_c(p).
$$

$F$ is summed per institution, child and year and rounded to millionths of a person-year. Authors for a selection is the mean over the selected years of the sum over the checked children,

$$
\mathrm{Authors}(i) = \frac{1}{y_1 - y_0 + 1} \sum_{y = y_0}^{y_1} \sum_{c \in C} F(i, y, c).
$$

In the All view with every domain checked, one year's $F$ over all institutions adds up to the number of person-years in that year, up to rounding. In a smaller view each person counts with the part of their work that falls in the view, so the part of a person-year that an author gives to the example paper reaches {{tier_example.name|raw}} with a share of {{example.fields[field=17].k|int}}/{{example.K|int}}.

@fig:faculty works an example. Person a has two papers in the year and lists X and Y on the first and X on the second, while person b has only the first paper and lists X. The unit of a gives one half to each paper, and on the first paper that half splits into a quarter for X and a quarter for Y. The whole unit of b goes to X. Before the topic split, X holds 1.75 person-years and Y holds 0.25, two units in all.

Authors depends on the view, the years and the checked children, and it takes in every paper of the set at every venue and tier, so that the ratio in the next section keeps the share of a person's work that reaches the selected venues. Take a person alone at an institution who publishes ten papers in a year, one of them in a T1 venue. Count and Authors are both 1, so the ratio is 1. A person with ten T1 papers has a ratio of 10. A denominator built from the selected papers alone would give the first person an Authors value of 0.1 and a ratio of 10, equal to the second.

::: {#fig:faculty .figure .wide}
Authors on a small example. The first panel splits the units of two people in one year over their papers and then over their institutions on each paper, and the table divides each institution's total between two children by the papers' shares, three quarters of paper 1 and half of paper 2 in Physics. The second panel follows a person alone at an institution with ten papers in a year as the number of T1 papers grows, with Authors from all papers and with Authors from the T1 papers alone.
:::

# Per author, tables and panel

Per author is Count divided by Authors. Count adds up over the selected years and Authors is a yearly average, so Per author is the selection's papers over the whole range per person publishing in an average year, and doubling the range at the same yearly output doubles it.

The Institutions table lists every institution with a positive Count under the selection, after the country filter, and shows Count, Authors and Per author with two decimals. The flag shows the country OpenAlex records for the institution, and institutions with a blank country appear when every country is selected. Two filters in the table head then keep the institutions above the mean Count and above the mean Authors, each mean taken over the listed rows before either filter applies, and both are on by default. Ranks are positions in the filtered list, sorted by the chosen column from the largest, and equal values share a rank.

Expanding an institution lists every person with positive credit on its counted papers. A person's credit is the Count formula with only that person's term, $\sum_p s_C(p) / (N(p)\,|I(a, p)|)$ over the person's counted papers at the institution. For an ORCID iD the name comes from the author record with the most works, ties going to the lowest author id, and for any other person it is the name of their own author record. The name links to that author record on OpenAlex.

The Venues table lists each venue with a positive Count under the selection, with a tier per selected year. Its Count adds up the venue's mass in the checked children over the years of its selected listings. These are the same per-child masses the tiers add up, so the Count follows the checked children as the Institutions table does. A filter keeps the venues above the mean Count. A venue's flag shows the country OpenAlex records for its source, often the publisher's country, and the Countries selection filters these rows by that country while every count stays the same.

The left panel holds three lists, Areas, Countries and Venues, and the Countries list groups countries by continent, following GeoNames [@r13]. In every list a click on a name opens that node and lists its children, and the checkboxes change the selection. In Countries and Venues a checkbox selects or clears the whole subtree under its node. In Areas the view is the node in ink. Its checkbox toggles all its children, and a child's checkbox toggles that child. Checking another node on the path makes it the view with all its children checked, and checking a listed node under another parent makes that parent the view with only this node checked. A change of view resets the listings, so each is checked exactly when its tier is checked.

# Tiers and citation impact

The tiers come from venue-to-venue citation flows, and the test asks whether papers in higher tiers also have higher citation impact as single papers. For each view and tier it takes the papers from {{validity.window.0|raw}} to {{validity.window.1|raw}} whose venue held that tier in the view in the paper's year, each weighted by its share in the view, and computes three rates.

- Top 10% share: the weighted share of papers that OpenAlex places in the top 10% by normalised citations [@r2; @r14].
- Top 1% share: the same for the top 1%.
- Mean FWCI: the weighted mean of OpenAlex's field-weighted citation impact, citations received over citations expected for works of the same type, year and subfield [@r2; @r15].

Coverage is the weighted share of papers with all three values. The window ends in {{validity.window.1|raw}} so that the papers have had time to collect citations.

In {{names.fields.17|raw}} the top 10% share is {{validity.rows[view=field/17,tier=1].top10|pct1}} in T1 and {{validity.rows[view=field/17,tier=2].top10|pct1}} in T2. It falls to {{validity.rows[view=field/17,tier=3].top10|pct1}} in T3 and {{validity.rows[view=field/17,tier=4].top10|pct1}} in T4. Mean FWCI falls from {{validity.rows[view=field/17,tier=1].fwci|d2}} in T1 to {{validity.rows[view=field/17,tier=4].fwci|d2}} in T4, and coverage in T1 is {{validity.rows[view=field/17,tier=1].coverage|pct0}}. @fig:validity shows every field. All three rates fall at every step from T1 to T4 in {{validity.falls.every|int}} of the {{validity.falls.views|int}} views, All and each field.

::: {#fig:validity .figure .wide}
Citation impact by tier, one row for All and one per field, with one column each for the top 10% share, the top 1% share and the mean FWCI. Each dot is one tier, coloured from T1 to T4, and dots further right mean higher impact.
:::

# Side findings

The analyses below use the default selection, T1 listings, all children and the years {{default_years.0|raw}} to {{default_years.1|raw}}, in the All view and each field view.

## Composition

The All view tiers every venue by its whole output, and the papers of each field then fall into these global tiers through the venues they appear in. Over the default years the T1 of All holds {{composition[view=all].mass.0|int}} papers, and @fig:composition splits each field's output by the All view's tier of its venues. Upstream fields, whose work much of science cites and builds on, place the largest parts of their output in the global T1. {{upstream.top.0.name|raw}} leads, followed by {{upstream.top.1.name|raw}} and by {{upstream.top.2.name|raw}}. {{upstream.bottom.0.name|raw}} places the smallest part there, followed by applied and clinical fields such as {{upstream.bottom.1.name|raw}}, {{upstream.bottom.2.name|raw}} and {{upstream.bottom.3.name|raw}}.

In {{t1.year|raw}} the T1 of All spans {{t1.rows[view=all].venues|int}} venues with {{t1.rows[view=all].share|pct1}} of the year's scored output. Its largest venue, {{t1.rows[view=all].venue|raw}}, holds {{t1.rows[view=all].top|pct1}} of that T1.

::: {#fig:composition .figure}
Paper mass by the All view's tier over the default years, one bar for All and one per field. A field's T1 segment is the part of its output in venues that are T1 in All.
:::

## Concentration

Concentration is measured over the institutions with positive T1 Count. In the All view the 10 largest of them hold {{concentration[view=all].top10|pct1}} of T1 Count and the 100 largest hold {{concentration[view=all].top100|pct1}}. The Gini coefficient there is {{concentration[view=all].gini|d2}}, twice the area between the Lorenz curve [@r16] and the diagonal of equal shares. @fig:concentration draws the shares for every field.

::: {#fig:concentration .figure}
Concentration of T1 Count for All and each field, over the institutions with positive T1 Count. The first panel gives the share of T1 Count held by the largest institutions against the share of institutions they make up, on a logarithmic axis, and a higher curve means fewer institutions hold the Count. The second panel gives the shares of the 10 and 100 largest institutions.
:::

## Countries

Country shares are the part of T1 Count in the All view held by the institutions of each country, for each year from {{years.0|raw}} to {{years.1|raw}}, computed alike for every country. The share of the United States falls over the period, from {{countries.series[country=US].share.0|pct1}} in the first year to {{countries.series[country=US].share.21|pct1}} in the last. China rises over the same years, from {{countries.series[country=CN].share.0|pct1}} to {{countries.series[country=CN].share.21|pct1}}. @fig:countries draws the largest countries in {{years.1|raw}}, all other countries together and the institutions with a blank country.

::: {#fig:countries .figure}
Share of T1 Count by country and year, one line per country, with all other countries and the institutions with a blank country as two dashed lines. The two countries whose share moves most over the period are drawn in black and blue.
:::

## Stability

For each view and year, stability is Spearman's rank correlation [@r17] of single-year T1 Count with the year before, over the institutions with positive Count in both years. In the All view its mean over the years is {{stability[view=all].mean|d2}}, over about {{stability[view=all].n|int}} institutions a year, so these institutions keep much of their order from one year to the next. Field views vary more. The lowest means belong to {{stability.1.name|raw}} ({{stability.1.mean|d2}}), {{stability.2.name|raw}} ({{stability.2.mean|d2}}) and {{stability.3.name|raw}} ({{stability.3.mean|d2}}). Their sets hold about {{stability.1.n|int}}, {{stability.2.n|int}} and {{stability.3.n|int}} institutions a year. @fig:stability shows every series.

::: {#fig:stability .figure}
Year-to-year Spearman correlation of institution T1 Count over the institutions present in both years, one line per view, with All and the three fields of lowest mean labelled. Values near 1 mean the institutions keep their order between the two years.
:::

## Scaling

A least-squares line through $\log \mathrm{Count}$ against $\log \mathrm{Authors}$, over the institutions with positive Count and Authors, has one slope per view. A slope of 1 means T1 Count grows in proportion to Authors, and a slope below 1 means Count per person falls with size. In the All view the slope is {{scaling.rows[view=all].slope|d2}} over {{scaling.rows[view=all].n|int}} institutions, with $R^2$ of {{scaling.rows[view=all].r2|d2}}. Field slopes range from {{scaling.low.slope|d2}} in {{scaling.low.name|raw}} to {{scaling.high.slope|d2}} in {{scaling.high.name|raw}}. @fig:scaling plots a sample of the institutions of All.

::: {#fig:scaling .figure}
Count against Authors on logarithmic axes for a sample of the institutions of All, taken at even steps of Authors rank among those with positive Count and Authors, with the least-squares line fitted over all of them. Points above the line have more Count than their Authors value predicts. The second panel gives the slope of each view.
:::

# How the site runs

The site is a static page that reads Parquet files [@r18] from a static store with HTTP Range requests, fetching only the parts of a file it needs. Each site build reads one release, named by the first 16 hexadecimal digits of a SHA-256 digest over the pipeline's code, its configuration and the identities of its inputs.

A release holds the hierarchy, the names and countries of institutions and venues, each venue's score per year and three files per view. One gives each venue's tier and paper mass per year, in views with children per child and as their sum. The other two hold running totals of Count and Authors in millionths from {{years.0|raw}} to each year, per institution and child, and for Count per tier, and in views with children also a row per institution with the sum over all children. A selection from $y_0$ to $y_1$ reads the totals for $y_1$ and $y_0 - 1$ and subtracts, two row groups per checked tier and two for Authors. The view's aggregates load at once, because ranking needs every institution.

The bundles hold one row per paper. A listing whose checkbox differs from its tier's checkbox changes Count by one venue's papers in some years, so the site loads that venue's bundle for those years, recomputes the integers $n(p, i, c)$ and adds or subtracts them. Expanding an institution loads its bundle for the selected years.

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

[r17] Spearman, C. (1904). The proof and measurement of association between two things. The American Journal of Psychology, 15(1), 72–101. <https://doi.org/10.2307/1412159>

[r18] Apache Parquet. File format. <https://parquet.apache.org/docs/file-format/>
:::
