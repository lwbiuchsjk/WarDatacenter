var local = require("./models/template");
var http = require('http');
var url = require('url');
var path = require('path');
var Sequelize = require('sequelize');

var dataFile = "./battle.db";
var unitConfigFile = "./unitConfig.json";
var Sqlite3 = require('sqlite3').verbose();
var db = new Sqlite3.Database(dataFile);  //connect to our file/database
var sequelize = new Sequelize('sqlite:' + dataFile);


var WebSocket = require("ws");
var fs = require("fs");
var wss = new WebSocket.Server({port: 3000});
var helloMsg = "hello";

var UnitTemplate = sequelize.import("./models/unit_template");    
var Unit = sequelize.import("./models/unit");
var Battle = sequelize.import("./models/battleTable");
var Player = sequelize.import("./models/playerTable");


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
Battle.sync({force : true});
Player.sync({force : true});

wss.on("connection", function connection(ws, req) {
    console.log("connect open");
    ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.MSG, helloMsg).toJSON());

    ws.on("message", function(msg) {
        var parsedMsg = new local.WebMsg(msg);
        switch (parsedMsg.type) {
            case local.WebMsg.TYPE_CLASS.CODE_DATA : {
                var attackTroops, defenceTroops, tmp;
                switch(parsedMsg.value) {
                    case local.messageCode.LOAD_UNIT_TEMPLATE : {
                        console.log(parsedMsg.value);
                        UnitTemplate.findAll()
                            .then(function(rawData) {
                                var jsonData = [];
                                rawData.forEach(function(unit) {
                                    jsonData.push(unit.get({plain : true}));
                                })
                                ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.UNIT_DATA, jsonData).toJSON());
                            })
                        break;
                    }
                    case local.messageCode.LOAD_TROOPS_TO_CLIENT : {
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
                            ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.UNIT_DATA, attackFaction).toJSON());
                        })
                        Unit.findAll({where : {faction : defenceFaction.faction}})
                        .then(function(troops) {
                            troops.forEach(function(unit) {
                                defenceFaction.troops.push(unit.get({plain : true}));
                            })
                            ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.UNIT_DATA, defenceFaction).toJSON());
                        })
                        break;
                    }
                    default : {
                        console.log(parsedMsg.value)
                    }
                }
                break;
            }
            case local.WebMsg.TYPE_CLASS.BATTLE_DATA : {
                var battleMsg = new local.BattleMsg(parsedMsg.value);
                var condition = {
                    where : {
                        battleID : battleMsg.battleID,
                        battleProp : battleMsg.battleProp
                    }
                }
                Battle.findOrCreate(condition).spread(function(battle, created) {
                    if (created) {
                        ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.MSG, "new battle record...").toJSON());
                    } else {
                        ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.MSG, "battle exsits...").toJSON());
                    }
                })
                break;
            }
            case local.WebMsg.TYPE_CLASS.PLAYER_DATA : {
                var playerMsg = new local.PlayerMsg(parsedMsg.value),
                    otherFaction = playerMsg.otherFaction;
                var condition = {
                    where : {
                        battleID : playerMsg.battleID
                    }
                }
                var loadTroops = function(msg) {
                    console.log("-----------");
                    console.log(msg);
                    console.log("-----------------------");
                    var unitArray = msg.toUnitArray();
                    msg.troops = msg.troops2String();
                    var whereConditiion = {
                        where : {
                            battleID : msg.battleID,
                            playerID : msg.playerID,
                            faction : msg.faction
                        }
                    }
                    Player.update(msg.getMsg(), whereConditiion).then(function(result) {
                        console.log(result);
                        console.log("player troops load successfully...");
                        unitArray.forEach(function(unit, iter) {
                            Unit.create(unit).then(function(result) {
                                console.log(iter + " unit load successfully");
                                ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, msg.otherFaction).toJSON());
                            })
                        })
                    })
                }
                var checkPlayerRecord = function(msg) {
                    // 检查传入的player msg与player_table之间的关系，来返回检查结果，控制user config流程。
                    Player.findAndCount(condition).then(function(result) {
                        switch (result.count) {
                            case 0 : {
                                if (msg.troops == null) {
                                    Player.create(msg).then(function(result) {
                                        console.log(msg.playerID + " player record created...");
                                        ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, msg.faction).toJSON());
                                    });
                                } else {
                                    throw new Error("player has troops!!!");
                                }
                                break;
                            }
                            case 1 : {
                                var record = result.rows[0];
                                if (msg.playerID === record.getDataValue("playerID") && record.getDataValue("troops") == null) {
                                    // player ID 已经存在但是不完整。
                                    if (msg.troops == null) {
                                        // troops为空，说明数据来自unit config开始的通报
                                        console.log("to config troops...");
                                        ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, msg.faction).toJSON());
                                    } else {
                                        // troops不为空，说明数据来自Unit config完成后的数据提交
                                        console.log("...1 record to load troops...");
                                        loadTroops(msg);
                                    }
                                } else if (msg.playerID === record.getDataValue("playerID") && record.getDataValue("troops") != null) {
                                    // playerID 已经存在并且完整。开始配置另一个player
                                    console.log("to another player...");
                                    ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, otherFaction).toJSON());
                                } else {
                                    // player ID 不存在。继续配置该player的troops。结束配置后进入war状态。
                                    Player.create(msg, condition).then(function(result) {
                                        console.log(msg.playerID + " player record created...");
                                        ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, local.messageCode.CLOSE_TO_WAR).toJSON());
                                    });
                                }
                                break;
                            }
                            case 2 : {
                                // 在case 2的情况中集中处理single battle状况中配置不完全就掉线的情况，以及seperate battle的配置情况。 
                                var rightRecord, rightIter, otherRecord;
                                result.rows.forEach(function(record, iter) {
                                    if (record.getDataValue("playerID") === msg.playerID) {
                                        rightRecord = record;
                                        rightIter = iter;
                                    }
                                })
                                otherRecord = result.rows[rightIter === 1 ? 0 : 1];
                                if (rightRecord != null && rightRecord.playerID != otherRecord.playerID) {
                                    // 找到两条合法的记录
                                    if (rightRecord.troops == null) {
                                        // 该记录不完整
                                        if (msg.troops == null) {
                                            console.log("to config troops...");
                                            ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, msg.faction).toJSON());
                                        } else {
                                            console.log("...2 record to load troops...");
                                            loadTroops(msg);
                                        }
                                    } else if (otherRecord.troops == null) {
                                        // 该记录完整，另一条记录不完整。
                                        console.log("to another player...");
                                        ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, otherFaction).toJSON());
                                    } else {
                                        // 两条完整记录都存在。
                                        console.log("ready to war");
                                        ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, local.messageCode.WAR_BEGIN).toJSON());
                                    }
                                } else {
                                    // 没有找到playerID匹配的记录，那么丢弃所有已经找到的记录，然后将playerMsg插入，并进入unit config界面
                                    console.log("double players record founded with mistakes...");
                                    Player.destroy(condition).then(function(result) {
                                        console.log("drop records successfully...");
                                        Player.create(msg).then(function(result) {
                                            console.log("new player record created...");
                                            ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, local.msg.faction).toJSON());
                                        });
                                    })
                                }
                                break;
                            }
                            default : {
                                console.log("multiple players founed...");
                                Player.destroy(condition).then(function(result) {
                                    console.log("drop records successfully...");
                                    Player.create(msg).then(function(result) {
                                        console.log("new player record created...");
                                        ws.send(new WebMsg(WebMsg.TYPE_CLASS.CODE_DATA, msg.faction).toJSON());
                                    });
                                })
                            }
                        }
                    })
                }
                checkPlayerRecord(playerMsg);
                break;
            }
            case local.WebMsg.TYPE_CLASS.MSG : {
                console.log("client msg : " + parsedMsg.value);
                break;
            }
            default : {
                console.log("no type : " + parsedMsg.value);
                break;
            }
        }
    })

    ws.on("close", function(data) {
        Unit.sync({force : true});
        console.log("connection is cancelled by client!!!");
    });

    var checkFaction = function(faction, troopCount) {
        // 检查双方faction player的设置情况，并给与反馈
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
                        ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, local.messageCode.WAR_BEGIN).toJSON());
                    } else {
                        console.log(otherFaction + " waiting...");
                        ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, local.messageCode.TROOP_CONFIG_READY).toJSON());
                    }
                })
            } else {
                Unit.count({where : {faction : otherFaction}})
                .then(function(result) {
                    if (result === troopCount) {
                        console.log(faction + " ready...");
                        ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, local.messageCode.TROOP_CONFIG_READY).toJSON());
                    } else {
                        console.log(otherFaction + " waiting...");
                        ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, faction).toJSON());
                    }
                })
            }
        })
    }
});




