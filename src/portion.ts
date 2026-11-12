import { drop, type Node, stalls } from "./data";

type Ask = { key: string; level: Node["level"]; id: number; span: number[] };

addEventListener(
	"message",
	async ({ data: { key, level, id, span } }: MessageEvent<Ask>) => {
		const node = { id, level, name: "", children: [] } as Node;
		node.children.push(node);
		try {
			const files = await stalls(node, span, false, ["child", "tier", "mass"]);
			const parts = new Map<number, number[]>();
			const sum = [0, 0, 0, 0, 0];
			for (const { child, tier: t, mass } of files)
				for (let r = 0; r < child.length; r++) {
					let part = parts.get(child[r]);
					if (!part) {
						part = [0, 0, 0, 0, 0];
						parts.set(child[r], part);
					}
					part[t[r]] += mass[r];
					sum[t[r]] += mass[r];
				}
			postMessage({ key, parts, sum });
		} catch {
			postMessage({ key });
		}
		drop(`views/${level}/${id}`);
	},
);
