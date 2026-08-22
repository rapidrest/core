import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        reporters: [
            "verbose",
            ["junit", { outputFile: "junit.xml" }]
        ],
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov", "html"],
            include: ["src/**/*.ts"],
            exclude: ["test/**"],
            thresholds: {
                lines: 100,
                functions: 100,
                branches: 100,
                statements: 100,
            },
        },
    },
});
