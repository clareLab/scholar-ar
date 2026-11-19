export const authors = [{ name: "clareLab", email: "yaho@clarelab.moe" }];

const names = authors.map((author) => author.name);

export const cite = {
	authors:
		names.length > 2
			? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
			: names.join(" and "),
	bibtex: names.join(" and "),
};
