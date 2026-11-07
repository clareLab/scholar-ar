import type { Words } from "./en.ts";

export const zh: Words = {
	locale: "zh-Hans",
	name: "简体中文",
	flag: "CN",
	cjk: true,
	pdf: "allrankings.zh.pdf",
	figure: "图",
	abstract: "摘要",
	references: "参考文献",
	copy: "复制",
	copied: "已复制",
	release: (r) => `版本 ${r}`,
	date: (d) => `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`,
	font: '"TeX Gyre Termes", "Times New Roman", Times, "Noto Serif CJK SC", "Source Han Serif SC", "Songti SC", SimSun, serif',
	sep: "，",
	list: "；",
	area: "范围",
	log: "对数",
	linear: "线性",
	blank: "国家为空",
	other: "其他国家",
	apportion: {
		topic: "主题",
		subfield: "子领域",
		field: "学科",
		domain: "领域",
		idle: (K, refs) =>
			`${refs} 条参考文献中有 ${K} 条带主要主题，所以 K = ${K}`,
		item: (k, K, share) => `：k = ${k}，份额 ${k}/${K} = ${share}`,
	},
	tiers: {
		axis: "论文量的累计份额",
		ranked: "按 φ 排序的 venue",
		rank: "名次",
		venue: "venue",
		mass: "论文量",
		idle: (pool, t1, t2, t3) =>
			`${pool} 个 venue，T1 止于第 ${t1} 名，T2 止于第 ${t2} 名，T3 止于第 ${t3} 名`,
		tail: (share) => `累计份额 ${share}`,
		at: (rank, tier, tail) => `第 ${rank} 名，T${tier}，${tail}`,
		named: (phi, mass, tier, tail) =>
			`，φ ${phi}，论文量 ${mass}，T${tier}，${tail}`,
	},
	counting: {
		author: "作者",
		institution: "机构",
		per: "每个机构",
		empty: "空列表",
		micro: ["微论文"],
		split: ["微论文"],
		sum: "合计",
		alone: (a, n) => `作者 ${a}：机构列表为空，计 1/${n}`,
		tied: (a, m, share) => `作者 ${a}：${m} 个机构，每个 ${share}`,
		idle: (n, kc, K) =>
			`N = ${n} 位作者，勾选的子节点占 K = ${K} 条参考文献中的 ${kc} 条`,
	},
	faculty: {
		children: ["Physics", "Mathematics"],
		person: "人员",
		paper: "论文",
		institution: "机构",
		authors: "Authors",
		total: "合计",
		leaf: (p, n, place, part) => `人员 ${p}，论文 ${n}，${place}：${part} 人年`,
		entry: (p, n, part, s, children) =>
			`人员 ${p}，论文 ${n}：${part}，${children[0]} 分得 ${s[0]}，${children[1]} 分得 ${s[1]}`,
		idle: (rows) =>
			`两个人年：${rows.map(([place, part]) => `${place} ${part}`).join("，")}`,
	},
	composition: {
		field: "学科",
		share: "T1 份额",
		item: (tiers, papers) => `：${tiers}，共 ${papers} 篇论文`,
	},
	validity: {
		top10: "被引前 10%",
		top1: "被引前 1%",
		fwci: "FWCI",
		item: (list) => `，T1 至 T4：${list}`,
	},
	concentration: {
		top: "头部份额",
		lorenz: "洛伦兹曲线",
		axis: "占 T1 Count 的份额",
		smallest: "机构份额，从小到大",
		largest: "机构份额，从大到小",
		top10: "前 10",
		top100: "前 100",
		item: (top10, top100, gini) =>
			`：前 10 占 ${top10}，前 100 占 ${top100}，基尼系数 ${gini}`,
	},
	countries: {
		axis: "占 T1 Count 的份额",
		item: (name, year, share) => `${name}，${year}：占 T1 Count 的 ${share}`,
	},

	scaling: {
		count: "Count",
		authors: "Authors",
		beta: "β",
		expected: (beta) => `Expected，β = ${beta}`,
		mean: "每组平均 Count，含 Count 为零的机构",
		zeros: "Count 为零的比例",
		point: (c, a, e, x) =>
			`：Count ${c}，Authors ${a}，Expected ${e}，Excess ${x}`,
		bin: (lo, hi, n, z, m) =>
			`Authors ${lo} 至 ${hi}：${n} 个机构，其中 ${z} 个 Count 为零，平均 Count ${m}`,
		row: (beta, n) => `：β ${beta}，${n} 个机构`,
	},
};
