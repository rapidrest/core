///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import { UserUtils } from "../src/UserUtils.js";
import { v4 as uuidV4 } from "uuid";
import { describe, it, expect } from "vitest";
describe("UserUtils Tests.", () => {
    const orgUid: string = uuidV4();
    const testUser = {
        uid: uuidV4(),
        email: "test@gmail.com",
        roles: ["role1", "role2", `${orgUid}.role3`, `${orgUid}.role4`],
        personas: [{ uid: uuidV4() }, { uid: uuidV4() }, { uid: uuidV4() }],
        externalIds: [`facebook:89761181`, `twitter:567896132`],
        orgs: [orgUid],
        scopes: ["profile", "email"],
    };

    it("Can get external id.", () => {
        expect(UserUtils.getExternalId(testUser, "facebook")).toBe("89761181");
        expect(UserUtils.getExternalId(testUser, "twitter")).toBe("567896132");
        expect(UserUtils.getExternalId(testUser, "google")).toBeUndefined();
    });

    it("Can check for single organization.", () => {
        expect(UserUtils.hasOrganization(testUser, orgUid)).toBe(true);
        expect(UserUtils.hasOrganization(testUser, uuidV4())).toBe(false);
    });

    it("hasOrganization returns false for a missing or malformed user.", () => {
        expect(UserUtils.hasOrganization(undefined, orgUid)).toBe(false);
        expect(UserUtils.hasOrganization({}, orgUid)).toBe(false);
        expect(UserUtils.hasOrganization({ orgs: "not-an-array" }, orgUid)).toBe(false);
    });

    it("Can check for multiple organizations.", () => {
        expect(UserUtils.hasOrganizations(testUser, [orgUid, uuidV4()])).toBe(true);
        expect(UserUtils.hasOrganizations(testUser, [])).toBe(false);
        expect(UserUtils.hasOrganizations(testUser, [uuidV4(), uuidV4()])).toBe(false);
    });

    it("hasOrganizations returns false for a missing or malformed user/organizationUids.", () => {
        expect(UserUtils.hasOrganizations(undefined, [orgUid])).toBe(false);
        expect(UserUtils.hasOrganizations({}, [orgUid])).toBe(false);
        expect(UserUtils.hasOrganizations(testUser, undefined)).toBe(false);
        expect(UserUtils.hasOrganizations(testUser, "not-an-array" as any)).toBe(false);
    });

    it("getExternalId returns undefined for a missing or malformed user.", () => {
        expect(UserUtils.getExternalId(undefined, "facebook")).toBeUndefined();
        expect(UserUtils.getExternalId({}, "facebook")).toBeUndefined();
        expect(UserUtils.getExternalId({ externalIds: "not-an-array" }, "facebook")).toBeUndefined();
    });

    it("Can check for single role.", () => {
        expect(UserUtils.hasRole(testUser, "role1")).toBe(true);
        expect(UserUtils.hasRole(testUser, "role2")).toBe(true);
        expect(UserUtils.hasRole(testUser, "role3")).toBe(false);
        expect(UserUtils.hasRole(testUser, "role4")).toBe(false);
    });

    it("hasRole returns false for a missing or malformed user.", () => {
        expect(UserUtils.hasRole(undefined, "role1")).toBe(false);
        expect(UserUtils.hasRole({}, "role1")).toBe(false);
        expect(UserUtils.hasRole({ roles: "not-an-array" }, "role1")).toBe(false);
    });

    it("hasRoles returns false for a missing or malformed user/roles.", () => {
        expect(UserUtils.hasRoles(undefined, ["role1"])).toBe(false);
        expect(UserUtils.hasRoles({}, ["role1"])).toBe(false);
        expect(UserUtils.hasRoles(testUser, undefined)).toBe(false);
        expect(UserUtils.hasRoles(testUser, "not-an-array" as any)).toBe(false);
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

    it("Can check for single scope.", () => {
        expect(UserUtils.hasScope(testUser, "profile")).toBe(true);
        expect(UserUtils.hasScope(testUser, "email")).toBe(true);
        expect(UserUtils.hasScope(testUser, "admin")).toBe(false);
    });

    it("hasScope returns false for a missing or malformed user.", () => {
        expect(UserUtils.hasScope(undefined, "profile")).toBe(false);
        expect(UserUtils.hasScope({}, "profile")).toBe(false);
        expect(UserUtils.hasScope({ scopes: "not-an-array" }, "profile")).toBe(false);
    });

    it("Can check for multiple scopes.", () => {
        expect(UserUtils.hasScopes(testUser, ["profile", "admin"])).toBe(true);
        expect(UserUtils.hasScopes(testUser, ["admin", "superuser"])).toBe(false);
    });

    it("hasScopes returns false for a missing or malformed user.", () => {
        expect(UserUtils.hasScopes(undefined, ["profile"])).toBe(false);
        expect(UserUtils.hasScopes({}, ["profile"])).toBe(false);
        expect(UserUtils.hasScopes({ scopes: "not-an-array" }, ["profile"])).toBe(false);
    });

    it("hasScopes returns false instead of throwing when scopes is missing or malformed.", () => {
        expect(UserUtils.hasScopes(testUser, undefined)).toBe(false);
        expect(UserUtils.hasScopes(testUser, "not-an-array" as any)).toBe(false);
    });
});
