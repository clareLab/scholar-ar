import { readFileSync, rmSync } from "node:fs";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { inflateSync } from "node:zlib";
import { build } from "./build";
import { page } from "./compose";
import { heading, stamp } from "./masthead";
import type { Data } from "./model";
import { pdf, type Raster } from "./pdf";
import { png } from "./png";
import { zip } from "./zip";

const [source, out, release, date, snapshot, only] = process.argv.slice(2);
if (!source || !out || !release || !date || !snapshot)
	throw new Error(
		"usage: render.ts <data.json> <out dir> <release> <date> <snapshot> [svg|png]",
	);

const decode = (bytes: Uint8Array) => {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
	const width = view.getUint32(16);
	const height = view.getUint32(20);
	const depth = { 2: 3, 6: 4 }[view.getUint8(25)];
	if (view.getUint8(24) !== 8 || !depth) throw new Error("png format");
	const parts: Uint8Array[] = [];
	for (let at = 8; at < bytes.length; at += 12 + view.getUint32(at))
		if (view.getUint32(at + 4) === 0x49444154)
			parts.push(bytes.subarray(at + 8, at + 8 + view.getUint32(at)));
	const raw = inflateSync(Buffer.concat(parts));
	const line = depth * width;
	const pixels = new Uint8Array(height * line);
	for (let y = 0; y < height; y++) {
		const filter = raw[y * (line + 1)];
		const from = y * (line + 1) + 1;
		const row = y * line;
		for (let x = 0; x < line; x++) {
			const a = x < depth ? 0 : pixels[row + x - depth];
			const b = y ? pixels[row + x - line] : 0;
			let guess = 0;
			if (filter === 1) guess = a;
			else if (filter === 2) guess = b;
			else if (filter === 3) guess = (a + b) >> 1;
			else if (filter === 4) {
				const c = x < depth || !y ? 0 : pixels[row + x - line - depth];
				const pa = Math.abs(b - c);
				const pb = Math.abs(a - c);
				const pc = Math.abs(a + b - 2 * c);
				guess = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
			}
			pixels[row + x] = raw[from + x] + guess;
		}
	}
	const rgba = new Uint8ClampedArray(4 * width * height).fill(255);
	for (let k = 0; k < width * height; k++)
		for (let c = 0; c < depth; c++) rgba[4 * k + c] = pixels[depth * k + c];
	return { width, height, rgba };
};

let fontconfig: Record<string, string> | undefined;

const raster = async (
	svg: string | ArrayBuffer,
	width: number,
	height: number,
) => {
	const proc = Bun.spawn(
		["rsvg-convert", "-w", `${width}`, "-h", `${height}`],
		{
			stdin: new Blob([svg]),
			stdout: "pipe",
			env: fontconfig ? { ...process.env, ...fontconfig } : undefined,
		},
	);
	const bytes = new Uint8Array(await new Response(proc.stdout).arrayBuffer());
	if ((await proc.exited) !== 0) throw new Error("rsvg-convert");
	return decode(bytes);
};

const here = import.meta.dir;
const data: Data = await Bun.file(source).json();
const started = performance.now();
const sources = new Map<string, ArrayBuffer>();
const { scene, fonts, flags, supplements, bands, svg } = await build(
	data,
	stamp(date, snapshot, release),
	(file) => Bun.file(`${here}/../../public/fonts/${file}`).arrayBuffer(),
	async (code) => {
		const file = Bun.file(
			`${here}/../../node_modules/flag-icons/flags/4x3/${code}.svg`,
		);
		if (!(await file.exists())) return undefined;
		const bytes = await file.arrayBuffer();
		sources.set(code, bytes);
		return bytes;
	},
	(file) =>
		new Uint8Array(readFileSync(`${here}/../../public/fonts/${file}`)).buffer,
);
console.log(`composed in ${Math.round(performance.now() - started)} ms`);
const scratch = supplements.length
	? await mkdtemp(`${tmpdir()}/poster-fonts-`)
	: undefined;
if (scratch) {
	for (const { key, bytes } of supplements)
		await Bun.write(`${scratch}/${key.replaceAll(" ", "")}.ttf`, bytes);
	const config = `${scratch}/fonts.conf`;
	await Bun.write(
		config,
		`<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">\n<fontconfig>${process.env.FONTCONFIG_FILE ? `<include ignore_missing="yes">${process.env.FONTCONFIG_FILE}</include>` : ""}<dir>${scratch}</dir><cachedir>${scratch}</cachedir></fontconfig>\n`,
	);
	fontconfig = { FONTCONFIG_FILE: config };
	process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
}

const name = `${out}/${data.stem}`;
await mkdir(out, { recursive: true });
const text = new TextEncoder().encode(svg);
await Bun.write(`${name}.svg`, text);
if (only === "svg") process.exit(0);
const image = new Uint8Array(
	await (
		await png(
			page.width,
			page.height,
			(async function* () {
				for (const band of bands(512, 8192, flags))
					yield (await raster(band.svg, page.width, band.height)).rgba;
			})(),
		)
	).arrayBuffer(),
);
await Bun.write(`${name}.png`, image);
if (only === "png") process.exit(0);
const rasters = new Map<string, Raster>();
for (const [code, bytes] of sources)
	rasters.set(code, await raster(bytes, 256, 192));
const vector = await pdf(scene.items, page.width, page.height, fonts, rasters, {
	title: heading(data),
	author: "clareLab",
});
await Bun.write(`${name}.pdf`, vector);
await Bun.write(
	`${name}.zip`,
	await zip([
		[`${data.stem}.png`, image, false],
		[`${data.stem}.svg`, text, true],
		[`${data.stem}.pdf`, vector, false],
	]),
);
console.log(
	["svg", "png", "pdf", "zip"].map((ext) => `${name}.${ext}`).join("\n"),
);
