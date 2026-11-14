import "./style.scss";
import { mount } from "svelte";
import App from "./App.svelte";
import { load, retry } from "./data";
import { climb } from "./page";

const root = document.documentElement;

const reveal = () => root.classList.remove("sift");

const listed = fetch(`${import.meta.env.BASE_URL}empty.json`)
	.then((r) => r.json())
	.catch(() => []);

const meta = await retry(load).catch((error) => {
	reveal();
	throw error;
});

const empty = new Set<number>(await listed);

if (root.hasAttribute("data-missing")) {
	const path = await climb(location.pathname, meta.nodes, (at) =>
		fetch(at, { method: "HEAD" }).then(
			(r) => r.ok,
			() => false,
		),
	);
	history.replaceState(null, "", `${path}${location.search}${location.hash}`);
}

if ([...document.body.children].some((e) => e.tagName !== "SCRIPT")) {
	const box = document.createElement("div");
	let done = false;
	mount(App, {
		target: box,
		props: {
			meta,
			empty,
			onready: () => {
				if (done) return;
				done = true;
				document.body.replaceChildren(...box.childNodes);
				reveal();
			},
			onfail: reveal,
		},
	});
} else {
	mount(App, { target: document.body, props: { meta, empty } });
	reveal();
}
