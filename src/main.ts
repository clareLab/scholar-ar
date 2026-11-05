import "./style.scss";
import { mount } from "svelte";
import App from "./App.svelte";
import { load } from "./data";

mount(App, { target: document.body, props: { meta: await load() } });
