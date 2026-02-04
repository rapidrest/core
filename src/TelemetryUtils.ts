///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
import axios, { AxiosResponse } from "axios";
import { v4 as uuidV4 } from "uuid";
import { JWTUtils } from "./JWTUtils.js";

/**
 * Describes the required fields when creating a new telemetry event.
 *
 * @author Jean-Philippe Steinmetz <rapidrests@gmail.com>
 */
export interface NewEvent {
    /** The type of event begin recorded. */
    type: string;
}

/**
 * Describes a single telemetry event. A telemetry event is when something occurs in the system.
 *
 * @author Jean-Philippe Steinmetz <rapidrests@gmail.com>
 */
export class Event implements NewEvent {
    /**
     * The universally unique identifier of the event.
     */
    public readonly uid: string;

    /**
     * The name of the environment that the event originated from. This is typically `dev` or `prod`.
     */
    public readonly environment: string;

    /**
     * The unique name of the service or client that the event originated from.
     */
    public readonly origin: string;

    /**
     * The date and time that the event occured.
     */
    public readonly timestamp: Date = new Date();

    /**
     * The type of event being recorded.
     */
    public readonly type: string;

    /**
     * The universally unique identifer of the user that sent the event.
     */
    public readonly userId: string;

    constructor(config: any, userId: string, data: NewEvent) {
        this.uid = uuidV4();
        this.environment = process.env.NODE_ENV ? process.env.NODE_ENV : "prod";
        const serviceName: string = config.get("service_name");
        this.origin = serviceName ? `${serviceName}:${config.get("version")}` : "unknown";
        this.type = data.type;
        this.userId = userId;

        // Copy all fields in data to this object
        const tmp: any = data as any;
        for (let key in tmp) {
            if (key !== "environment" && key !== "origin" && key !== "userId") {
                (this as any)[key] = tmp[key];
            }
        }
    }
}

/**
 * Provides a common set of static functions for recording and working with telemetry `Event` instances.
 *
 * The `init` function must be called before any other function can be called.
 *
 * The `record` function is used to send an event to a configured `telemetry_services` service for permanent storage.
 *
 * The `on` function allows code within the same application or service to listen for outgoing events that have been
 * sent via the `record` function.
 *
 * @author Jean-Philippe Steinmetz <rapidrests@gmail.com>
 */
export class EventUtils {
    private static initialized: boolean = false;
    private static config: any;
    private static listeners: Map<string, Function[]> = new Map();
    private static logger: any;
    private static token: string;
    private static userId: string;

    /**
     * Initializes `EventUtils` with the provided defaults.
     *
     * @param config The application configuration to use.
     * @param logger The logging utility to use.
     * @param jwtToken The user's JWT token to send telemetry events on behalf of.
     */
    public static init(config: any, logger: any, jwtToken: string) {
        EventUtils.config = config;
        EventUtils.listeners = new Map();
        EventUtils.logger = logger;
        EventUtils.token = jwtToken;

        // Extract the user id from the token
        const payload: any = JWTUtils.decodeToken(config.get("auth"), jwtToken);
        EventUtils.userId = payload.profile.uid;

        EventUtils.initialized = true;
    }

    /**
     * Sends the given event to the telemetry service for permanent recording.
     *
     * @param evt The event to send and record.
     * @param type The type of event to record. Overrides any `type` value set in `evt`.
     */
    public static async record(evt: NewEvent | any, type?: string): Promise<void> {
        try {
            if (!EventUtils.initialized) {
                throw new Error("EventUtils has not been initialized. Did you call EventUtils.init()?");
            }

            if (type) {
                evt.type = type;
            }
            if (!evt.type || evt.type.length === 0) {
                throw new Error("Events must have a `type` specified.");
            }

            // Create the event instance that will be sent for storage
            const event: Event = evt instanceof Event ? evt : new Event(EventUtils.config, EventUtils.userId, evt);

            // Send to the telemetry service
            const baseUrl: string = EventUtils.config.get("telemetry_services:url");
            if (baseUrl) {
                const url: string = baseUrl + "/events";
                const response: AxiosResponse = await axios.post(url, event, {
                    headers: {
                        Authorization: "jwt " + EventUtils.token,
                    }
                });
            } else {
                EventUtils.logger?.debug(
                    "Failed to send telemetry event. telemetry_services:url has not been set in the config."
                );
            }


            // Notify any registered listeners
            const callbacks: Function[] | undefined = EventUtils.listeners.get(evt.type);
            if (callbacks) {
                for (let func of callbacks) {
                    func(event);
                }
            }
        } catch (err: any) {
            if (!EventUtils.logger) {
                console.warn(`Failed to send telemetry event. Error: ${err.message}`)
            } else {
                EventUtils.logger.warn(`Failed to send telemetry event. Error: ${err.message}`);
            }
        }
    }

    /**
     * Registers a `callback` function to receive notifications of recorded events of the given `type`. Note that only
     * events originating from the same application or service will be notified.
     *
     * @param type The type of event to be notified of.
     * @param callback The function to call when an event is recorded.
     */
    public static on(type: string, callback: Function): void {
        if (!EventUtils.initialized) {
            throw new Error("EventUtils has not been initialized. Did you call EventUtils.init()?");
        }

        if (!EventUtils.listeners.has(type)) {
            EventUtils.listeners.set(type, []);
        }

        const callbacks: Function[] | undefined = EventUtils.listeners.get(type);
        if (callbacks) {
            callbacks.push(callback);
            EventUtils.listeners.set(type, callbacks);
        }
    }
}
