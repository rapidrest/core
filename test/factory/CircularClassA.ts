///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
// SPDX-License-Identifier: MPL-2.0
///////////////////////////////////////////////////////////////////////////////
import { Destroy, Inject } from "../../src/decorators/ObjectDecorators.js";
import { CircularClassB } from "./CircularClassB.js";

export class CircularClassA {
    @Inject("CircularClassB")
    public dep?: CircularClassB;

    constructor() {
        // NO-OP
    }

    @Destroy
    public async destroy(): Promise<void> {
        this.dep = undefined;
    }
}
