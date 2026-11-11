const plural = (n: number, one: string, many: string) =>
	`${n} ${n === 1 ? one : many}`;

export const en = {
	locale: "en-GB",
	name: "English",
	flag: "GB",
	cjk: false,
	pdf: "allrankings.en.pdf",
	figure: "Figure",
	abstract: "Abstract",
	references: "References",
	copy: "Copy",
	copied: "Copied",
	release: (r: string) => `Release ${r}`,
	date: (d: Date) =>
		d.toLocaleDateString("en-GB", {
			day: "numeric",
			month: "long",
			year: "numeric",
		}),
	font: '"TeX Gyre Termes", "Times New Roman", Times, serif',
	sep: ", ",
	list: "; ",
	area: "Area",
	log: "Log",
	linear: "Linear",
	blank: "Blank country",
	other: "Other countries",
	apportion: {
		topic: "Topic",
		subfield: "Subfield",
		field: "Field",
		domain: "Domain",
		idle: (K: number, refs: number) =>
			`${K} of ${refs} references have a primary topic, so K = ${K}`,
		item: (k: number, K: number, share: string) =>
			`: k = ${k}, share ${k}/${K} = ${share}`,
	},
	tiers: {
		axis: "Cumulative share of paper mass",
		ranked: "Venues ranked by φ",
		rank: "Rank",
		venue: "Venue",
		mass: "Mass",
		idle: (pool: string, t1: string, t2: string, t3: string) =>
			`${pool} venues; T1 ends at rank ${t1}, T2 at ${t2}, T3 at ${t3}`,
		tail: (share: string) => `cumulative share ${share}`,
		at: (rank: string, tier: number, tail: string) =>
			`Rank ${rank}, T${tier}, ${tail}`,
		named: (phi: string, mass: string, tier: number, tail: string) =>
			`, φ ${phi}, mass ${mass}, T${tier}, ${tail}`,
	},
	counting: {
		author: "Author",
		institution: "Institution",
		per: "Per institution",
		empty: "Empty list",
		micro: ["Micro-papers"],
		split: ["Micro-", "papers"],
		sum: "Sum",
		alone: (a: string, n: number) => `Author ${a}: 1/${n} on an empty list`,
		tied: (a: string, m: number, share: string) =>
			`Author ${a}: ${plural(m, "institution", "institutions")}, ${share} to each`,
		idle: (n: number, kc: number, K: number) =>
			`N = ${n} authors; the checked children hold ${kc} of K = ${K} references`,
	},
	faculty: {
		children: ["Physics", "Mathematics"],
		person: "Person",
		paper: "Paper",
		institution: "Institution",
		authors: "Authors",
		total: "Total",
		leaf: (p: string, n: number, place: string, part: string) =>
			`Person ${p}, paper ${n}, ${place}: ${part} of a person-year`,
		entry: (
			p: string,
			n: number,
			part: string,
			s: number[],
			children: string[],
		) =>
			`Person ${p}, paper ${n}: ${part}, split ${s[0]} to ${children[0]} and ${s[1]} to ${children[1]}`,
		idle: (rows: string[][]) =>
			`Two person-years: ${rows.map(([place, part]) => `${place} ${part}`).join(", ")}`,
	},
	composition: {
		field: "Field",
		share: "T1 share",
		item: (tiers: string, papers: string) => `: ${tiers} of ${papers} papers`,
	},
	validity: {
		top10: "Top 10%",
		top1: "Top 1%",
		fwci: "FWCI",
		item: (list: string) => `, T1 to T4: ${list}`,
	},
	concentration: {
		top: "Top shares",
		lorenz: "Lorenz",
		axis: "Share of T1 Count",
		smallest: "Share of institutions, smallest first",
		largest: "Share of institutions, largest first",
		top10: "Top 10",
		top100: "Top 100",
		item: (top10: string, top100: string, gini: string) =>
			`: top 10 hold ${top10}, top 100 hold ${top100}, Gini ${gini}`,
	},
	countries: {
		axis: "Share of T1 Count",
		item: (name: string, year: number, share: string) =>
			`${name}, ${year}: ${share} of T1 Count`,
	},

	scaling: {
		count: "Count",
		authors: "Authors",
		beta: "β",
		expected: (beta: string) => `Expected, β = ${beta}`,
		mean: "Mean Count per bin, zeros included",
		zeros: "Share with zero Count",
		point: (c: string, a: string, e: string, x: string) =>
			`: Count ${c}, Authors ${a}, Expected ${e}, Excess ${x}`,
		bin: (lo: string, hi: string, n: string, z: string, m: string) =>
			`Authors ${lo} to ${hi}: ${n} institutions, ${z} with zero Count, mean Count ${m}`,
		row: (beta: string, n: string) => `: β ${beta}, ${n} institutions`,
	},
};

export type Words = typeof en;
