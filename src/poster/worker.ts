import { load } from "../data";
import { flag } from "../flags";
import type { Flag } from "./band";
import { build } from "./build";
import { page } from "./compose";
import { poster, type Selection } from "./data";
import { stamp } from "./masthead";
import { pdf, type Raster } from "./pdf";
import { png } from "./png";
import { zip } from "./zip";

export type Ask = {
	selection: Selection;
	date: string;
	snapshot: string;
	release: string;
};

export type Band = { height: number; svg: Blob; flags: Flag[] };

export type Answer =
	| {
			kind: "bands";
			stem: string;
			codes: string[];
			width: number;
			bands: Band[];
	  }
	| { kind: "next" }
	| { kind: "zip"; zip: Blob; stem: string }
	| { kind: "error"; message: string };

export type Reply = { flags: [string, Raster][] } | { rgba: Uint8ClampedArray };

const replies: Reply[] = [];
let wake = () => {};
const next = async () => {
	while (!replies.length) await new Promise<void>((done) => (wake = done));
	return replies.shift() as Reply;
};

const fetched = async (url: string) => {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`${response.status} ${url}`);
	return response.arrayBuffer();
};

const make = async ({ selection, date, snapshot, release }: Ask) => {
	const meta = await load();
	const data = await poster(meta, selection);
	const { scene, fonts, svg, bands } = await build(
		data,
		stamp(date, snapshot, release),
		(file) => fetched(`${import.meta.env.BASE_URL}fonts/${file}`),
		async (code) => {
			const url = flag(code.toUpperCase());
			return url ? fetched(url) : undefined;
		},
	);
	const slices = bands(512, 8192).map((band) => ({
		...band,
		svg: new Blob([band.svg], { type: "image/svg+xml" }),
	}));
	postMessage({
		kind: "bands",
		stem: data.stem,
		codes: [...scene.flags].sort().filter((code) => flag(code.toUpperCase())),
		width: page.width,
		bands: slices,
	} satisfies Answer);
	const first = await next();
	const flags = new Map("flags" in first ? first.flags : []);
	const [vector, raster] = await Promise.all([
		pdf(scene.items, page.width, page.height, fonts, flags, {
			title: data.view.level === "all" ? "AllRankings" : data.view.name,
			author: "clareLab",
		}),
		png(
			page.width,
			page.height,
			(async function* () {
				for (let k = 0; k < slices.length; k++) {
					if (k) postMessage({ kind: "next" } satisfies Answer);
					const reply = await next();
					if (!("rgba" in reply)) throw new Error("no band");
					yield reply.rgba;
				}
			})(),
		),
	]);
	const file = await zip([
		[`${data.stem}.png`, new Uint8Array(await raster.arrayBuffer()), false],
		[`${data.stem}.svg`, new TextEncoder().encode(svg), true],
		[`${data.stem}.pdf`, vector, false],
	]);
	postMessage({ kind: "zip", zip: file, stem: data.stem } satisfies Answer);
};

addEventListener("message", ({ data }: MessageEvent<Ask | Reply>) => {
	if ("selection" in data)
		make(data).catch((error: unknown) =>
			postMessage({
				kind: "error",
				message: error instanceof Error ? error.message : String(error),
			} satisfies Answer),
		);
	else {
		replies.push(data);
		wake();
	}
});
