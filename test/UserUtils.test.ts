///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import { UserUtils } from "../src/UserUtils.js";
import * as uuid from "uuid";
import { describe, it, expect } from "vitest";
describe("UserUtils Tests.", () => {
    const orgUid: string = uuid.v4();
    const testUser = {
        uid: uuid.v4(),
        email: "test@gmail.com",
        roles: ["role1", "role2", `${orgUid}.role3`, `${orgUid}.role4`],
        personas: [{ uid: uuid.v4() }, { uid: uuid.v4() }, { uid: uuid.v4() }],
        externalIds: [`facebook:89761181`, `twitter:567896132`],
        orgs: [orgUid],
    };

    it("Can get external id.", () => {
        expect(UserUtils.getExternalId(testUser, "facebook")).toBe("89761181");
        expect(UserUtils.getExternalId(testUser, "twitter")).toBe("567896132");
        expect(UserUtils.getExternalId(testUser, "google")).toBeUndefined();
    });

    it("Can check for single organization.", () => {
        expect(UserUtils.hasOrganization(testUser, orgUid)).toBe(true);
        expect(UserUtils.hasOrganization(testUser, uuid.v4())).toBe(false);
    });

    it("Can check for multiple organizations.", () => {
        expect(UserUtils.hasOrganizations(testUser, [orgUid, uuid.v4()])).toBe(true);
        expect(UserUtils.hasOrganizations(testUser, [])).toBe(false);
        expect(UserUtils.hasOrganizations(testUser, [uuid.v4(), uuid.v4()])).toBe(false);
    });

    it("Can check for single role.", () => {
        expect(UserUtils.hasRole(testUser, "role1")).toBe(true);
        expect(UserUtils.hasRole(testUser, "role2")).toBe(true);
        expect(UserUtils.hasRole(testUser, "role3")).toBe(false);
        expect(UserUtils.hasRole(testUser, "role4")).toBe(false);
    });

    it("Can check for multiple roles.", () => {
        expect(UserUtils.hasRoles(testUser, ["role1", "role2"])).toBe(true);
        expect(UserUtils.hasRoles(testUser, ["role1", "role3"])).toBe(true);
        expect(UserUtils.hasRoles(testUser, ["role4", "role2"])).toBe(true);
        expect(UserUtils.hasRoles(testUser, [])).toBe(false);
        expect(UserUtils.hasRoles(testUser, ["role3", "role4"])).toBe(false);
    });

    it("Can check for single role in organization.", () => {
        expect(UserUtils.hasRole(testUser, "role1")).toBe(true);
        expect(UserUtils.hasRole(testUser, "role2")).toBe(true);
        expect(UserUtils.hasRole(testUser, "role3")).toBe(false);
        expect(UserUtils.hasRole(testUser, "role3", orgUid)).toBe(true);
        expect(UserUtils.hasRole(testUser, "role4")).toBe(false);
        expect(UserUtils.hasRole(testUser, "role4", orgUid)).toBe(true);
    });

    it("Can check for multiple roles in organization.", () => {
        expect(UserUtils.hasRoles(testUser, ["role1", "role2"])).toBe(true);
        expect(UserUtils.hasRoles(testUser, ["role1", "role3"])).toBe(true);
        expect(UserUtils.hasRoles(testUser, ["role4", "role2"])).toBe(true);
        expect(UserUtils.hasRoles(testUser, [])).toBe(false);
        expect(UserUtils.hasRoles(testUser, ["role3", "role4"])).toBe(false);
        expect(UserUtils.hasRoles(testUser, ["role3", "role4"], orgUid)).toBe(true);
        expect(UserUtils.hasRoles(testUser, ["role3", "role5"], orgUid)).toBe(true);
        expect(UserUtils.hasRoles(testUser, ["role4", "role5"], orgUid)).toBe(true);
    });

    it("Can check for single persona.", () => {
        expect(UserUtils.hasPersona(testUser, testUser.personas[0].uid)).toBe(true);
        expect(UserUtils.hasPersona(testUser, testUser.personas[1].uid)).toBe(true);
        expect(UserUtils.hasPersona(testUser, testUser.personas[2].uid)).toBe(true);
        expect(UserUtils.hasPersona(testUser, uuid.v4())).toBe(false);
    });

    it("Can check for multiple personas.", () => {
        const personaUids: string[] = [testUser.personas[0].uid, testUser.personas[1].uid];
        expect(UserUtils.hasPersonas(testUser, personaUids)).toBe(true);
        expect(UserUtils.hasPersonas(testUser, [uuid.v4()])).toBe(false);
        expect(UserUtils.hasPersonas(testUser, [uuid.v4(), uuid.v4(), uuid.v4()])).toBe(false);
    });
});
