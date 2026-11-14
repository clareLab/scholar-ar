import { plugin } from "bun";

export const respond = (root: string) => async (request: Request) => {
	const file = Bun.file(`${root}${new URL(request.url).pathname}`);
	if (!(await file.exists())) return new Response(null, { status: 404 });
	const range = request.headers.get("Range")?.match(/^bytes=(\d+)-(\d+)$/);
	if (!range) return new Response(file);
	const from = Number(range[1]);
	const to = Math.min(Number(range[2]), file.size - 1);
	return new Response(file.slice(from, to + 1), {
		status: 206,
		headers: { "Content-Range": `bytes ${from}-${to}/${file.size}` },
	});
};

export const serve = async (root: string, about: string) => {
	const { years, default_years } = await Bun.file(about).json();
	plugin({
		name: "years",
		setup: (build) => {
			build.module("virtual:years", () => ({
				exports: { years, defaults: default_years },
				loader: "object",
			}));
		},
	});
	const server = Bun.serve({ port: 0, fetch: respond(root) });
	process.env.VITE_API = server.url.href.replace(/\/$/, "");
	return server;
};
