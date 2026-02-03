///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import fs from "fs";
import { OASUtils } from "../src/OASUtils.js";
import nock from "nock";
import * as rimraf from "rimraf";
import { mkdirp } from "mkdirp";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("OASUtils Tests", () => {
    beforeAll(async () => {
        const yaml: string = `
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
        const json: string = `
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

    it("getObject (JSON) succeeds.", async () => {
        let spec = await OASUtils.loadSpec("./test-openapi/openapi.json");
        expect(spec).toBeDefined();
        expect(OASUtils.getObject(spec, "/info/version")).toBe("1.0.0");
        expect(OASUtils.getObject(spec, "#components/schemas/Item")).toBeInstanceOf(Object);
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
