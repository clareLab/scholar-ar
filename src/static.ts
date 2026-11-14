import { render } from "svelte/server";
import App from "./App.svelte";
import type { Meta } from "./data";
import type { Head, Ssr } from "./page";

export { api, forget, load } from "./data";
export { quote, tags } from "./page";
export { origin } from "./state";

export const draw = async (meta: Meta, path: string, rows: number) => {
	const ssr: Ssr = { path, rows, got: new Map(), wait: new Map() };
	for (;;) {
		const { body } = render(App, { props: { meta, ssr } });
		const fresh = [...ssr.wait].filter(([key]) => !ssr.got.has(key));
		if (!fresh.length) {
			return { body, head: ssr.head?.() as Head };
		}
		const values = await Promise.all(fresh.map(([, value]) => value));
		fresh.forEach(([key], k) => {
			ssr.got.set(key, values[k]);
		});
	}
};
