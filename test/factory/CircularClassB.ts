///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
// SPDX-License-Identifier: MPL-2.0
///////////////////////////////////////////////////////////////////////////////
import { Destroy, Inject } from "../../src/decorators/ObjectDecorators.js";
import { CircularClassA } from "./CircularClassA.js";

export class CircularClassB {
    @Inject("CircularClassA")
    public dep?: CircularClassA;

    constructor() {
        // NO-OP
    }

    @Destroy
    public async destroy(): Promise<void> {
        this.dep = undefined;
    }
}
