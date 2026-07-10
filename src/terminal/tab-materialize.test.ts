import { describe, expect, it, vi } from "vitest";
import {
    buildClosedTabSnapshot,
    buildSessionData,
    resolvePaneCwds,
    zipFreshCwds,
    zipPolledCwds,
} from "./tab-materialize";
import type { PaneProcessInfo } from "../lib/process-info";

vi.mock("./pane-info", () => ({
    freshPaneInfo: vi.fn(async (ids: readonly number[]) =>
        ids.map(
            (id): PaneProcessInfo => ({
                id,
                cwd: `/fresh/${id}`,
                process: "zsh",
            }),
        ),
    ),
}));

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

    it("fresh → one-shot pty_info", async () => {
        expect(await resolvePaneCwds([4, 5], "fresh")).toEqual(["/fresh/4", "/fresh/5"]);
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
