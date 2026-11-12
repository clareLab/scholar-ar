import snapshot from "virtual:snapshot";
import type { Selection } from "./data";
import type { Raster } from "./pdf";
import { frame } from "./svg";
import type { Answer, Ask, Band, Reply } from "./worker";

const side = [256, 192];

const day = (date: Date, timeZone?: string) =>
	new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone,
	}).format(date);

const picture = async (url: string) => {
	const image = new Image();
	image.src = url;
	await image.decode();
	return image;
};

const canvas = (width: number, height: number) => {
	const out = document.createElement("canvas");
	out.width = width;
	out.height = height;
	const context = out.getContext("2d");
	if (!context) throw new Error(`no ${width} x ${height} canvas`);
	return { out, context };
};

const flagRaster = async (url: string) => {
	const [width, height] = side;
	const image = await picture(url);
	const { context } = canvas(width, height);
	context.drawImage(image, 0, 0, width, height);
	const raster: Raster = {
		width,
		height,
		rgba: context.getImageData(0, 0, width, height).data,
	};
	return { image, raster };
};

const pause = () => new Promise((done) => setTimeout(done));

const decode = async (svg: Blob) => {
	const url = URL.createObjectURL(svg);
	try {
		return await picture(url);
	} finally {
		URL.revokeObjectURL(url);
	}
};

const band = (
	image: HTMLImageElement,
	{ height, flags }: Band,
	width: number,
	pictures: Map<string, HTMLImageElement>,
) => {
	const { out, context } = canvas(width, height);
	context.drawImage(image, 0, 0, width, height);
	context.strokeStyle = frame;
	context.lineWidth = 1;
	for (const { code, x, y, w } of flags) {
		const h = w * 0.75;
		context.drawImage(pictures.get(code) as HTMLImageElement, x, y, w, h);
		context.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
	}
	const { data } = context.getImageData(0, 0, width, height);
	out.width = 0;
	out.height = 0;
	return data;
};

const save = (blob: Blob, name: string) => {
	const anchor = document.createElement("a");
	anchor.href = URL.createObjectURL(blob);
	anchor.download = name;
	anchor.click();
	setTimeout(() => URL.revokeObjectURL(anchor.href), 65536);
};

export const make = (
	state: Selection,
	api: string,
	flag: (code: string) => string | undefined,
) =>
	new Promise<void>((done, fail) => {
		const selection: Selection = {
			view: state.view,
			from: state.from,
			to: state.to,
			tiers: [...state.tiers],
			flip: [...state.flip],
			off: [...state.off].sort((a, b) => a - b),
			at: [...state.at],
		};
		const worker = new Worker(new URL("./worker.ts", import.meta.url), {
			type: "module",
		});
		let stopped = false;
		let taken = 0;
		let wake = () => {};
		const stop = (error?: unknown) => {
			stopped = true;
			worker.terminate();
			wake();
			if (error) fail(error);
			else done();
		};
		const until = async (count: number) => {
			while (taken < count && !stopped)
				await new Promise<void>((go) => (wake = go));
		};
		worker.onerror = (event) => stop(new Error(event.message));
		worker.onmessageerror = () => stop(new Error("unreadable message"));
		worker.onmessage = async ({ data }: MessageEvent<Answer>) => {
			try {
				if (data.kind === "error") stop(new Error(data.message));
				else if (data.kind === "next") {
					taken++;
					wake();
				} else if (data.kind === "zip") {
					save(data.zip, `${data.stem}.zip`);
					stop();
				} else {
					const pictures = new Map<string, HTMLImageElement>();
					const flags: [string, Raster][] = [];
					for (const code of data.codes) {
						const { image, raster } = await flagRaster(
							flag(code.toUpperCase()) as string,
						);
						pictures.set(code, image);
						flags.push([code, raster]);
					}
					worker.postMessage(
						{ flags } satisfies Reply,
						flags.map(([, raster]) => raster.rgba.buffer),
					);
					let ahead = decode(data.bands[0].svg);
					for (const [k, slice] of data.bands.entries()) {
						const image = await ahead;
						if (k + 1 < data.bands.length)
							ahead = decode(data.bands[k + 1].svg);
						await pause();
						if (stopped) return;
						const rgba = band(image, slice, data.width, pictures);
						await until(k - 1);
						if (stopped) return;
						worker.postMessage({ rgba } satisfies Reply, [rgba.buffer]);
					}
				}
			} catch (error) {
				stop(error);
			}
		};
		worker.postMessage({
			selection,
			date: day(new Date()),
			snapshot: day(new Date(`${snapshot}T00:00:00Z`), "UTC"),
			release: api.split("/").pop() ?? "",
		} satisfies Ask);
	});
