import { describe, it, expect } from "vitest";
import { analyzeChannelVisibility } from "../channelVisibility";

const CHANNEL_OBFUSCATED = 1 << 17;

describe("analyzeChannelVisibility", () => {
    it("keeps only channels Discord actually sent us", () => {
        const result = analyzeChannelVisibility(
            [
                { id: "1", name: "general", type: 0 },
                { id: "2", name: "___hidden___", type: 0, flags: CHANNEL_OBFUSCATED },
            ],
            ["1"]
        );

        expect(result.cloneable.map((c) => c.id)).toEqual(["1"]);
        expect(result.obfuscated.map((c) => c.id)).toEqual(["2"]);
        expect(result.missing).toHaveLength(0);
    });

    it("reports channels the REST endpoint omitted as obfuscated", () => {
        const result = analyzeChannelVisibility(
            [
                { id: "1", name: "general", type: 0 },
                { id: "2", name: "secret", type: 0 },
            ],
            ["1"]
        );

        expect(result.cloneable.map((c) => c.id)).toEqual(["1"]);
        expect(result.obfuscated.map((c) => c.id)).toEqual(["2"]);
        expect(result.missing).toHaveLength(0);
    });

    it("treats the placeholder name as obfuscated even without the flag", () => {
        const result = analyzeChannelVisibility(
            [{ id: "2", name: "___hidden___", type: 0 }],
            ["2"]
        );

        expect(result.obfuscated.map((c) => c.id)).toEqual(["2"]);
        expect(result.cloneable).toHaveLength(0);
    });

    it("keeps categories Discord sent us", () => {
        const result = analyzeChannelVisibility([{ id: "cat", name: "Private", type: 4 }], ["cat"]);

        expect(result.cloneable.map((c) => c.id)).toEqual(["cat"]);
    });

    it("reports channels with no usable data as missing", () => {
        const result = analyzeChannelVisibility([{ id: "2", name: "", type: 0 }], ["2"]);

        expect(result.cloneable).toHaveLength(0);
        expect(result.missing.map((c) => c.id)).toEqual(["2"]);
    });
});
