///////////////////////////////////////////////////////////////////////////////
// Copyright (C) 2020-2026 Jean-Philippe Steinmetz
///////////////////////////////////////////////////////////////////////////////
const conf = require("nconf")
    .argv()
    .env({
        separator: "__",
        parseValues: true,
    });

conf.defaults({
    jobs: {
        defaultSchedule: "*/2 * * * * *",
        MyFirstService: {
            schedule: "* * * * * *",
        },
        MySecondService: {
            schedule: "* * * * * *",
        },
        MyThirdService: {},
    },
    auth: {
        secret: "MyPasswordIsSecure",
        options: {
            audience: "rapidrest.dev",
            issuer: "rapidrest.dev",
        },
    },
    telemetry_services: {
        url: "http://telemetry_services",
    },
    spec: "test/openapi.yaml",
});

export default conf;
