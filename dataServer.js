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
                        console.log("data reload ready...");
                    })
                    .catch(function (err) {
                        console.log(err);
                    })
                }
            })
    }
})
//Unit.sync({force : true});
//Battle.sync({force : true});
//Player.sync({force : true});

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
                var checkPlayerRecord = function() {
                    /*
                     * 检查传入的player msg与player_table之间的关系，来返回检查结果，控制user config流程。
                     * 经过仔细考察，在实现阶段，只需要考虑player condition的结果。分别按0、1来考虑，否则就将battle condition的结果丢弃。
                     * 根据player condition与msg的查询结果，来找到合适时机loadTroops。装载完成后，再检查battle condition的结果。
                     * 按照0、1、2来考虑，分别对应faction / CLOSE_TO_WAR / WAR_BEGIN。
                     */
                    var battleCondition = {
                            where : {
                                battleID : playerMsg.battleID
                            }
                        },
                        playerCondition = {
                            where : {
                                battleID : playerMsg.battleID,
                                playerID : playerMsg.playerID,
                                faction : playerMsg.faction
                            }
                        },
                        troopsCondition = {
                            where : {
                                playerID : playerMsg.playerID
                            }
                        };
                    var dropPlayer = function() {
                        console.log("...player get mistakes...");
                        Player.destroy(battleCondition).then(function(result) {
                            console.log("drop records successfully...");
                            Unit.destroy(troopsCondition).then(function(result) {
                                console.log("...troops drop end...")
                                Player.create(playerMsg).then(function(result) {
                                    console.log("new player record created...");
                                    ws.send(new WebMsg(WebMsg.TYPE_CLASS.CODE_DATA, playerMsg.faction).toJSON());
                                });
                            });
                        })      
                    }
                    var loadTroops = function() {
                        // 装载troops。并在成功后查询battle condition的记录
                        var unitArray = playerMsg.troops;
                        Player.update({
                            troops : playerMsg.troops2String()  
                        }, playerCondition).then(function(result) {
                            console.log(result);
                            console.log("...player troops load successfully...");
                            unitArray.forEach(function(unit, iter) {
                                Unit.create(unit).then(function(result) {
                                    console.log("..." + iter + " unit load successfully...");
                                })
                            })
                            checkBattleRecord(playerMsg);
                        })
                    }
                    var checkBattleRecord = function(player) {
                        Player.findAndCount(battleCondition).then(function(result) {
                            // 查询battle condition记录，显示注册玩家数量
                            switch (result.count) {
                                case 1 : {
                                    // 只有1名玩家在册，那么继续配置
                                    if (result.rows[0].troops == null) {
                                        console.log("...1st " + result.rows[0].playerID + " player in config...");
                                        ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, playerMsg.faction).toJSON());
                                    } else {
                                        console.log("...1st " + result.rows[0].playerID + " player troops ready...");
                                        ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, playerMsg.otherFaction).toJSON());
                                    }
                                    break;
                                }
                                case 2 : {
                                    // 有2名玩家在册，那么准备进入战斗
                                    if (player) {
                                        result.rows.forEach(function(record) {
                                            if (record.playerID === player.playerID) {
                                                if (record.troops == null) {
                                                    console.log("...2nd " + player.playerID + " player in config...");
                                                    ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, local.messageCode.CLOSE_TO_WAR).toJSON());
                                                } else {
                                                    console.log("...2nd " + player.playerID + " player troops ready...");
                                                    ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.CODE_DATA, local.messageCode.WAR_BEGIN).toJSON());
                                                }
                                            }
                                        })
                                    }
                                    
                                    break;
                                }
                                default : {
                                    // 其他情况，清空记录并重新开始。
                                    //dropPlayer();
                                }
                            }
                        })  
                    }
                    var createRecord = function() {
                        if (playerMsg.troops != null) {
                            throw new Error("real troops in new record");
                        }
                        Player.create(playerMsg.getMsg()).then(function(result) {
                            console.log("..." + playerMsg.playerID + " player record created...");
                            checkBattleRecord(playerMsg);            
                        })
                    }
                    Player.findAndCount(playerCondition).then(function(result) {
                        switch (result.count) {
                            // 查询player condition的记录条目
                            case 0 : {
                                // 如果没有匹配，那么就创建记录
                                createRecord();
                                break;
                            }
                            case 1 : {
                                // 如果只有1个匹配
                                var record = result.rows[0];
                                if (record.troops == null) {
                                    // 匹配记录中troops为空
                                    if (playerMsg.troops == null) {
                                        // 数据中troops也为空，那么就去配置unit
                                        checkBattleRecord(playerMsg);            
                                    } else {
                                        // 数据中troops不为空，那么就装载troops
                                        loadTroops();
                                    }
                                } else {
                                    // 匹配记录中troops不为空
                                    if (playerMsg.troops == null) {
                                        // 数据中troops为空，那么就转去配置另一个player
                                        console.log("...go another player...");
                                        checkBattleRecord(playerMsg);
                                    } else {
                                        // 数据中troops不为空，则将当前数据覆盖记录
                                        console.log("...update troops...");
                                        loadTroops();
                                    }
                                }
                                break;
                            }
                            default : {
                                //dropPlayer();
                            }
                        }
                    })
                }
                checkPlayerRecord();
                break;
            }
            case local.WebMsg.TYPE_CLASS.LOAD_TROOPS_TO_CLIENT : {
                var playerMsg = new local.PlayerMsg(parsedMsg.value);
                var battleCondition = {
                    where : {
                        battleID : playerMsg.battleID,
                        playerID : {
                            $not : playerMsg.playerID
                        }
                    }
                }
                Player.findAll(battleCondition).then(function(result) {
                    if (result.length === 1) {
                        console.log("...find 2 player in battle...");
                        var playerOne = result[0].playerID,
                            troopsOne = [],
                            arrayTroops1 = playerMsg.troops2Array(result[0].troops);
                        var orCondition = [];
                        arrayTroops1.forEach(function(serial) {
                            orCondition.push({serialNumber : serial});
                        })
                        Unit.findAll({where : {$or : orCondition}}).then(function(unitRecord) {
                            unitRecord.forEach(function(record, iter) {
                                troopsOne.push(record.get({plain : true}));
                                console.log("...load " + iter + " unit in troops...");
                            })
                            console.log("...send " + playerOne + " troops successfully...");                                
                            ws.send(new local.WebMsg(local.WebMsg.TYPE_CLASS.UNIT_DATA, new local.UnitMsg(playerOne, troopsOne).getMsg()).toJSON());
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
        Unit.sync({force : true});
        console.log("connection is cancelled by client!!!");
    });
});




