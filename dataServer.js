var local = require("./template");
var http = require('http');
var url = require('url');
var path = require('path');
var Sequelize = require('sequelize');

var dataFile = "battle.db";
var unitConfigFile = "./unitConfig.json";
var Sqlite3 = require('sqlite3').verbose();
var db = new Sqlite3.Database(dataFile);  //connect to our file/database
var sequelize = new Sequelize('sqlite:/project/JS/WarDatacenter/' + dataFile);


var WebSocket = require("ws");
var fs = require("fs");
var wss = new WebSocket.Server({port: 3000});
var helloMsg = "hello";

var UnitTemplate = sequelize.import("./models/unit_template");    
var Unit = sequelize.import("./models/unit");


//var models = require("./models");
sequelize.authenticate()
    .then(function() {
        console.log('Connection has been established successfully.');
    })
    .catch(function(err) {
       console.error('Unable to connect to the database:', err);
    });

fs.open(unitConfigFile, "r", function(error, fd) {
    if (error) {
        console.log("no unit config file!!!");
    } else {
        UnitTemplate.sync({force : true})
            .then(function() {
                var unitTemplates = JSON.parse(fs.readFileSync(unitConfigFile, "utf-8"));
                for (var iter in unitTemplates.troops) {
                    var unit = {};
                    for (var num in unitTemplates.troops[iter]) {
                        var record = unitTemplates.troops[iter][num];
                        if (num == unitTemplates.template.speciality) {
                            record = "";
                            for (var time in unitTemplates.troops[iter][num]) {
                                record += unitTemplates.troops[iter][num][time] + ";";
                            }
                        }
                        unit[num] = record;
                    }
                    UnitTemplate.create(unit)
                    .then(function (result) {
                        console.log("data reload ready...");
                    })
                    .catch(function (err) {
                        console.log(err);
                    })
                }
            })
    }
})
Unit.sync({force : true});

wss.on("connection", function connection(ws, req) {
    console.log("connect open");
    ws.send(new local.WebMsgMaker(local.WebMsgMaker.TYPE_CLASS.STRING, helloMsg).toJSON());

    //Unit.sync();
    var factionFile = './factionTroops.json';


    ws.on("message", function(msg) {
        var parseMsg = new local.WebMsgParser(msg);
        if (parseMsg.type === local.WebMsgParser.TYPE_CLASS.STRING) {
            var attackTroops, defenceTroops, tmp;
            switch(parseMsg.value) {
                case local.messageCode.LOAD_UNIT_TEMPLATE : {
                    console.log(parseMsg.value);
                    UnitTemplate.findAll()
                        .then(function(rawData) {
                            var jsonData = [];
                            rawData.forEach(function(unit) {
                                jsonData.push(unit.get({plain : true}));
                            })
                            ws.send(new local.WebMsgMaker(local.WebMsgMaker.TYPE_CLASS.DATA_RECORD, jsonData).toJSON());
                        })
                    break;
                }
                case local.armyTemplate.faction.attackFaction : {
                    checkFaction(parseMsg.value, 10);
                    break;
                }
                case local.armyTemplate.faction.defenceFaction : {
                    checkFaction(parseMsg.value, 10);
                    break;
                }
                case local.messageCode.LOAD_TROOPS : {
                    var attackFaction = {
                        faction : local.armyTemplate.faction.attackFaction,
                        troops : []
                    },
                        defenceFaction = {
                        faction : local.armyTemplate.faction.defenceFaction,
                        troops : []
                    }
                    Unit.findAll({where : {faction : attackFaction.faction}})
                    .then(function(troops) {
                        console.log(troops);
                        troops.forEach(function(unit) {
                            attackFaction.troops.push(unit.get({plain : true}));
                        })
                        ws.send(new local.WebMsgMaker(local.WebMsgMaker.TYPE_CLASS.DATA_RECORD, attackFaction).toJSON());
                    })
                    Unit.findAll({where : {faction : defenceFaction.faction}})
                    .then(function(troops) {
                        troops.forEach(function(unit) {
                            defenceFaction.troops.push(unit.get({plain : true}));
                        })
                        ws.send(new local.WebMsgMaker(local.WebMsgMaker.TYPE_CLASS.DATA_RECORD, defenceFaction).toJSON());
                    })
                    break;
                }
                case local.messageCode.DELETE_TROOPS : {
                    console.log(local.messageCode.DELETE_TROOPS);
                    //Unit.sync({force : true});
                    break;
                }
                default : {
                    console.log(parseMsg.value)
                    break;
                }
            }
        }
        else if (parseMsg.type === local.WebMsgParser.TYPE_CLASS.DATA_RECORD) {
            parseMsg.value.forEach(function(jsonUnit) {
                Unit.create(jsonUnit)
                    .then(function(result) {
                    })
            })
            checkFaction(parseMsg.value[0]["faction"], parseMsg.value.length);
        }
    })

    ws.on("close", function(data) {
        Unit.sync({force : true});
        console.log("connection is cancelled by client!!!");
    });

    var checkFaction = function(faction, troopCount) {
        var otherFaction;
        faction === local.armyTemplate.faction.attackFaction ? otherFaction = local.armyTemplate.faction.defenceFaction : 
            otherFaction = local.armyTemplate.faction.attackFaction;
        Unit.count({where : {faction : faction}})
        .then(function(result) {
            if (result === troopCount) {
                console.log(faction + " ready...");
                Unit.count({where : {faction : otherFaction}})
                .then(function(result) {
                    if (result === troopCount) {
                        console.log(faction + " ready...");
                        ws.send(new local.WebMsgMaker(local.WebMsgMaker.TYPE_CLASS.STRING, local.messageCode.WAR_BEGIN).toJSON());
                    } else {
                        console.log(otherFaction + " waiting...");
                        ws.send(new local.WebMsgMaker(local.WebMsgMaker.TYPE_CLASS.STRING, local.messageCode.TROOP_CONFIG_READY).toJSON());
                    }
                })
            } else {
                Unit.count({where : {faction : otherFaction}})
                .then(function(result) {
                    if (result === troopCount) {
                        console.log(faction + " ready...");
                        ws.send(new local.WebMsgMaker(local.WebMsgMaker.TYPE_CLASS.STRING, local.messageCode.TROOP_CONFIG_READY).toJSON());
                    } else {
                        console.log(otherFaction + " waiting...");
                        ws.send(new local.WebMsgMaker(local.WebMsgMaker.TYPE_CLASS.STRING, faction).toJSON());
                    }
                })
            }
        })
    }
});




