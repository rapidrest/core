///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { JWTUtils, JWTUtilsCompressionMethods, JWTPayload } from "../src/JWTUtils.js";
import { describe, it, expect } from "vitest";
describe("JWTUtils Tests.", () => {
    const testUser = {
        uid: "2dfbae90-7965-461a-b265-d904fad9b2d7",
        name: "test@gmail.com",
        roles: ["role1", "role2"],
        verified: true
    };
    const config = {
        secret: "MyPasswordIsSecure",
        options: {
            audience: "rapidrest.dev",
            issuer: "rapidrest.dev",
        },
    };
    const compressConfig = {
        secret: "MyPasswordIsSecure",
        options: {
            audience: "rapidrest.dev",
            issuer: "rapidrest.dev",
        },
        payload: {
            compress: JWTUtilsCompressionMethods.ZLIB,
            encrypt: false,
        },
    };
    const encryptConfig = {
        secret: "MyPasswordIsSecure",
        options: {
            audience: "rapidrest.dev",
            issuer: "rapidrest.dev",
        },
        payload: {
            compress: undefined,
            encrypt: true,
            iv: crypto.randomBytes(16),
            algorithm: "aes-192-cbc",
            password: "MyPasswordIsSecure",
        },
    };
    const encryptKeyConfig = {
        secret: "MyPasswordIsSecure",
        options: {
            audience: "rapidrest.dev",
            issuer: "rapidrest.dev",
        },
        payload: {
            compress: undefined,
            encrypt: true,
            algorithm: "aes-192-cbc",
            iv: crypto.randomBytes(16),
            private_key: `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0O/GdhAFWjxwIQgL18HjmAhsC5puWF7fxloLPNro5P0j/0ky
KKTrjy1QomhrbMtI9GSMEytA6HqBeUgps8l4QaBT7wTcxu8tPlbNsv+Y6BSkd7rR
0OumMhM+VTemOZsclEM2NDb4PhndrjvQApSP3HfClk9AzJHwFegSWa5oWgz9sb6K
KVAljUVB+EhaZSsJxDWrrHS5NWzuLWsz5nLKjXpEeoAvrE1gWvUyE1gdmG6xeUSL
7zsI3YksYSrRu9woZ/eKNiTKGZSnZbEuAL2yVpPwp9paxubbF7vYV3T8iyQxkxB5
FK/Fw6Y41iRN64uey6R5xQ5m14GCGkrxoYKuuwIDAQABAoIBAEzFngXpsx3KEWWB
wGBCJS/LAHBvCVa9XbpTgceVpHfnsB9wtNaMauXMP9G9TqPGOoNaosG0ZgBGa2a2
JmSiheaPU+gCwGD0p4o9eQ3przSvyRMZeVksDYBe48uKTDDklua/n54mCKdA99y6
q58XGZloA/8ZFfVVNoPGJ1/+nudfLdzbI+szrIDiMTwbXOJlwPnjisE5NkdmipdM
Ycn/zGQFOyhCjtKQ/Ms//vhMHegbW9notdgcdQRnkPNzgxutmrmUyAvJgemGa1aj
OgwBPaaJJMF9gQ/YeTa9CQ0HS9LnMjd8IoPQ06lwB379nXAVHyM4egY5ASSH04xp
b/Tzu/ECgYEA/yDvfVvYSGDax/dY9tmaEBbvcatp2fn07gVmwRQ3wuDQydQ7SlHQ
CEWUbxdJdtTqdmPc7SeeTcjQMVt3yx0d2phCx1C+XvVIe1jtK5BR4iC4OUdS3qyR
eICe1KsUlN0yRoYKxqwwLbTHQ2XD2QKhC8RdUy1u39L6l+5oM9/dlLkCgYEA0aZz
+ntsk8MRa9RiwRaJKxexkcY7uct29XldTLof1RAuTFuZ+94/56kQKBy2zpsFYnp8
qUN6nX83MjTc+sk3Z9VjYD85bqZMROooDHC0gqPQj7/XlPbtZOUZIC83dO8XGney
zwQj4Ik2nDxeqojkoR8H/ZpoejD2ytRPNsB9TRMCgYEA0IHhWMmMPLLzewP6sFvs
3oNwE60s6FmxRCoj7V6Rp/JGkPyjrDyq0WfUROp6PuUJ7dH1x9heN2IMTJpdkCFu
ua1AvlaOD1tVboGh672aPj3RcfaJkrTkeuBbbqGXQ4Z3xU1dVzt4cJJTXBC6fAv7
BHvqbcUu3Tw3U54jiWnHVPkCgYAeGVizUH8BI9NfeMmI0TR2RFuRAzXV8dktWvRD
LMGfNEiBW/FakMj5+HLCX4T7WpRGVDGLl42GCRqikaZcNwFGXgN7cPhM44E1r6x6
RMAVtXEfAjrwPxdMEfwue7jph934RdEdGYoRFYIKojwxHaA9ZZgfF8kCKf90lVCe
GrqikwKBgQCwH/MxL9E50qEVQNysxsvEgdNdVMctrAeeAdUCaTrQliAIgCTRopGy
0I94I2TqnlQHqHvmyvhCoDwQqgfFOoFBkQYRikpLei0CYIFondeNLWt0chTVXlh8
X/RSNvpfoQMjvNFxa+qpRTfH4SFU2eOXBoGS7qrR2aRP7QAtuW2gbw==
-----END RSA PRIVATE KEY-----
`,
            public_key: `ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDQ78Z2EAVaPHAhCAvXweOYCGwLmm5YXt/GWgs82ujk/SP/STIopOuPLVCiaGtsy0j0ZIwTK0DoeoF5SCmzyXhBoFPvBNzG7y0+Vs2y/5joFKR3utHQ66YyEz5VN6Y5mxyUQzY0Nvg+Gd2uO9AClI/cd8KWT0DMkfAV6BJZrmhaDP2xvoopUCWNRUH4SFplKwnENausdLk1bO4tazPmcsqNekR6gC+sTWBa9TITWB2YbrF5RIvvOwjdiSxhKtG73Chn94o2JMoZlKdlsS4AvbJWk/Cn2lrG5tsXu9hXdPyLJDGTEHkUr8XDpjjWJE3ri57LpHnFDmbXgYIaSvGhgq67 jpsteinmetz@Jane`,
        },
    };

    it("Can create JWT token.", () => {
        let token = JWTUtils.createToken(config, testUser);
        expect(token).toBeDefined();
        expect(() => {
            jwt.verify(token, config.secret, config.options);
        }).not.toThrow();
    });

    it("Can create compressed JWT token.", () => {
        let token = JWTUtils.createToken(compressConfig, testUser);
        expect(token).toBeDefined();
        expect(() => {
            jwt.verify(token, config.secret, config.options);
        }).not.toThrow();
    });

    it("Can create encrypted JWT token.", () => {
        let token = JWTUtils.createToken(encryptConfig, testUser);
        expect(token).toBeDefined();
        const payload: any = jwt.verify(token, encryptConfig.secret, encryptConfig.options);
        expect(payload).toBeDefined();
    });

    it.skip("Can create encrypted JWT token with public/private keys.", () => {
        let token = JWTUtils.createToken(encryptKeyConfig, testUser);
        expect(token).toBeDefined();
        const payload: any = jwt.verify(token, encryptKeyConfig.secret, encryptKeyConfig.options);
        expect(payload).toBeDefined();
    });

    it("Can decode JWT token.", () => {
        const token = JWTUtils.createToken(config, testUser);
        expect(token).toBeDefined();
        jwt.verify(token, config.secret, config.options);
        const payload: JWTPayload = JWTUtils.decodeToken(config, token);
        expect(payload.profile).toEqual(testUser);
    });

    it("Can decode compressed JWT token.", () => {
        const token = JWTUtils.createToken(compressConfig, testUser);
        expect(token).toBeDefined();
        jwt.verify(token, compressConfig.secret, compressConfig.options);
        const payload: JWTPayload = JWTUtils.decodeToken(compressConfig, token);
        expect(payload.profile).toEqual(testUser);
        expect(payload.compression).toBe(JWTUtilsCompressionMethods.ZLIB);
    });

    it("Can decode encrypted JWT token.", () => {
        const token = JWTUtils.createToken(encryptConfig, testUser);
        expect(token).toBeDefined();
        jwt.verify(token, encryptConfig.secret, encryptConfig.options);
        const payload: JWTPayload = JWTUtils.decodeToken(encryptConfig, token);
        expect(payload.profile).toEqual(testUser);
        expect(payload.encryption).toBeTruthy();
    });

    it.skip("Can decode encrypted JWT token with public/private keys.", () => {
        const token = JWTUtils.createToken(encryptKeyConfig, testUser);
        expect(token).toBeDefined();
        jwt.verify(token, encryptKeyConfig.secret, encryptKeyConfig.options);
        const payload: JWTPayload = JWTUtils.decodeToken(encryptKeyConfig, token);
        expect(payload.profile).toEqual(testUser);
        expect(payload.encryption).toBeTruthy();
    });
});
