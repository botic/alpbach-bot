const log = require("ringo/logging").getLogger(module.id);
const system = require("system");
const response = require("ringo/jsgi/response");
const strings = require("ringo/utils/strings");
const {Worker} = require('ringo/worker');

const {Application} = require("stick");
const app = exports.app = new Application();

app.configure("params", "route");

const config = require("gestalt").load(module.resolve("../config/config.json"));

const telegramUpdateIds = module.singleton("telegramUpdateIds", function() {
    return java.util.Collections.synchronizedCollection(new Packages.org.apache.commons.collections4.queue.CircularFifoQueue(25));
});

const bot = new Worker(module.resolve("./bot.js"));
bot.onerror = function(event) {
    log.error("Bot worker error: ", event.data);
};

app.get("/ping", function(req) {
    return response.html("<h1>Working!</h1><p>" + Date.now() + "</p>");
});

app.post(config.get("telegram:callbackPath"), function(req) {
    const update = req.postParams;
    if (update !== null && Number.isInteger(update.update_id)) {
        // prevent duplicated messages
        if (telegramUpdateIds.contains(new java.lang.Integer(update.update_id))) {
            log.warn("Already processed update id", update.update_id);
            return;
        } else {
            telegramUpdateIds.add(new java.lang.Integer(update.update_id));
        }

        log.info("Processing telegram update #" + update.update_id);
        bot.postMessage(update);

    } else {
        log.error("Invalid request", req.toSource());
    }
    return response.json({
        "timestamp": Date.now()
    }).ok();
});
