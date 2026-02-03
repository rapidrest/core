///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import fs from "fs";
import { Logger } from "./Logger.js";
import path from "path";
import { Axios } from "axios";
import YAML from "js-yaml";

const logger = Logger();

export class OASUtils {
    /**
     * Gets the datastore definition with the specified name.
     *
     * @param spec The OpenAPI specification to search.
     * @param name The name of the datastore to retrieve.
     * @returns The definition for the datastore with the given name if found, otherwise `undefined`.
     */
    public static getDatastore(spec: any, name: string): any {
        let result: any = undefined;

        if (spec.components && spec.components["x-datastores"]) {
            result = spec.components["x-datastores"][name];
        }

        return result;
    }

    /**
     * Gets the specification object at the specified path.
     *
     * @param {any} spec The OpenAPI specification to reference.
     * @param {string} path The path of the object to retrieve.
     * @returns {any} The object at the specified path if found, otherwise `undefined`.
     */
    public static getObject(spec: any, path: string): any {
        let result: any = spec;

        if (path) {
            if (path[0] === "#") {
                path = path.substring(1, path.length);
            }
            if (path[0] === "/") {
                path = path.substring(1, path.length);
            }

            let parts: string[] = path.split("/");
            parts.forEach(part => {
                result = result[part];
            });
        } else {
            result = undefined;
        }

        return result;
    }

    /**
     * Returns the first available response object for a 2XX response as defined by the provided Operation schema object.
     *
     * @param {any} obj The Operation schema object to search.
     */
    public static getResponse(obj: any): any {
        if (obj.responses) {
            for (let status in obj.responses) {
                if (status[0] === "2") {
                    for (let type in obj.responses[status]) {
                        return obj.responses[status];
                    }
                }
            }
        }

        return null;
    }

    /**
     * Returns the first available response content object for a 2XX response as defined by the provided Operation schema object.
     *
     * @param {any} obj The Operation schema object to search.
     */
    public static getResponseContent(obj: any): any {
        let result = this.getResponse(obj);
        return result ? result.content : undefined;
    }

    /**
     * Retrieves the schema definition with the given name.
     *
     * @param {any} spec The OpenAPI specification object to reference.
     * @param {string} name The name of the schema to retrieve.
     * @returns {any} The schema definition with the given name.
     */
    public static getSchema(spec: any, name: string): any {
        if (!spec.components || !spec.components.schemas) {
            throw new Error("Invalid specification. No schemas found.");
        }

        // Perform a case-insensitive search for the schema
        for (const schemaName in spec.components.schemas) {
            if (schemaName.match(new RegExp(name, 'i'))) {
                return spec.components.schemas[schemaName];
            }
        }

        return undefined;
    }

    /**
     * Extracts the type information for a given schema Object definition.
     *
     * @param {any} schemaDef The schema definition object to extract type information from.
     * @param {any} spec The entire OpenAPI specification object.
     * @param {Function} convertDataType The function that converts OpenAPI Specification types to native types.
     * @returns {any} A tuple containing the type, subType and subSchemaRef information.
     */
    public static getTypeInfo(schemaDef: any, spec: any, convertDataType: Function): any {
        if (schemaDef) {
            let result: any = { type: null, subSchemaRef: null, subType: null };
            if (schemaDef["$ref"]) {
                let realDef: any = OASUtils.getObject(spec, schemaDef["$ref"]);
                if (realDef) {
                    result.subSchemaRef = schemaDef["$ref"];
                    result.type = convertDataType("object", null, path.basename(result.subSchemaRef));
                } else {
                    return null;
                }
            } else if (schemaDef["type"] === "array") {
                if (schemaDef["items"]) {
                    if (schemaDef.items["$ref"]) {
                        let realDef: any = OASUtils.getObject(spec, schemaDef.items["$ref"]);
                        if (realDef) {
                            result.subSchemaRef = schemaDef.items["$ref"];
                            result.subType = convertDataType(
                                realDef.type,
                                realDef.format,
                                path.basename(result.subSchemaRef)
                            );
                            result.type = convertDataType("array", result.subType);
                        }
                    } else {
                        result.format = schemaDef.items.format;
                        result.subType = convertDataType(schemaDef.items.type, schemaDef.items.format);
                        result.type = convertDataType("array", result.subType);
                    }
                } else {
                    throw new Error("Array defined with no items");
                }
            } else if (schemaDef["type"] === undefined && schemaDef["enum"]) {
                result.type = "enum";
                result.values = schemaDef["enum"];
            } else {
                result.format = schemaDef.format;
                result.type = convertDataType(schemaDef.type, schemaDef.format);
                if (schemaDef.type === "object") {
                    result.subSchemaRef = "Object";
                }
            }

            return result;
        } else {
            return null;
        }
    }

    /**
     * Attempts to load the Open API specification at the given path or URL.
     *
     * @param {string} file The path or URL of the OpenAPI Specification file to load.
     * @returns {Promise<any>} A promise whose result will be the loaded OpenAPI Specification as an object.
     */
    public static async loadSpec(file: string): Promise<any> {
        let apiSpec: any = null;

        if (fs.existsSync(file)) {
            let fileType = path.extname(file);
            let data: string = fs.readFileSync(file, "utf8");

            if (fileType === ".yaml") {
                logger.info("Loading YAML: " + file);
                apiSpec = YAML.load(data);
            } else if (fileType === ".json") {
                logger.info("Loading JSON: " + file);
                apiSpec = JSON.parse(data);
            } else {
                throw new Error("Unsupported file type: " + fileType);
            }
        } else if (file.match(new RegExp(/http[s]?:\/\/[a-zA-Z0-9]*\.?[a-z]*.*/))) {
            const axios: Axios = new Axios({ baseURL: file });
            const response: any = await axios.get(file);
            if (response && response.data) {
                if(typeof response.data === "string"){
                    // Assume the file is a YAML first. If not we'll try JSON
                    try {
                        apiSpec = YAML.load(response.data);
                    } catch (err) {
                        apiSpec = response.data;
                    }
                } else if(typeof response.data === "object") {
                    apiSpec = response.data;
                } else {
                    throw new Error("Cannot parse data : " + response.data);
                }
            } else {
                throw new Error("File not found: " + file);
            }
        } else {
            throw new Error("File not found: " + file);
        }

        return apiSpec;
    }
}
