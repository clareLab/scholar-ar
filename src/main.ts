import "./style.scss";
import { mount } from "svelte";
import App from "./App.svelte";
import { load } from "./data";
import { climb } from "./page";

const meta = await load();
const root = document.documentElement;

if (root.hasAttribute("data-missing")) {
	const path = await climb(location.pathname, meta.nodes, (at) =>
		fetch(at, { method: "HEAD" }).then(
			(r) => r.ok,
			() => false,
		),
	);
	history.replaceState(null, "", `${path}${location.search}${location.hash}`);
}

const reveal = () => root.classList.remove("sift");

if ([...document.body.children].some((e) => e.tagName !== "SCRIPT")) {
	const box = document.createElement("div");
	let done = false;
	mount(App, {
		target: box,
		props: {
			meta,
			onready: () => {
				if (done) return;
				done = true;
				document.body.replaceChildren(...box.childNodes);
				reveal();
			},
		},
	});
} else {
	mount(App, { target: document.body, props: { meta } });
	reveal();
}
