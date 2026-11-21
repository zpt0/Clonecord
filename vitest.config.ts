import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const mock = fileURLToPath(new URL("./tests/helpers/vencord-mocks.ts", import.meta.url));
const jsxRuntime = fileURLToPath(new URL("./tests/helpers/jsx-runtime.ts", import.meta.url));

export default defineConfig({
    resolve: {
        alias: [
            { find: "react/jsx-dev-runtime", replacement: jsxRuntime },
            { find: "react/jsx-runtime", replacement: jsxRuntime },
            { find: "@webpack/common", replacement: mock },
            { find: "@webpack", replacement: mock },
            { find: /^@components\/.*$/, replacement: mock },
            { find: "@api/Settings", replacement: mock },
            { find: "@api/DataStore", replacement: mock },
            { find: "@api/ContextMenu", replacement: mock },
            { find: "@api/index", replacement: mock },
            { find: "@utils/Logger", replacement: mock },
            { find: "@utils/css", replacement: mock },
            { find: "@utils/types", replacement: mock },
            { find: "@utils/patches", replacement: mock },
            { find: "@utils/discord", replacement: mock },
        ],
    },
    test: {
        globals: true,
        environment: "node",
        setupFiles: ["./tests/helpers/setup.ts"],
    },
});
