import { describe, expect, it } from "vitest";
import {
    buildClosedTabSnapshot,
    buildSessionData,
    capturePresetLayout,
    materializeAfterSpawn,
    materializeChromeFrom,
    resolveInheritedCwds,
    resolvePaneCwds,
    zipFreshCwds,
    zipPolledCwds,
} from "./tab-materialize";
import type { PaneProcessInfo } from "../lib/process-info";
import { createMemoryPtyClient } from "./pty-client";

describe("zipPolledCwds / zipFreshCwds", () => {
    it("zips polled map with null for unknown ids", () => {
        const infoByPane = new Map<number, PaneProcessInfo>([
            [7, { id: 7, cwd: "/tmp", process: "zsh" }],
            [9, { id: 9, cwd: null, process: null }],
        ]);
        expect(zipPolledCwds([7, 8, 9], infoByPane)).toEqual(["/tmp", null, null]);
    });

    it("zips fresh infos in pane-id order", () => {
        const infos: PaneProcessInfo[] = [
            { id: 2, cwd: "/b", process: "zsh" },
            { id: 1, cwd: "/a", process: "zsh" },
        ];
        expect(zipFreshCwds([1, 2, 3], infos)).toEqual(["/a", "/b", null]);
    });
});

describe("resolvePaneCwds", () => {
    it("none → empty (Session chrome)", async () => {
        expect(await resolvePaneCwds([1, 2], "none")).toEqual([]);
    });

    it("given → provided list", async () => {
        expect(await resolvePaneCwds([1], "given", { provided: ["/ws"] })).toEqual(["/ws"]);
    });

    it("polled → zip against cache", async () => {
        const polled = new Map<number, PaneProcessInfo>([[1, { id: 1, cwd: "/polled", process: "zsh" }]]);
        expect(await resolvePaneCwds([1, 2], "polled", { polled })).toEqual(["/polled", null]);
    });

    it("fresh → uses injected PtyClient (no module mock)", async () => {
        const infos = new Map<number, PaneProcessInfo>([
            [4, { id: 4, cwd: "/fresh/4", process: "zsh" }],
            [5, { id: 5, cwd: "/fresh/5", process: "zsh" }],
        ]);
        const pty = createMemoryPtyClient({ infos });
        expect(await resolvePaneCwds([4, 5], "fresh", { pty })).toEqual([
            "/fresh/4",
            "/fresh/5",
        ]);
    });
});

describe("capturePresetLayout", () => {
    it("threads PtyClient for fresh CWDs", async () => {
        const infos = new Map<number, PaneProcessInfo>([
            [1, { id: 1, cwd: "/a", process: "zsh" }],
        ]);
        const pty = createMemoryPtyClient({ infos });
        await expect(
            capturePresetLayout([1], { type: "leaf" }, pty),
        ).resolves.toEqual({ layout: { type: "leaf" }, cwds: ["/a"] });
    });
});

describe("resolveInheritedCwds", () => {
    it("fills missing preset CWDs from inherit", () => {
        expect(
            resolveInheritedCwds(
                {
                    type: "split",
                    direction: "row",
                    ratio: 0.5,
                    first: { type: "leaf" },
                    second: { type: "leaf" },
                },
                ["/preset"],
                "/inherit",
            ),
        ).toEqual(["/preset", "/inherit"]);
    });

    it("uses inherit for every leaf when preset has no cwds", () => {
        expect(resolveInheritedCwds({ type: "leaf" }, undefined, "/home")).toEqual(["/home"]);
    });
});

describe("materializeAfterSpawn", () => {
    const layout = { type: "leaf" as const };

    it("Open board / preset → select + pollAndAgentPick", () => {
        expect(
            materializeAfterSpawn({
                layout,
                cwds: ["/ws"],
                agentPick: "all-new-panes",
            }),
        ).toEqual({ selectTab: true, pollAndAgentPick: true });
    });

    it("Closed tab reopen → select only", () => {
        expect(
            materializeAfterSpawn({
                layout,
                cwds: ["/a"],
                agentPick: "none",
            }),
        ).toEqual({ selectTab: true, pollAndAgentPick: false });
    });

    it("Session batch → neither (caller selects once at end)", () => {
        expect(
            materializeAfterSpawn({
                layout,
                cwds: [],
                agentPick: "none",
                activate: false,
            }),
        ).toEqual({ selectTab: false, pollAndAgentPick: false });
    });
});

describe("materializeChromeFrom", () => {
    it("returns undefined when both absent", () => {
        expect(materializeChromeFrom(null, null)).toBeUndefined();
        expect(materializeChromeFrom(undefined, undefined)).toBeUndefined();
    });

    it("keeps name and/or dotColor", () => {
        expect(materializeChromeFrom("A", null)).toEqual({ name: "A" });
        expect(materializeChromeFrom(null, "cyan")).toEqual({ dotColor: "cyan" });
    });
});

describe("buildSessionData", () => {
    it("returns null for empty tabs", () => {
        expect(buildSessionData([], 0)).toBeNull();
    });

    it("omits CWDs and clamps activeTab", () => {
        const data = buildSessionData(
            [
                { layout: { type: "leaf" }, name: "A" },
                { layout: { type: "leaf" }, dotColor: "cyan" },
            ],
            99,
        );
        expect(data).toEqual({
            version: 1,
            activeTab: 1,
            tabs: [
                { layout: { type: "leaf" }, name: "A" },
                { layout: { type: "leaf" }, dotColor: "cyan" },
            ],
        });
    });
});

describe("buildClosedTabSnapshot", () => {
    it("carries layout chrome + resolved cwds", () => {
        expect(
            buildClosedTabSnapshot({
                layout: { type: "leaf" },
                name: "x",
                dotColor: null,
                cwds: ["/a"],
            }),
        ).toEqual({
            layout: { type: "leaf" },
            name: "x",
            dotColor: null,
            cwds: ["/a"],
        });
    });
});
