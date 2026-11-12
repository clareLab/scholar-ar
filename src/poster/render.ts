import { mkdir, rm } from "node:fs/promises";
import { build } from "./build";
import { page } from "./compose";
import { stamp } from "./masthead";
import type { Data } from "./model";

const [source, out, release, date, snapshot, only] = process.argv.slice(2);
if (!source || !out || !release || !date || !snapshot)
	throw new Error(
		"usage: render.ts <data.json> <out dir> <release> <date> <snapshot> [svg|png]",
	);

const here = import.meta.dir;
const data: Data = await Bun.file(source).json();
const started = performance.now();
const { svg } = await build(
	data,
	stamp(date, snapshot, release),
	(file) => Bun.file(`${here}/../../public/fonts/${file}`).arrayBuffer(),
	async (code) => {
		const file = Bun.file(
			`${here}/../../node_modules/flag-icons/flags/4x3/${code}.svg`,
		);
		return (await file.exists()) ? file.arrayBuffer() : undefined;
	},
);
console.log(`composed in ${Math.round(performance.now() - started)} ms`);

const name = data.stem;
await mkdir(out, { recursive: true });
const files = ["svg", "png", "pdf"].map((ext) => `${name}.${ext}`);
await Bun.write(`${out}/${files[0]}`, svg);
if (only === "svg") process.exit(0);
const run = async (cmd: string[]) => {
	const proc = Bun.spawn(cmd, {
		cwd: out,
		stdout: "inherit",
		stderr: "inherit",
	});
	if ((await proc.exited) !== 0) throw new Error(cmd.join(" "));
};
await run([
	"rsvg-convert",
	"-f",
	"png",
	"-w",
	`${page.width}`,
	"-h",
	`${page.height}`,
	"-o",
	files[1],
	files[0],
]);
if (only === "png") process.exit(0);
await run(["rsvg-convert", "-f", "pdf", "-o", files[2], files[0]]);
await rm(`${out}/${name}.zip`, { force: true });
await run(["zip", "-q", "-j", `${name}.zip`, ...files]);
console.log(files.map((f) => `${out}/${f}`).join("\n"));
