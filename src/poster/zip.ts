const table = new Uint32Array(256).map((_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c;
});

export const crc32 = (bytes: Uint8Array) => {
	let c = 0xffffffff;
	for (let k = 0; k < bytes.length; k++)
		c = table[(c ^ bytes[k]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
};

const squeeze = async (bytes: Uint8Array) =>
	new Uint8Array(
		await new Response(
			new Blob([bytes as BlobPart])
				.stream()
				.pipeThrough(new CompressionStream("deflate-raw")),
		).arrayBuffer(),
	);

export const zip = async (entries: [string, Uint8Array, boolean][]) => {
	const now = new Date();
	const time =
		(now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
	const date =
		((now.getFullYear() - 1980) << 9) |
		((now.getMonth() + 1) << 5) |
		now.getDate();
	const parts: BlobPart[] = [];
	const central: Uint8Array[] = [];
	let offset = 0;
	for (const [name, bytes, pack] of entries) {
		const title = new TextEncoder().encode(name);
		const body = pack ? await squeeze(bytes) : bytes;
		const crc = crc32(bytes);
		const local = new DataView(new ArrayBuffer(30));
		local.setUint32(0, 0x04034b50, true);
		local.setUint16(4, 20, true);
		local.setUint16(6, 0x0800, true);
		local.setUint16(8, pack ? 8 : 0, true);
		local.setUint16(10, time, true);
		local.setUint16(12, date, true);
		local.setUint32(14, crc, true);
		local.setUint32(18, body.length, true);
		local.setUint32(22, bytes.length, true);
		local.setUint16(26, title.length, true);
		const entry = new DataView(new ArrayBuffer(46));
		entry.setUint32(0, 0x02014b50, true);
		entry.setUint16(4, 20, true);
		entry.setUint16(6, 20, true);
		entry.setUint16(8, 0x0800, true);
		entry.setUint16(10, pack ? 8 : 0, true);
		entry.setUint16(12, time, true);
		entry.setUint16(14, date, true);
		entry.setUint32(16, crc, true);
		entry.setUint32(20, body.length, true);
		entry.setUint32(24, bytes.length, true);
		entry.setUint16(28, title.length, true);
		entry.setUint32(42, offset, true);
		parts.push(local, title, body as BlobPart);
		central.push(new Uint8Array(entry.buffer), title);
		offset += 30 + title.length + body.length;
	}
	const size = central.reduce((a, b) => a + b.length, 0);
	const end = new DataView(new ArrayBuffer(22));
	end.setUint32(0, 0x06054b50, true);
	end.setUint16(8, entries.length, true);
	end.setUint16(10, entries.length, true);
	end.setUint32(12, size, true);
	end.setUint32(16, offset, true);
	return new Blob([...parts, ...(central as BlobPart[]), end], {
		type: "application/zip",
	});
};
