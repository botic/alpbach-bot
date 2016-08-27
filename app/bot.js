const log = require("ringo/logging").getLogger(module.id);
const config = require("gestalt").load(module.resolve("../config/config.json"));

const SyndFeed = Packages.com.rometools.rome.feed.synd.SyndFeed;
const {SyndFeedInput, SyndFeedOutput, XmlReader} = Packages.com.rometools.rome.io;

const fs = require("fs");
const dates = require("ringo/utils/dates");
const strings = require("ringo/utils/strings");

const {TelegramBot} = require("ringo-telegram");
const bot = new TelegramBot(config.get("telegram:token"));

const wordMatcher = function(text, keywords) {
    return keywords.some(function(word) {
        return strings.contains(text, word);
    });
};

const onmessage = function(event) {
    const update = event.data;

    try {
        if (update.message != null) {
            processMessage(update.message);
        }
    } catch (e) {
        log.error("Could not process update: ", e);
    }
};

const processMessage = function(message) {
    if (typeof message.text != "string") {
        bot.sendMessage(message.chat.id, "Sorry, I only support text messages \uD83D\uDE41");
        return;
    }

    const text = message.text || "";
    const textLower = text.toLocaleLowerCase();

    if (wordMatcher(textLower, ["program", "timetable", "schedule", "events"])) {
        let event = "";
        if (wordMatcher(textLower, ["political", "politi", " pol", "pol "])) {
            event = "POL";
        } else if (wordMatcher(textLower, ["finan", " fin", "fin "])) {
            event = "FIN";
        } else if (wordMatcher(textLower, ["baukul", "built", "environm", " blt", "blt "])) {
            event = "BLT";
        } else if (wordMatcher(textLower, ["econ", "wirtsch", " ecn", "ecn "])) {
            event = "ECN";
        } else if (wordMatcher(textLower, ["rechts", " law", "law "])) {
            event = "LAW";
        } else if (wordMatcher(textLower, ["kultu", "cultu", " cul", "cul "])) {
            event = "CUL";
        }

        let time = "";
        let timeLookup = textLower.match(/\ \d?\d[:\.]\d\d/);
        if (timeLookup && timeLookup.length == 1) {
            time = timeLookup[0].replace(".", ":").trim();
        }

        getTimetable(message, event, time);
    } else if (wordMatcher(textLower, ["nachrichten", "news", "alpbuzz"])) {
        getNews(message);
    } else {
        bot.sendMessage(message.chat.id, "Hey! I'm the \uD83E\uDD16 efa16bot on Telegram. You can ask me things like today's program " +
            "by texting 'program' or (with time) 'program 16:00'. Get the latest news from AlpBuzz with 'news'.");
    }
};

const getNews = exports.getNews = function(message) {
    let input = new SyndFeedInput();
    let entries = (input.build(new XmlReader(new java.net.URL(config.get("feed"))))).getEntries();

    let entry = entries.get(0);
    bot.sendMessage(message.chat.id, entry.getTitle() + "\n" +
            "<a href='" + entry.getLink() + "'>" + entry.getLink() + "</a>", {
        parse_mode: "html"
    });

    entry = entries.get(1);
    bot.sendMessage(message.chat.id, entry.getTitle() + "\n" +
        "<a href='" + entry.getLink() + "'>" + entry.getLink() + "</a>", {
        parse_mode: "html"
    });

    entry = entries.get(2);
    bot.sendMessage(message.chat.id, entry.getTitle() + "\n" +
        "<a href='" + entry.getLink() + "'>" + entry.getLink() + "</a>", {
        parse_mode: "html"
    });
};

const getTimetable = exports.getTimetable = function(message, event, time) {
    let data;

    try {
        data = JSON.parse(fs.read(module.resolve("../data/program.json")));

        let nowDateStr = dates.format(new Date(), "dd/MM/yyyy", "en", "GMT+2");
        let nowTimeStr = dates.format(new Date(), "HH:mm", "en", "GMT+2");

        if (time !== "") {
            nowTimeStr = time;
        }

        let startTime = dates.parse(nowDateStr + " " + nowTimeStr, "dd/MM/yyyy HH:mm", "en", "GMT+2");
        let endTime = dates.add(startTime, 75, "minute");

        // little trick to include exact start times
        let displayTime = startTime;
        startTime = dates.add(startTime, -1, "minute");

        let count = 0;
        data.filter(function(entry) {
            let entryTime = dates.parse(entry.date + " " + entry.start, "dd/MM/yyyy HH:mm", "en", "GMT+2");

            // check if in timeslot
            if (dates.before(startTime, entryTime) && dates.after(endTime, entryTime)) {
                // check if event matches
                if (event !== "") {
                    return entry.event === event;
                } else {
                    return true;
                }
            }

            return false;
        }).map(function(entry) {
            return entry.start + " - " + entry.event + " " + entry.type + " - " +
                "<a href='" + entry.url + "'>" + entry.name + "</a>";
        }).forEach(function (text) {
            bot.sendMessage(message.chat.id, text, {
                parse_mode: "html",
                disable_web_page_preview: true
            });
            count++;
        });

        if (count === 0) {
            bot.sendMessage(message.chat.id, "Sorry, I found no events around " +
                dates.format(displayTime, "dd MMMM yyyy 'at' HH:mm", "en", "GMT+2") + " \uD83D\uDE22");
        }
    } catch (e) {
        log.error(e);
        bot.sendMessage(message.chat.id, "Sorry, my database is broken \uD83D\uDCA5");
    }
};
