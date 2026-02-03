import { Init, Inject } from "../../src/decorators/ObjectDecorators.js";
import { ClassC } from "./ClassC.js";

export class ClassD {
    @Inject(ClassC, { name: "default", args: [64] })
    public injected?: ClassC;

    @Init
    private init() {
        if (this.injected?.myProp !== 64) {
            throw new Error("ClassC was not injected properly!");
        }
    }
}
