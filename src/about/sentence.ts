export const sentence = (html: string) => {
	const text = html
		.replace(/<[^>]*>/g, "")
		.replace(/\s+/g, " ")
		.trim();
	return text.match(/^.*?(?:\.(?=\s|$)|。)/)?.[0] ?? text;
};
