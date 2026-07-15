///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import fs from "fs";
import { OASUtils } from "../src/OASUtils.js";
import nock from "nock";
import * as rimraf from "rimraf";
import { mkdirp } from "mkdirp";
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";

// Allows individual tests to force the response returned by `Axios#get` in order to exercise response-shape
// edge cases (e.g. an already-parsed object body) that cannot occur through nock + the real HTTP transport.
let axiosGetOverride: ((url: string, config?: any) => Promise<any>) | null = null;
vi.mock("axios", async (importOriginal) => {
    const actual: any = await importOriginal();
    class TestAxios extends actual.Axios {
        async get(url: string, config?: any) {
            if (axiosGetOverride) {
                const override = axiosGetOverride;
                axiosGetOverride = null;
                return override(url, config);
            }
            return super.get(url, config);
        }
    }
    return { ...actual, Axios: TestAxios };
});

describe("OASUtils Tests", () => {
    let yaml: string;
    let json: string;

    afterEach(() => {
        axiosGetOverride = null;
    });

    beforeAll(async () => {
        yaml = `
    openapi: 3.0.1
    info:
      description: An API spec for a micro-service.
      version: 1.0.0
      title: CRUDS Template
      termsOfService: 'http://rapidrest.dev/terms/'
      contact:
        email: rapidrests@gmail.com
      license:
        name: Apache 2.0
        url: 'http://www.apache.org/licenses/LICENSE-2.0.html'
    components:
      x-datastores:
        testdb:
          type: mongodb
          url: 'mongodb://localhost'
      parameters:
        id:
          name: id
          description: The unique identifier of the object.
          in: path
          required: true
          schema:
            type: string
        jwt_token:
          name: jwt_token
          in: query
          description: The JWT access token to use for user authentication.
          required: false
          schema:
            type: string
        maxResults:
          name: maxResults
          in: query
          description: The maximum number of results to return. Cannot exceed 1000.
          required: false
          schema:
            type: integer
            format: int32
        page:
          name: page
          in: query
          description: 'The page number, or offset, of the search results to search for and return.'
          required: false
          schema:
            type: integer
            format: int32
        sort:
          name: sort
          in: query
          description: 'A mapping of property to 1 or -1 that indicates the order to sort results by. 1 indicates ascending order, -1 descending.'
          required: false
          schema:
            type: string
      schemas:
        authToken:
          type: object
          properties:
            token:
              type: string
              format: JWT
        count:
          type: object
          properties:
            count:
              type: integer
              format: int
        Item:
          type: object
          x-dbId: mongo1
          properties:
            uid:
              type: string
              format: uuid
              nullable: false
              x-identifier: true
              x-index: true
              x-unique: true
            dateCreated:
              type: string
              format: date-time
              nullable: false
            dateModified:
              type: string
              format: date-time
              nullable: false
            version:
              type: integer
              nullable: false
              default: 0
            userId:
              type: string
              format: uuid
              nullable: false
            name:
              type: string
              nullable: false
              x-identifier: true
              x-index: true
              x-unique: true
            description:
              type: string
            quantity:
              type: integer
            metaData:
              type: object
              additionalProperties:
                type: string
      securitySchemes:
        jwt:
          type: http
          scheme: bearer
          bearerFormat: JWT
        basic:
          type: http
          scheme: basic
    paths:
      /items:
        parameters:
          - $ref: '#/components/parameters/jwt_token'
        get:
          parameters:
            - $ref: '#/components/parameters/maxResults'
            - $ref: '#/components/parameters/page'
            - $ref: '#/components/parameters/sort'
          description: Returns all items from the system that the user has access to
          x-routeTypes:
            - findAll
          x-schema: Item
          responses:
            '200':
              description: A list of items.
              content:
                application/json:
                  schema:
                    type: array
                    items:
                      $ref: '#/components/schemas/Item'
          security:
            - jwt: []
        post:
          description: Create a new item
          x-routeTypes:
            - create
          x-schema: Item
          requestBody:
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/Item'
          responses:
            '201':
              description: The newly created item.
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/Item'
          security:
            - jwt: []
      /items/count:
        parameters:
          - $ref: '#/components/parameters/jwt_token'
        get:
          description: Returns the count of items
          x-routeTypes:
            - count
          x-schema: Item
          responses:
            '200':
              description: The number of found items matching the search criteria.
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/count'
          security:
            - jwt: []
      '/items/{id}':
        parameters:
          - $ref: '#/components/parameters/id'
          - $ref: '#/components/parameters/jwt_token'
        get:
          description: Returns a single item from the system that the user has access to
          x-routeTypes:
            - findById
          x-schema: Item
          responses:
            '200':
              description: A item object.
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/Item'
          security:
            - jwt: []
        put:
          description: Updates a single item
          x-routeTypes:
            - update
          x-schema: Item
          requestBody:
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/Item'
          responses:
            '200':
              description: The updated item object
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/Item'
          security:
            - jwt: []
        delete:
          description: Deletes the item
          x-routeTypes:
            - delete
          x-schema: Item
          responses:
            '200':
              description: No content
          security:
            - jwt: []
    externalDocs:
      description: Powered by RapidREST Core technology.
      url: 'https://rapidrest.dev'
    `;
        json = `
    {
      "openapi": "3.0.1",
      "info": {
        "description": "An API spec for a micro-service.",
        "version": "1.0.0",
        "title": "CRUDS Template",
        "termsOfService": "http://rapidrest.dev/terms/",
        "contact": {
          "email": "rapidrests@gmail.com"
        },
        "license": {
          "name": "Apache 2.0",
          "url": "http://www.apache.org/licenses/LICENSE-2.0.html"
        }
      },
      "components": {
        "x-datastores": {
          "testdb": {
            "type": "mongodb",
            "url": "mongodb://localhost"
          }
        },
        "parameters": {
          "id": {
            "name": "id",
            "description": "The unique identifier of the object.",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
        "jwt_token": {
            "name": "jwt_token",
            "in": "query",
            "description": "The JWT access token to use for user authentication.",
            "required": false,
            "schema": {
              "type": "string"
            }
          },
          "maxResults": {
            "name": "maxResults",
            "in": "query",
            "description": "The maximum number of results to return. Cannot exceed 1000.",
            "required": false,
            "schema": {
              "type": "integer",
              "format": "int32"
            }
          },
          "page": {
            "name": "page",
            "in": "query",
            "description": "The page number, or offset, of the search results to search for and return.",
            "required": false,
            "schema": {
              "type": "integer",
              "format": "int32"
            }
          },
          "sort": {
            "name": "sort",
            "in": "query",
            "description": "A mapping of property to 1 or -1 that indicates the order to sort results by. 1 indicates ascending order, -1 descending.",
            "required": false,
            "schema": {
              "type": "string"
            }
          }
        },
        "schemas": {
          "authToken": {
            "type": "object",
            "properties": {
              "token": {
                "type": "string",
                "format": "JWT"
              }
            }
          },
          "count": {
            "type": "object",
            "properties": {
              "count": {
                "type": "integer",
                "format": "int"
              }
            }
          },
          "Item": {
            "type": "object",
            "x-dbId": "mongo1",
            "properties": {
              "uid": {
                "type": "string",
                "format": "uuid",
                "nullable": false,
                "x-identifier": true,
                "x-index": true,
                "x-unique": true
              },
              "dateCreated": {
                "type": "string",
                "format": "date-time",
                "nullable": false
              },
              "dateModified": {
                "type": "string",
                "format": "date-time",
                "nullable": false
              },
              "version": {
                "type": "integer",
                "nullable": false,
                "default": 0
              },
              "userId": {
                "type": "string",
                "format": "uuid",
                "nullable": false
              },
              "name": {
                "type": "string",
                "nullable": false,
                "x-identifier": true,
                "x-index": true,
                "x-unique": true
              },
              "description": {
                "type": "string"
              },
              "quantity": {
                "type": "integer"
              },
              "metaData": {
                "type": "object",
                "additionalProperties": {
                  "type": "string"
                }
              }
            }
          }
        },
        "securitySchemes": {
          "jwt": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT"
          },
          "basic": {
            "type": "http",
            "scheme": "basic"
          }
        }
      },
      "paths": {
        "/items": {
        "parameters": [
            {
              "$ref": "#/components/parameters/jwt_token"
            }
          ],
          "get": {
          "parameters": [
              {
                "$ref": "#/components/parameters/maxResults"
              },
              {
                "$ref": "#/components/parameters/page"
              },
              {
                "$ref": "#/components/parameters/sort"
              }
            ],
            "description": "Returns all items from the system that the user has access to",
            "x-routeTypes": [ "findAll" ],
            "x-schema": "Item",
            "responses": {
              "200": {
                "description": "A list of items.",
                "content": {
                  "application/json": {
                    "schema": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/Item"
                      }
                    }
                  }
                }
              }
            },
            "security": [
              {
                "jwt": []
            }
            ]
          },
          "post": {
            "description": "Create a new item",
            "x-routeTypes": [ "create" ],
            "x-schema": "Item",
            "requestBody": {
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/Item"
                  }
                }
              }
            },
            "responses": {
              "201": {
                "description": "The newly created item.",
                "content": {
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/Item"
                    }
                  }
                }
              }
            },
            "security": [
              {
                "jwt": []
            }
            ]
          }
        },
        "/items/count": {
        "parameters": [
            {
              "$ref": "#/components/parameters/jwt_token"
            }
          ],
          "get": {
            "description": "Returns the count of items",
            "x-routeTypes": [ "count" ],
            "x-schema": "Item",
            "responses": {
              "200": {
                "description": "The number of found items matching the search criteria.",
                "content": {
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/count"
                    }
                  }
                }
              }
            },
            "security": [
              {
                "jwt": []
            }
            ]
          }
        },
        "/items/{id}": {
          "parameters": [
            {
              "$ref": "#/components/parameters/id"
            },
        {
              "$ref": "#/components/parameters/jwt_token"
            }
          ],
          "get": {
            "description": "Returns a single item from the system that the user has access to",
            "x-routeTypes": [ "findById" ],
            "x-schema": "Item",
            "responses": {
              "200": {
                "description": "A item object.",
                "content": {
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/Item"
                    }
                  }
                }
              }
            },
            "security": [
              {
                "jwt": []
            }
            ]
          },
          "put": {
            "description": "Updates a single item",
            "x-routeTypes": [ "update" ],
            "x-schema": "Item",
            "requestBody": {
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/Item"
                  }
                }
              }
            },
            "responses": {
              "200": {
                "description": "The updated item object",
                "content": {
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/Item"
                    }
                  }
                }
              }
            },
            "security": [
              {
                "jwt": []
            }
            ]
          },
          "delete": {
            "description": "Deletes the item",
            "x-routeTypes": [ "delete" ],
            "x-schema": "Item",
            "responses": {
              "200": {
                "description": "No content"
              }
            },
            "security": [
              {
                "jwt": []
              }
            ]
          }
        }
      },
      "externalDocs": {
        "description": "Powered by RapidREST Core technology.",
        "url": "https://rapidrest.dev"
      }
    }
    `;

        await mkdirp("./test-openapi/");
        fs.writeFileSync("./test-openapi/openapi.bak", yaml);
        fs.writeFileSync("./test-openapi/openapi.json", json);
        fs.writeFileSync("./test-openapi/openapi.yaml", yaml);

        nock("https://localhost:3000")
            .get("/openapi.yaml")
            .reply(200, yaml);

        nock("https://localhost:3000")
            .get("/openapi.json")
            .reply(200, json);
    });

    afterAll(() => {
        rimraf.sync("./test-openapi");
    });
    it("loadSpec can load JSON.", async () => {
        let result = await OASUtils.loadSpec("./test-openapi/openapi.json");
        expect(result).toBeDefined();
        expect(result.openapi).toBe("3.0.1");
    });

    it("loadSpec can load YAML.", async () => {
        let result = await OASUtils.loadSpec("./test-openapi/openapi.yaml");
        expect(result).toBeDefined();
        expect(result.openapi).toBe("3.0.1");
    });

    it("loadSpec can load YAML from URL.", async () => {
        const result = await OASUtils.loadSpec("https://localhost:3000/openapi.yaml");
        expect(result).toBeDefined();
        expect(result.openapi).toBe("3.0.1");
    });
    it("loadSpec can load JSON from URL.", async () => {
        const result = await OASUtils.loadSpec("https://localhost:3000/openapi.json");
        expect(result).toBeDefined();
        expect(result.openapi).toBe("3.0.1");
    });

    it("loadSpec doesn't load invalid file type.", async () => {
        try {
            await OASUtils.loadSpec("./test-openapi/openapi.bak");
            throw new Error("Failed to throw error.");
        } catch (err) {
            expect(err).toBeDefined();
        }
    });

    it("loadSpec doesn't load non-existant file.", async () => {
        try {
            await OASUtils.loadSpec("./test-openapi/openapi.txt");
            throw new Error("Failed to throw error.");
        } catch (err) {
            expect(err).toBeDefined();
        }
    });

    describe("loadSpec URL response edge cases", () => {
        beforeEach(() => {
            OASUtils.clearSpecCache();
        });

        it("throws 'File not found' when the URL response has an empty body.", async () => {
            nock("https://localhost:3000").get("/openapi-empty.yaml").reply(200, "");
            await expect(OASUtils.loadSpec("https://localhost:3000/openapi-empty.yaml")).rejects.toThrow(
                "File not found",
            );
        });

        it("returns null (and does not cache) when the URL body parses as YAML null.", async () => {
            nock("https://localhost:3000").get("/openapi-null.yaml").reply(200, "null");
            const result = await OASUtils.loadSpec("https://localhost:3000/openapi-null.yaml");
            expect(result).toBeNull();
        });

        it("falls back to the raw string when the URL body is not valid YAML/JSON.", async () => {
            nock("https://localhost:3000").get("/openapi-invalid.yaml").reply(200, "{");
            const result = await OASUtils.loadSpec("https://localhost:3000/openapi-invalid.yaml");
            expect(result).toBe("{");
        });

        it("uses response.data directly when it is already an object.", async () => {
            axiosGetOverride = async () => ({ data: { openapi: "3.0.1", fromObject: true } });
            const result = await OASUtils.loadSpec("https://localhost:3000/openapi-object.yaml");
            expect(result).toBeDefined();
            expect(result.fromObject).toBe(true);
        });

        it("throws 'Cannot parse data' when response.data is neither a string nor an object.", async () => {
            axiosGetOverride = async () => ({ data: 12345 });
            await expect(OASUtils.loadSpec("https://localhost:3000/openapi-number.yaml")).rejects.toThrow(
                "Cannot parse data",
            );
        });
    });

    describe("loadSpec allowedDirs/allowedHosts restrictions", () => {
        beforeEach(() => {
            OASUtils.clearSpecCache();
        });

        it("succeeds when the file is within an allowed directory.", async () => {
            const result = await OASUtils.loadSpec("./test-openapi/openapi.json", {
                allowedDirs: ["./test-openapi"],
            });
            expect(result).toBeDefined();
            expect(result.openapi).toBe("3.0.1");
        });

        it("throws when the file exists but is outside all allowed directories.", async () => {
            await expect(
                OASUtils.loadSpec("./test-openapi/openapi.json", { allowedDirs: ["./some-other-directory"] }),
            ).rejects.toThrow("is not within an allowed directory");
        });

        it("succeeds when the URL hostname is in the allowed hosts list.", async () => {
            nock("https://localhost:3000").get("/openapi.yaml").reply(200, yaml);
            const result = await OASUtils.loadSpec("https://localhost:3000/openapi.yaml", {
                allowedHosts: ["localhost"],
            });
            expect(result).toBeDefined();
            expect(result.openapi).toBe("3.0.1");
        });

        it("throws when the URL hostname is not in the allowed hosts list.", async () => {
            await expect(
                OASUtils.loadSpec("https://localhost:3000/openapi.yaml", {
                    allowedHosts: ["other-host.example.com"],
                }),
            ).rejects.toThrow("is not an allowed host");
        });
    });

    describe("clearSpecCache", () => {
        it("clears the cache so a subsequent load re-parses the file.", async () => {
            const first = await OASUtils.loadSpec("./test-openapi/openapi.json");
            const second = await OASUtils.loadSpec("./test-openapi/openapi.json");
            // Cached: same parsed object instance is returned.
            expect(second).toBe(first);

            OASUtils.clearSpecCache();

            const third = await OASUtils.loadSpec("./test-openapi/openapi.json");
            expect(third).toEqual(first);
            // Re-parsed: a new object instance is returned after the cache was cleared.
            expect(third).not.toBe(first);
        });
    });

    describe("getResponse / getResponseContent", () => {
        it("returns the first 2XX response object when present.", async () => {
            const spec = await OASUtils.loadSpec("./test-openapi/openapi.json");
            const operation = spec.paths["/items"].get;
            const response = OASUtils.getResponse(operation);
            expect(response).toBeDefined();
            expect(response.content).toBeDefined();
        });

        it("returns null when there is no responses field.", () => {
            expect(OASUtils.getResponse({})).toBeNull();
        });

        it("returns null when no 2XX response is present.", () => {
            expect(OASUtils.getResponse({ responses: { "404": { description: "Not found" } } })).toBeNull();
        });

        it("returns null when the 2XX response object has no content type keys.", () => {
            expect(OASUtils.getResponse({ responses: { "200": {} } })).toBeNull();
        });

        it("returns the response content when a 2XX response is present.", async () => {
            const spec = await OASUtils.loadSpec("./test-openapi/openapi.json");
            const operation = spec.paths["/items"].get;
            const content = OASUtils.getResponseContent(operation);
            expect(content).toBeDefined();
        });

        it("returns undefined for content when there is no responses field.", () => {
            expect(OASUtils.getResponseContent({})).toBeUndefined();
        });
    });

    describe("getTypeInfo", () => {
        const convertDataType = (type: any, format?: any, ref?: any) => ref || format || type;

        it("returns null when schemaDef is falsy.", async () => {
            const spec = await OASUtils.loadSpec("./test-openapi/openapi.json");
            expect(OASUtils.getTypeInfo(undefined, spec, convertDataType)).toBeNull();
        });

        it("resolves a $ref to a real schema object.", async () => {
            const spec = await OASUtils.loadSpec("./test-openapi/openapi.json");
            const result = OASUtils.getTypeInfo({ $ref: "#/components/schemas/Item" }, spec, convertDataType);
            expect(result).toBeDefined();
            expect(result.subSchemaRef).toBe("#/components/schemas/Item");
            expect(result.type).toBe("Item");
        });

        it("returns null when a $ref does not resolve.", async () => {
            const spec = await OASUtils.loadSpec("./test-openapi/openapi.json");
            const result = OASUtils.getTypeInfo({ $ref: "#/components/schemas/DoesNotExist" }, spec, convertDataType);
            expect(result).toBeNull();
        });

        it("resolves an array whose items.$ref resolves.", async () => {
            const spec = await OASUtils.loadSpec("./test-openapi/openapi.json");
            const result = OASUtils.getTypeInfo(
                { type: "array", items: { $ref: "#/components/schemas/Item" } },
                spec,
                convertDataType,
            );
            expect(result.subSchemaRef).toBe("#/components/schemas/Item");
            expect(result.subType).toBe("Item");
            expect(result.type).toBe("Item");
        });

        it("leaves type null for an array whose items.$ref does not resolve.", async () => {
            const spec = await OASUtils.loadSpec("./test-openapi/openapi.json");
            const result = OASUtils.getTypeInfo(
                { type: "array", items: { $ref: "#/components/schemas/DoesNotExist" } },
                spec,
                convertDataType,
            );
            expect(result.type).toBeNull();
            expect(result.subSchemaRef).toBeNull();
        });

        it("resolves an array with plain (non-$ref) items.", async () => {
            const spec = await OASUtils.loadSpec("./test-openapi/openapi.json");
            const result = OASUtils.getTypeInfo({ type: "array", items: { type: "string" } }, spec, convertDataType);
            expect(result.subType).toBe("string");
            expect(result.type).toBe("string");
        });

        it("throws when an array is defined with no items.", async () => {
            const spec = await OASUtils.loadSpec("./test-openapi/openapi.json");
            expect(() => OASUtils.getTypeInfo({ type: "array" }, spec, convertDataType)).toThrow(
                "Array defined with no items",
            );
        });

        it("returns an enum type when type is undefined and enum is present.", async () => {
            const spec = await OASUtils.loadSpec("./test-openapi/openapi.json");
            const result = OASUtils.getTypeInfo({ enum: ["a", "b", "c"] }, spec, convertDataType);
            expect(result.type).toBe("enum");
            expect(result.values).toEqual(["a", "b", "c"]);
        });

        it("falls through to the default branch when type and enum are both absent.", async () => {
            const spec = await OASUtils.loadSpec("./test-openapi/openapi.json");
            const result = OASUtils.getTypeInfo({}, spec, convertDataType);
            expect(result.type).toBeUndefined();
            expect(result.subSchemaRef).toBeNull();
        });

        it("handles a plain scalar type.", async () => {
            const spec = await OASUtils.loadSpec("./test-openapi/openapi.json");
            const result = OASUtils.getTypeInfo({ type: "string", format: "uuid" }, spec, convertDataType);
            expect(result.format).toBe("uuid");
            expect(result.type).toBe("uuid");
            expect(result.subSchemaRef).toBeNull();
        });

        it("sets subSchemaRef to 'Object' for an inline object type.", async () => {
            const spec = await OASUtils.loadSpec("./test-openapi/openapi.json");
            const result = OASUtils.getTypeInfo({ type: "object" }, spec, convertDataType);
            expect(result.subSchemaRef).toBe("Object");
        });
    });

    it("getDatastore (JSON) succeeds.", async () => {
        let spec = await OASUtils.loadSpec("./test-openapi/openapi.json");
        expect(spec).toBeDefined();
        let obj = OASUtils.getDatastore(spec, "testdb");
        expect(obj).toBeDefined();
        expect(obj).toHaveProperty("type");
        expect(obj.type).toBe("mongodb");
        expect(obj).toHaveProperty("url");
        expect(obj.url).toBe("mongodb://localhost");
    });

    it("getDatastore (YAML) succeeds.", async () => {
        let spec = await OASUtils.loadSpec("./test-openapi/openapi.yaml");
        expect(spec).toBeDefined();
        let obj = OASUtils.getDatastore(spec, "testdb");
        expect(obj).toBeDefined();
        expect(obj).toHaveProperty("type");
        expect(obj.type).toBe("mongodb");
        expect(obj).toHaveProperty("url");
        expect(obj.url).toBe("mongodb://localhost");
    });

    it("getDatastore returns undefined when spec has no components.", async () => {
        expect(OASUtils.getDatastore({}, "testdb")).toBeUndefined();
    });

    it("getObject (JSON) succeeds.", async () => {
        let spec = await OASUtils.loadSpec("./test-openapi/openapi.json");
        expect(spec).toBeDefined();
        expect(OASUtils.getObject(spec, "/info/version")).toBe("1.0.0");
        expect(OASUtils.getObject(spec, "#components/schemas/Item")).toBeInstanceOf(Object);
    });

    it("getObject returns undefined when path is empty.", async () => {
        let spec = await OASUtils.loadSpec("./test-openapi/openapi.json");
        expect(OASUtils.getObject(spec, "")).toBeUndefined();
    });

    it("getObject (YAML) succeeds.", async () => {
        let spec = await OASUtils.loadSpec("./test-openapi/openapi.yaml");
        expect(spec).toBeDefined();
        expect(OASUtils.getObject(spec, "/info/version")).toBe("1.0.0");
        expect(OASUtils.getObject(spec, "#components/schemas/Item")).toBeInstanceOf(Object);
    });

    it("getSchema (JSON) succeeds.", async () => {
        let spec = await OASUtils.loadSpec("./test-openapi/openapi.json");
        expect(spec).toBeDefined();
        expect(OASUtils.getSchema(spec, "Item")).toBeDefined();
        expect(OASUtils.getSchema(spec, "RandoCardrissian")).toBeUndefined();
        try {
            OASUtils.getSchema({}, "Item");
            throw new Error("Failed to throw error.");
        } catch (err) {
            expect(err).toBeDefined();
        }
    });

    it("getSchema (JSON) succeeds (case-insensitive).", async () => {
      let spec = await OASUtils.loadSpec("./test-openapi/openapi.json");
      expect(spec).toBeDefined();
      expect(OASUtils.getSchema(spec, "authToken")).toBeDefined();
      expect(OASUtils.getSchema(spec, "AuthToken")).toBeDefined();
  });

    it("getSchema (YAML) succeeds.", async () => {
        let spec = await OASUtils.loadSpec("./test-openapi/openapi.yaml");
        expect(spec).toBeDefined();
        expect(OASUtils.getSchema(spec, "Item")).toBeDefined();
        expect(OASUtils.getSchema(spec, "RandoCardrissian")).toBeUndefined();
        try {
            OASUtils.getSchema({}, "Item");
            throw new Error("Failed to throw error.");
        } catch (err) {
            expect(err).toBeDefined();
        }
    });
});
