import { crc32 } from "./zip";

const chunk = (type: string, data: Uint8Array) => {
	const out = new Uint8Array(12 + data.length);
	const view = new DataView(out.buffer);
	view.setUint32(0, data.length);
	out.set(new TextEncoder().encode(type), 4);
	out.set(data, 8);
	view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
	return out;
};

export const png = async (
	width: number,
	height: number,
	bands: AsyncIterable<Uint8ClampedArray>,
) => {
	const stream = new CompressionStream("deflate");
	const writer = stream.writable.getWriter();
	const packed = new Response(stream.readable).arrayBuffer();
	const line = 3 * width + 1;
	for await (const rgba of bands) {
		const rows = rgba.length / (4 * width);
		const raw = new Uint8Array(rows * line);
		for (let j = 0, s = 0; j < rows; j++)
			for (let i = 0, o = j * line + 1; i < width; i++, s += 4) {
				raw[o++] = rgba[s];
				raw[o++] = rgba[s + 1];
				raw[o++] = rgba[s + 2];
			}
		await writer.write(raw);
	}
	await writer.close();
	const head = new DataView(new ArrayBuffer(13));
	head.setUint32(0, width);
	head.setUint32(4, height);
	head.setUint8(8, 8);
	head.setUint8(9, 2);
	return new Blob(
		[
			new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
			chunk("IHDR", new Uint8Array(head.buffer)),
			chunk("IDAT", new Uint8Array(await packed)),
			chunk("IEND", new Uint8Array(0)),
		] as BlobPart[],
		{ type: "image/png" },
	);
};
