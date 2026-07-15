///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import config from "./config.js";
import { ObjectFactory } from "../src/ObjectFactory.js";
import { ObjectDecorators } from "../src/decorators";
import { Logger } from "../src/Logger.js";
import { describe, it, expect } from "vitest";
const { Config } = ObjectDecorators;

class TestConfigInjectClass {
    @Config()
    public wholeConfig: any;
}

describe("ObjectDecorators Tests", () => {
    it("Can inject the entire configuration object when no path is given to @Config().", async () => {
        const factory: ObjectFactory = new ObjectFactory(config, Logger());
        factory.register(TestConfigInjectClass);
        const instance: TestConfigInjectClass = await factory.newInstance(TestConfigInjectClass);
        expect(instance).toBeDefined();
        expect(instance.wholeConfig).toBe(config);
    });
});
