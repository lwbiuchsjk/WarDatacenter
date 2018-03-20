//import {local.armyTemplate, local.messageCode, Unit} from "template.js";

        　　　　　　　　　　

var local = require("./template");
var http = require('http');
var url = require('url');
var Sequelize = require('sequelize');

var dataFile = "battle.db";
var unitConfigFile = "./unitConfig.json";
var Sqlite3 = require('sqlite3').verbose();
var db = new Sqlite3.Database(dataFile);  //connect to our file/database
var sequelize = new Sequelize('sqlite:/project/JS/WarDatacenter/' + dataFile);


var WebSocket = require("ws");
var fs = require("fs");
var wss = new WebSocket.Server({port: 3000});
var msg = "hello";

var Unit = sequelize.import("./models/unit");    
//var models = require("./models");
//var Unit = sequelize.import()
fs.open(unitConfigFile, "r", function(error, fd) {
    if (error) {
        console.log("no unit config file!!!");
    } else {
        Unit.sync({force : true})
            .then(function() {
                var unitTemplates = JSON.parse(fs.readFileSync(unitConfigFile, "utf-8"));
                for (var iter in unitTemplates.troops) {
                    var unit = {};
                    for (var num in unitTemplates.troops[iter]) {
                        if (num != unitTemplates.template.speciality) {
                            unit[num] = unitTemplates.troops[iter][num]
                        }
                    }
                    console.log(unit);
                    Unit.create(unit)
                    .then(function (result) {
                        console.log(result.dataValues);
                    })
                    .catch(function (err) {
                        console.log(err);
                    })
                }
                console.log("data reload ready...");
            })
    }
})

wss.on("connection", function connection(ws, req) {
    console.log("connect open");
    ws.send(msg);

    var factionFile = local.messageCode.FACTION_FILE;
    fs.open(factionFile, "wx", function(error) {
        if (error) {
            console.log(factionFile + " exsit...");
        } else {
            fs.writeFileSync(factionFile, JSON.stringify(local.messageCode.FACTION_FILE_TEMPLATE));
            console.log(factionFile + " create successfully...");
        }
    })

    sequelize.authenticate()
    .then(function() {
        console.log('Connection has been established successfully.');
    })
    .catch(function(err) {
       console.error('Unable to connect to the database:', err);
    });

    ws.on("message", function(msg) {
        if (typeof msg == "string") {
            var attackTroops, defenceTroops, tmp;
            switch(msg) {
                case local.messageCode.LOAD_UNIT_TEMPLATE : {
                    console.log(msg);
                    Unit.findAll()
                        .then(function(rawData) {
                            var jsonData = [];
                            rawData.forEach(function(unit) {
                                jsonData.push(unit.get({plain : true}));
                            })
                            ws.send(JSON.stringify(jsonData));
                        })
                    break;
                }
                case local.armyTemplate.faction.attackFaction : {
                    fs.readFile(factionFile, "utf-8", function(error, data) {
                        if (error) {
                            console.log(error);
                        } else {
                            console.log(data);
                            tmp = JSON.parse(data);
                            attackTroops = tmp[local.armyTemplate.faction.attackFaction];
                            defenceTroops = tmp[local.armyTemplate.faction.defenceFaction];
                            if (attackTroops == null) {
                                console.log(msg + " 等待写入...");
                                if (defenceTroops != null) {
                                    console.log(local.armyTemplate.faction.defenceFaction + " 已经存在...准备进入战斗...");
                                    ws.send(local.messageCode.TROOP_CONFIG_READY);
                                } else {
                                    ws.send(msg);
                                }
                            } else if (defenceTroops != null) {
                                ws.send(local.messageCode.WAR_BEGIN);
                            }
                        }
                    })
                    break;
                }
                case local.armyTemplate.faction.defenceFaction : {
                    fs.readFile(factionFile, "utf-8", function(error, data) {
                        if (error) {
                            console.log(error);
                        } else {
                            tmp = JSON.parse(data);
                            attackTroops = tmp[local.armyTemplate.faction.attackFaction];
                            defenceTroops = tmp[local.armyTemplate.faction.defenceFaction];
                            if (defenceTroops == null) {
                                console.log(msg + " 等待写入...");
                                if (attackTroops != null) {
                                    console.log(local.armyTemplate.faction.attackFaction + " 已经存在...准备进入战斗...");
                                    ws.send(local.messageCode.TROOP_CONFIG_READY);
                                } else {
                                    ws.send(msg);
                                }
                            } else if (attackTroops != null) {
                                ws.send(local.messageCode.WAR_BEGIN);
                            }
                        }
                    })
                    break;
                }
                case local.messageCode.LOAD_TROOPS : {
                    fs.readFile(factionFile, 'utf8', function(error, data) {
                        if (error) {
                            console.log(error);
                        } else {
                            console.log("send troops...");
                            ws.send(data);
                        }
                    })
                    break;
                }
                case local.messageCode.DELETE_TROOPS : {
                    console.log(local.messageCode.DELETE_TROOPS);
                    fs.writeFile(factionFile, JSON.stringify(local.messageCode.FACTION_FILE_TEMPLATE), function(error) {
                        if (error) {
                            console.log(error);
                        } else {
                            ws.close();
                        }
                    });
                    break;
                }
                default : {
                    var jsonData;
                    try {
                        jsonData = JSON.parse(msg);
                    } catch (error) {
                        console.log(error)
                        return;
                    }
                    if (jsonData != null) {
                        fs.open(factionFile, "r", function(error, fd) {
                            if (error) {
                                console.log(error);
                            } else {
                                fs.readFile(factionFile, "utf-8", function(error, data) {
                                    if (error) {
                                        console.log(error);
                                    } else {
                                        var jsonTmp = JSON.parse(data);
                                        jsonTmp[jsonData.faction] = jsonData.troops;
                                        fs.writeFileSync(factionFile, JSON.stringify(jsonTmp));
                                        console.log(jsonData.faction + " 写入成功...");
                                        fs.readFile(factionFile, "utf-8", function(error, data) {
                                            if(error) {
                                                console.log(error);
                                            } else {
                                                var tmp = JSON.parse(data);
                                                if (tmp[local.armyTemplate.faction.attackFaction] == null || tmp[local.armyTemplate.faction.defenceFaction] == null) {
                                                    console.log(local.messageCode.TROOP_CONFIG_READY)
                                                    ws.send(local.messageCode.TROOP_CONFIG_READY);
                                                } else {
                                                    console.log(local.messageCode.WAR_BEGIN);
                                                    ws.send(local.messageCode.WAR_BEGIN);
                                                }
                                            }
                                        })
                                    }
                                })
                            }
                        })
                    } else {
                        console.log(msg);
                    }
                    break;
                }
            }
        }
        else if (typeof data == "object") {
            console.log("obeject!!");
            console.log(data);
        }
    })

    ws.on("close", function(data) {
        console.log("connection is cancelled by client!!!");
    });
});




