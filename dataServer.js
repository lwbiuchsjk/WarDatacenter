/*
 * armyTemplate与messageCode函数来自WarSimulator。务必注意两者版本要保持一致。
 * 在后续的代码中，应当显式同步配置文件。 
*/
var armyTemplate = {
    sequences : {
        HEAVY_INFANTRY : "heavyInfantry",
        LIGHT_INFANTRY : "lightInfantry",
        HEAVY_CAVALVY : "heavyCavalvy",
        LIGHT_CAVALVY : "lightCavalvy"
    },
    status : {
        ////////////////////////////////////
        // 所有新增的单位状态都需要在这里备案
        DEFENCE : "defence",                                  //近距离防御姿态
        DEFENCE_CHARGE_FACE : "defence_charge_face",          //近距离防御姿态，进攻方正在正面冲锋
        ATTACK : "attack",                                    //近距离进攻姿态
        ATTACK_CHARGE : "attack_charge",                      //近距离进攻_冲锋姿态
        ATTACK_CHARGE_ADVANTAGE : "attack_charge_advantage",  //近距离进攻_冲锋_优势位置姿态
        ATTACK_ENGAGE : "attack_engage",                      //进攻_目标正在交火状态
        ATTACK_REMOTE : "attack_remote",                      //远程攻击姿态
        DEFENCE_REMOTE: "defence_remote"                      //远程防御姿态
    },
    position : {
        FACE : "face",
        SIDE : "side",
        BACK : "back",
        FACE_REMOTE : "face_remote"
    },
    units : {
        SHIELD_MAN : "shieldMan",
        PIKE_MAN : "pikeMan",
        AXE_MAN : "axeMan",
        BOW_MAN : "bowMan",
        IMPACT_HORSE : "impactHorse",
        HUNT_HORSE : "huntHorse"
    },
    faction : {
        attackFaction : "attackFaction",
        defenceFaction: "defenceFaction"
    },
};

var messageCode = {
    TROOP_CONFIG_READY : "runButton",
    LOAD_TROOPS : "loadTroops",
    DELETE_TROOPS : "deleteTroops",
    WAR_BEGIN : "warBegin",
    FACTION_FILE : "factionTroops.json",
    FACTION_FILE_TEMPLATE : {
        attackFaction : null,
        defenceFaction : null,
    }
};

///////////////////////////////////////////////////////////以下为正篇////////////////////////////////////////////////////////////////////

var WebSocket = require("ws");
var fs = require("fs");
var wss = new WebSocket.Server({port: 3000});
var msg = "hello";
console.log("ready?");
wss.on("connection", function connection(ws, req) {
    console.log("connect open");
    ws.send(msg);

    var factionFile = messageCode.FACTION_FILE;
    fs.open(factionFile, "r", function(error) {
        if (error) {
            console.log(error);
            fs.writeFileSync(factionFile, JSON.stringify(messageCode.FACTION_FILE_TEMPLATE));
        } 
    })

    ws.on("message", function(msg) {
        if (typeof msg == "string") {
            var attackTroops, defenceTroops, tmp;
            switch(msg) {
                case armyTemplate.faction.attackFaction : {
                    fs.readFile(factionFile, "utf-8", function(error, data) {
                        if (error) {
                            console.log(error);
                        } else {
                            tmp = JSON.parse(data);
                            attackTroops = tmp[armyTemplate.faction.attackFaction];
                            defenceTroops = tmp[armyTemplate.faction.defenceFaction];
                            if (attackTroops == null) {
                                console.log(msg + " 等待写入...");
                                if (defenceTroops != null) {
                                    console.log(armyTemplate.faction.defenceFaction + " 已经存在...准备进入战斗...");
                                    ws.send(messageCode.TROOP_CONFIG_READY);
                                } else {
                                    ws.send(msg);
                                }
                            } else if (defenceTroops != null) {
                                ws.send(messageCode.WAR_BEGIN);
                            }
                        }
                    })
                    break;
                }
                case armyTemplate.faction.defenceFaction : {
                    fs.readFile(factionFile, "utf-8", function(error, data) {
                        if (error) {
                            console.log(error);
                        } else {
                            tmp = JSON.parse(data);
                            attackTroops = tmp[armyTemplate.faction.attackFaction];
                            defenceTroops = tmp[armyTemplate.faction.defenceFaction];
                            if (defenceTroops == null) {
                                console.log(msg + " 等待写入...");
                                if (attackTroops != null) {
                                    console.log(armyTemplate.faction.attackFaction + " 已经存在...准备进入战斗...");
                                    ws.send(messageCode.TROOP_CONFIG_READY);
                                } else {
                                    ws.send(msg);
                                }
                            } else if (attackTroops != null) {
                                ws.send(messageCode.WAR_BEGIN);
                            }
                        }
                    })
                    break;
                }
                case messageCode.LOAD_TROOPS : {
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
                case messageCode.DELETE_TROOPS : {
                    console.log(messageCode.DELETE_TROOPS);
                    /*
                    fs.writeFile(factionFile, JSON.stringify(messageCode.FACTION_FILE_TEMPLATE), function(error) {
                        if (error) {
                            console.log(error);
                        } else {
                            ws.close();
                        }
                    });
                    */
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
                                                if (tmp[armyTemplate.faction.attackFaction] == null || tmp[armyTemplate.faction.defenceFaction] == null) {
                                                    console.log(messageCode.TROOP_CONFIG_READY)
                                                    ws.send(messageCode.TROOP_CONFIG_READY);
                                                } else {
                                                    console.log(messageCode.WAR_BEGIN);
                                                    ws.send(messageCode.WAR_BEGIN);
                                                }
                                            }
                                        })
                                        /*
                                        fs.writeFile(factionFile, JSON.stringify(jsonTmp), function(error) {
                                            if (error) {
                                                console.log(error);
                                            } else {
                                                console.log(jsonData.faction + " 写入成功...");
                                                fs.readFile(factionFile, "utf-8", function(error, data) {
                                                    if(error) {
                                                        console.log(error);
                                                    } else {
                                                        var tmp = JSON.parse(data);
                                                        if (tmp[armyTemplate.faction.attackFaction] == null || tmp[armyTemplate.faction.defenceFaction] == null) {
                                                            console.log(messageCode.TROOP_CONFIG_READY)
                                                            ws.send(messageCode.TROOP_CONFIG_READY);
                                                        } else {
                                                            console.log(messageCode.WAR_BEGIN);
                                                            ws.send(messageCode.WAR_BEGIN);
                                                        }
                                                    }
                                                })
                                            }
                                        })
                                        */
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



