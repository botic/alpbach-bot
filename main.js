const fs = require("fs");
const strings = require("ringo/utils/strings");
const {TelegramBot} = require("ringo-telegram");

const logging = require("ringo/logging");
logging.setConfig(getResource(module.resolve("./config/log4j.properties")));
const log = logging.getLogger(module.id);

const config = require("gestalt").load(module.resolve("./config/config.json"));

// the HTTP server itself
const httpServer = require("httpserver");
var server = null;

const stop = exports.stop = function() {
    if (server !== null) {
        server.stop();
    }
};

const start = exports.start = function() {
    log.info("Starting application birdie");
    // configure the server
    server = httpServer.build()
        // serve applications
        .serveApplication("/", module.resolve("./app/routes"), {
            "virtualHosts": config.get("vhosts")
        })
        .http({
            "host": config.get("server:http:host"),
            "port": config.get("server:http:port")
        });

    if (config.get("server:https:port")) {
        server.https({
            "host": config.get("server:https:host"),
            "port": config.get("server:https:port"),
            "keyStore": config.get("server:https:keyStore"),
            "keyStorePassword": config.get("server:https:keyStorePassword"),
            "keyManagerPassword": config.get("server:https:keyManagerPassword"),
            "includeCipherSuites": config.get("server:https:includeCipherSuites")
        })
    }

    server.start();

    // now register the webhook for telegram
    const hookUrl = "https://" + config.get("telegram:webhookHostname") + config.get("telegram:callbackPath");
    const bot = new TelegramBot(config.get("telegram:token"));
    bot.setWebhook(hookUrl);
    log.info("[telegram] Registered webhook", hookUrl);
};

if (require.main === module) {
    // add all jar files in jars directory to classpath
    getRepository(module.resolve("./jars/")).getResources().filter(function(r) {
        return strings.endsWith(r.name, ".jar");
    }).forEach(function(file) {
        addToClasspath(file);
    });

    start();
}
