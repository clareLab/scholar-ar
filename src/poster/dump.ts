import { serve } from "../../serve";

const [root, out, view = "0", search = ""] = process.argv.slice(2);

const server = await serve(root, `${import.meta.dir}/../../public/about.json`);

const { load } = await import("../data");
const { read, selection, where } = await import("../state");
const { lands } = await import("../tables");
const { poster } = await import("./data");

const meta = await load();
const pathname = where({ tab: "institutions", view: Number(view), lang: "en" });
const state = read({ pathname, search }, meta.nodes, lands(meta));
if (state.view !== Number(view)) throw new Error(`view ${view}`);
const data = await poster(meta, selection(state));

await Bun.write(out, JSON.stringify(data));
server.stop();
