// Dependencies

const http = require("http");
const https = require("https");
const url = require("url");
const StringDecoder = require("string_decoder").StringDecoder;
const config = require("./config");
const fs = require("fs");
const _data = require("./data");
const handlers = require("./handlers");
const helpers = require("./helpers");
const path = require("path")

// Instantiate server module object

var server = {}

// Instantiating http server

server.httpServer = http.createServer(function (req, res) {
    server.unifiedServer(req, res);
});

// Instantiate https server

server.httpsServerOptions = {
    key: fs.readFileSync(path.join(__dirname,'/../https/key.pem')),
    cert: fs.readFileSync(path.join(__dirname,'/../https/cert.pem'))
};

server.httpsServer = https.createServer(server.httpsServerOptions, function (req, res) {
    unifiedServer(req, res);
});


// All the server logic for both http and https server.

server.unifiedServer = function (req, res) {
    const parsedUrl = url.parse(req.url, true);

    // get the path from url

    const path = parsedUrl.pathname;
    const trimmedPath = path.replace(/^\/+|\/+$/g, "");

    const method = req.method.toLowerCase();

    // get the query string as an object.

    // console.log(parsedUrl)

    const queryStringObject = parsedUrl.query;

    // get the headers as an object

    const headers = req.headers;

    // get the payload (if any)

    const decoder = new StringDecoder("utf-8");
    let buffer = "";

    req.on("data", data => {
        buffer += decoder.write(data);
    });

    req.on("end", () => {
        buffer += decoder.end();

        // console.log(trimmedPath);

        // choose the handler this request should go to.
        // console.log(router[trimmedPath]);
        var chosenHandler =
            typeof server.router[trimmedPath] !== "undefined"
                ? server.router[trimmedPath]
                : handlers.notFound;

        // console.log(buffer);

        const data = {
            trimmedPath: trimmedPath,
            queryStringObject: queryStringObject,
            method: method,
            headers: headers,
            payload: helpers.parseJsonToObject(buffer)
        };

        chosenHandler(data, function (statusCode, payload) {
            // use the status code called back by handler or default.

            statusCode = typeof statusCode == "number" ? statusCode : 200;

            // use the payload called back by the handler or default to an empty object.
            console.log(payload);
            payload = typeof payload == "object" ? payload : {};

            const payloadString = JSON.stringify(payload);
            res.setHeader("Content-Type", "application/json");
            res.writeHead(statusCode);
            res.end(payloadString);

            console.log("returning this response : ", statusCode, payloadString);
        });
    });
};

// Define Router

server.router = {
    ping: handlers.ping,
    users: handlers.users,
    tokens: handlers.tokens,
    checks: handlers.checks
};

// Init the server

server.init = function () {
    // Start the HTTP server
    server.httpServer.listen(config.httpPort, function () {
        console.log(`server is listening on ${config.httpPort}`);
    });

    // Start the HTTPS server
    server.httpsServer.listen(config.httpsPort, function () {
        console.log(`server is listening on ${config.httpsPort}`);
    });

}

// Export the module.
module.exports = server
