var local = require("./models/messageModels");
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
                        console.log("...data reload ready...");
                    })
                    .catch(function (err) {
                        console.log(err);
                    })
                }
            })
    }
})
Unit.sync()
Battle.sync();
Player.sync().then(function(result) {
    Player.update({active : local.PlayerMsg.STATUS.SLEEP}, {where : {active : local.PlayerMsg.STATUS.ACTIVE}});
} );;

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
                        // 装载模板之前，首先要重置player的active状态。
                        Player.update({active : local.PlayerMsg.STATUS.SLEEP}, {where : {active : local.PlayerMsg.STATUS.ACTIVE}});
                        // 接下来再重置模板。
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
                var setPlayerRecord = function() {
                    /*
                     * 检查传入的player msg与player_table之间的关系，来返回检查结果，控制user config流程。
                     * 经过仔细考察，在实现阶段，只需要考虑player condition的结果。分别按0、1来考虑，否则就将battle condition的结果丢弃。
                     * 根据player condition与msg的查询结果，来找到合适时机loadTroops。装载完成后，再检查battle condition的结果。
                     * 按照0、1、2来考虑，分别对应faction / CLOSE_TO_WAR / WAR_BEGIN。
                     */
                    var battleCondition = {
                            where : {
                                battleID : playerMsg.battleID,
                                active : local.PlayerMsg.STATUS.ACTIVE
                            }
                        },
                        playerCondition = {
                            where : {
                                battleID : playerMsg.battleID,
                                playerID : playerMsg.playerID,
                                faction : playerMsg.faction
                            }
                        };
                    var loadTroops = function(msg) {
                        // 装载troops。并在成功后查询battle condition的记录
                        var unitArray = playerMsg.troops;
                        Player.update({
                            troops : playerMsg.troops2String()  
                        }, playerCondition).then(function(result) {
                            unitArray.forEach(function(unit, iter) {
                                Unit.create(unit).then(function(result) {
                                    console.log("..." + iter + " unit load successfully...");
                                });
                            })
                            ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, msg).toJSON());
                        })
                    }
                    var activePlayer = function(loadTroopsMsg, skipTroopsMsg) {
                        if (playerMsg.troops != null) {
                            throw new Error("real troops in new record");
                        }
                        console.log("...ready to create player：" + playerMsg.playerID);
                        var updateMsg;
                        Player.findAndCount(playerCondition).then(function(result) {
                            if (result.count) {
                                updateMsg = result.rows[0].get({plain : true});
                            } else {
                                updateMsg = playerMsg.getMsg();
                            }
                            updateMsg.active = local.PlayerMsg.STATUS.ACTIVE;
                            Player.upsert(updateMsg).then(function(created) {
                                if (created) {
                                    console.log("..." + playerMsg.playerID + " player record created...");
                                    ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, msg).toJSON());
                                } else {
                                    var stringMsg = "..." + playerMsg.playerID + " has exists...";
                                    console.log(stringMsg);
                                    ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.MSG, stringMsg).toJSON());
                                    if (updateMsg.troops == null) {
                                        console.log("...go to " + loadTroopsMsg + "...");
                                        ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, loadTroopsMsg).toJSON());
                                    } else {
                                        console.log("...go to " + skipTroopsMsg + "...");
                                        ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, skipTroopsMsg).toJSON());
                                    }
                                }
                            })
                        })
                    }
                    Player.findAndCount(battleCondition).then(function(result) {
                        switch (result.count) {
                            // 查询 battleCondition 的记录条目，即查询当前 battle 中被 ACTIVE 的记录条目。
                            case 0 : {
                                // 如果没有匹配，那么就创建记录
                                activePlayer(playerMsg.faction, playerMsg.otherFaction);
                                break;
                            }
                            case 1 : {
                                // 如果只有1个匹配
                                var record = result.rows[0];
                                console.log("...check player in battle...");
                                switch (playerMsg.checkPlayerInBattle(record.playerID, record.faction)) {
                                    case local.PlayerMsg.STATUS.CHECK_RIGHT : {
                                        // 当前记录player信息与输入数据严格匹配，那么继续判断
                                        if (record.troops == null && playerMsg.troops == null) {
                                            // 当前记录troops为空，并且输入数据troops也为空，那么仅需配置当前player.
                                            console.log("..." + playerMsg.playerID + " player to unit config...");
                                            ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, playerMsg.faction).toJSON());
                                        } else if (record.troops == null && playerMsg.troops != null) {
                                            // 当前记录troops为空，但是输入数据troops不为空，那么载入troops，然后转向另一个player.
                                            console.log("..." + playerMsg.playerID + " player to load troops...");
                                            loadTroops(playerMsg.otherFaction);
                                        } else {
                                            // 当前troops不为空，无论如何都转向下一个player.
                                            console.log("..." + playerMsg.playerID + " player done, to another player...");
                                            ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, playerMsg.otherFaction).toJSON());
                                        }
                                        break;
                                    }
                                    case local.PlayerMsg.STATUS.CHECK_WRONG : {
                                        // 如果当前记录player信息与输入数据不严格匹配，那么返回battle config界面。
                                        var msg = "...return to battle config...";
                                        console.log(msg);
                                        ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.MSG, msg).toJSON());
                                        break;
                                    }
                                    case local.PlayerMsg.STATUS.EXACT_CHECK_WRONG : {
                                        // 如果当前记录player信息与输入数据严格不匹配，那么激活当前数据。
                                        activePlayer(local.messageCode.CLOSE_TO_WAR, local.messageCode.WAR_BEGIN);
                                        break;
                                    }
                                    default : {
                                        console.log("...check wrong...");
                                        console.log(playerMsg.checkPlayerInBattle(record.playerID, record.faction));
                                    }
                                }
                                break;
                            }
                            case 2 : {
                                var targetRecord, otherRecord;
                                result.rows.forEach(function(record) {
                                    if (record.playerID == playerMsg.playerID) {
                                        targetRecord = record;
                                    } else {
                                        otherRecord = record;
                                    }
                                })
                                console.log("...check player in battle...");
                                switch (playerMsg.checkPlayerInBattle(targetRecord.playerID, targetRecord.faction)) {
                                    case local.PlayerMsg.STATUS.CHECK_RIGHT: {
                                        if (targetRecord.troops == null && otherRecord.troops == null && playerMsg.troops == null) {
                                            // 目标记录与附加记录的troops都为空，且输入数据的troops也为空。那么继续当前player的unit config。
                                            console.log("...to config unit...");
                                            ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, playerMsg.faction).toJSON());
                                        } else if (targetRecord.troops == null && otherRecord.troops == null && playerMsg.troops != null) {
                                            // 目标记录与附加记录的troops都为空，但输入数据的troops不为空。那么向当前player装载troops，然后转向另一个player。
                                            console.log("...to load troops in player: " + playerMsg.playerID + "...");
                                            loadTroops(playerMsg.otherFaction);
                                        } else if (targetRecord.troops == null && otherRecord.troops != null && playerMsg.troops == null) {
                                            // 目标记录troops为空，但附加记录troops不为空，而输入数据的troops为空。那么继续配置当前player，但是准备配置完毕后进入battle状态。
                                            console.log("...to config unit...");
                                            ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, local.messageCode.CLOSE_TO_WAR).toJSON());
                                        } else if (targetRecord.troops == null && otherRecord.troops != null && playerMsg.troops != null) {
                                            // 目标记录troops为空，但附加记录troops不为空，且输入数据的troops不为空。那么向当前player装载troops，然后进入battle状态。
                                            console.log("...to load troops in player: " + playerMsg.playerID + "...");
                                            loadTroops(local.messageCode.WAR_BEGIN);
                                        } else if (targetRecord.troops != null && otherRecord.troops == null) {
                                            // 目标记录troops不为空，但是附加记录troops为空，那么转向另一个player。
                                            console.log("...to load troops in player: " + playerMsg.playerID + "...");
                                            ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, playerMsg.otherFaction).toJSON());
                                        } else if (targetRecord.troops != null && otherRecord.troops != null && playerMsg.troops == null) {
                                            // 目标记录与附加记录都不为空，那么进入battle状态。
                                            console.log("...into the battle: " + playerMsg.battleID + "...");
                                            ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, local.messageCode.WAR_BEGIN).toJSON());
                                        } 
                                        break;
                                    }
                                    case local.PlayerMsg.STATUS.CHECK_WRONG : ;
                                    case local.PlayerMsg.STATUS.EXACT_CHECK_WRONG : {
                                        // 只要记录中的player信息与输入数据中的player信息不严格匹配，就返回battle config。
                                        var msg = "...return to battle config...";
                                        console.log(msg);
                                        ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.MSG, msg).toJSON());
                                        break;
                                    }
                                    default : {
                                        console.log("...check wrong...");
                                        console.log(playerMsg.checkPlayerInBattle(targetRecord.playerID, targetRecord.faction));
                                    }
                                }
                            }
                            default : {
                                //dropPlayer();
                            }
                        }
                    })
                }
                setPlayerRecord();
                break;
            }
            case local.WebMsg.TYPE_CLASS.LOAD_TROOPS_TO_CLIENT : {
                var playerMsg = new local.PlayerMsg(parsedMsg.value);
                var battleCondition = {
                    where : {
                        battleID : playerMsg.battleID
                    }
                }
                Player.findAll(battleCondition).then(function(result) {
                    if (result.length === 2) {
                        console.log("...find 2 player in battle...");
                        var playerOne = result[0].playerID,
                            playerTwo = result[1].playerID,
                            troopsOne = [],
                            troopsTwo = [],
                            orConditionOne = [],
                            orConditionTwo = [];
                        playerMsg.troops2Array(result[0].troops).forEach(function(serial) {
                            orConditionOne.push({serialNumber : serial});
                        })
                        Unit.findAll({where : {$or : orConditionOne}}).then(function(unitRecord) {
                            unitRecord.forEach(function(record, iter) {
                                troopsOne.push(record.get({plain : true}));
                                console.log("...load " + iter + " unit in troops...");
                            })
                            playerMsg.troops2Array(result[1].troops).forEach(function(serial) {
                                orConditionTwo.push({serialNumber : serial});
                            })
                            Unit.findAll({where : {$or : orConditionTwo}}).then(function(unitRecord) {
                                unitRecord.forEach(function(record, iter) {
                                    troopsTwo.push(record.get({plain : true}));
                                    console.log("...load " + iter + " unit in troops...");
                                })
                                console.log("...send troops successfully...");  
                                // 将查询结果放在一个array中传送。                              
                                ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.UNIT_DATA, [new local.UnitMsg(playerOne, troopsOne).getMsg(), new local.UnitMsg(playerTwo, troopsTwo).getMsg()]).toJSON());
                            })
                        })
                    } else {
                        throw new Error("...wrong player number...");
                    }
                })
                break;
            }
            case local.WebMsg.TYPE_CLASS.CHECK_BATTLE_PROP : {
                var battleMsg = new local.BattleMsg(parsedMsg.value);
                Battle.findAll({where : {battleID : battleMsg.battleID}}).then(function(result) {
                    if (result.length === 1) {
                        console.log("...get battle record...");
                        battleMsg.battleProp = result[0].battleProp;
                        ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CHECK_BATTLE_PROP, battleMsg.getMsg()).toJSON());
                    } else {
                        throw new Error("...get multiple same battle with ID: " + battleMsg.battleID + "...");
                    }
                })
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
        console.log("connection is cancelled by client!!!");
    });
});




