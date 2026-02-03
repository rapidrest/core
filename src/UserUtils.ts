///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////

/**
 * Utilities for working with authenticated user objects. An user object is expected to have the following
 * properties.
 *
 * * `uid` - Universally unique identifier for the user
 * * `email` - Unique e-mail address for the user
 * * `roles` - A list of unique names indicating the permissions of the user.
 * * `verified` - Indicates if the user's e-mail address has been verified.
 *
 * @author Jean-Philippe Steinmetz <rapidrests@gmail.com>
 */
export class UserUtils {
    /**
     * Returns `true` if the given user object is a member of the organization with the specified uid, otherwise returns `false`.
     * @param user The user object to inspect.
     * @param organizationUid The universally unique identifier of the persona to search for.
     */
    public static hasOrganization(user: any, organizationUid: string): boolean {
        if (user && user.orgs && Array.isArray(user.orgs)) {
            for (const uid of user.orgs) {
                if (uid === organizationUid) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Returns `true` if the given user object contains is a member of an organization matching one of the uids in the specified list, otherwise returns `false`.
     * @param user The user object to inspect.
     * @param organizationUids The list of universally unique identifiers to search for.
     */
    public static hasOrganizations(user: any, organizationUids?: string[]): boolean {
        if (user && user.orgs && Array.isArray(user.orgs) && Array.isArray(organizationUids)) {
            for (const organizationUid of organizationUids) {
                for (const uid of user.orgs) {
                    if (uid === organizationUid) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Returns `true` if the given user object contains a `Persona` object with the specified uid, otherwise returns `false`.
     * @param user The user object to inspect.
     * @param personaUid The universally unique identifier of the persona to search for.
     */
    public static hasPersona(user: any, personaUid?: string): boolean {
        if (user && user.personas && Array.isArray(user.personas) && personaUid) {
            for (const persona of user.personas) {
                if (persona.uid === personaUid) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Returns `true` if the given user object contains a `Persona` object matching one of the uids in the specified list, otherwise returns `false`.
     * @param user The user object to inspect.
     * @param personaUid The list of universally unique identifiers to search for.
     */
    public static hasPersonas(user: any, personaUids?: string[]): boolean {
        if (user && user.personas && Array.isArray(user.personas) && Array.isArray(personaUids)) {
            for (const personaUid of personaUids) {
                for (const persona of user.personas) {
                    if (persona.uid === personaUid) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Returns the unique identifier of the specified type associated with the given user.
     * 
     * @param user The user to retrieve the external id from.
     * @param type The type of external provider to retrieve.
     * @returns The unique id of the external provider for the given type if found, otherwise `undefined`.
     */
    public static getExternalId(user: any, type: string): string | undefined {
        let result: string | undefined = undefined;

        if (user && Array.isArray(user.externalIds)) {
            for (const externalId of user.externalIds) {
                const parts: string[] = externalId.split(":");
                if (parts.length === 2 && parts[0] === type) {
                    result = parts[1];
                }
            }
        }

        return result;
    }

    /**
     * Returns `true` if the given user object has a role with the specified name, otherwise returns `false`.
     *
     * @param user The user object to inspect.
     * @param role The unique name of the role to search for.
     * @param orgUid The unique identifier of an organization whose role will be verified.
     */
    public static hasRole(user: any, role?: string, orgUid?: string): boolean {
        let result: boolean = false;

        if (user) {
            if (user.roles) {
                if (Array.isArray(user.roles)) {
                    result = user.roles.includes(role);

                    if (!result && orgUid !== "") {
                        result = user.roles.includes(`${orgUid}.${role}`);
                    }
                }
            }
        }

        return result;
    }

    /**
     * Returns `true` if the given user object has at least one role from the specified list of names, otherwise returns `false`.
     *
     * @param user The user object to inspect.
     * @param roles A list of unique names of the roles to search for.
     * @param orgUid The unique identifier of an organization whose role will be verified.
     */
    public static hasRoles(user: any, roles?: string[], orgUid?: string): boolean {
        if (user && user.roles && Array.isArray(user.roles) && Array.isArray(roles)) {
            for (const role of roles) {
                if (UserUtils.hasRole(user, role, orgUid)) {
                    return true;
                }
            }
        }

        return false;
    }
}
