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
    fs.wirteFile(factionFile, JSON.stringify(messageCode.FACTION_FILE_TEMPLATE), function(error) {
        if (error) {
            console.log(error);
        }
    })

    ws.on("message", function(data) {
        if (typeof data == "string") {
            switch(data) {
                case armyTemplate.faction.attackFaction : {
                    var attackFactionFile = data + ".json";
                    var defenceFactionFile = armyTemplate.faction.defenceFaction + ".json";
                    fs.open(defenceFactionFile, "r", function(error, fd)  {
                        if (error) {
                            fs.open(attackFactionFile, "r", function(error, fd) {
                                if (error) {
                                    console.log(attackFactionFile + " 等待写入...");
                                    ws.send(data);
                                } else {
                                    console.log(attackFactionFile + " 已经存在...单独存在...错误...");
                                }
                            })
                        } else {
                            console.log(defenceFactionFile + " 已经存在...");
                            fs.open(attackFactionFile, "wx", function(error, fd) {
                                if (!error) {
                                    console.log(attackFactionFile + " 等待写入...准备进入战斗...");
                                    ws.send(messageCode.TROOP_CONFIG_READY);
                                } else {
                                    console.log(attackFactionFile + " 已经存在...双重存在...严重错误...");
                                    throw error;
                                }
                            })                      
                        }
                    })
                    break;
                }
                case armyTemplate.faction.defenceFaction : {
                    var attackFactionFile = armyTemplate.faction.attackFaction + ".json";
                    var defenceFactionFile = data + ".json";
                    fs.open(attackFactionFile, "r", function(error, fd)  {
                        if (error) {
                            fs.open(defenceFactionFile, "r", function(error, fd) {
                                if (error) {
                                    console.log(defenceFactionFile + " 等待写入...");
                                    ws.send(data);
                                } else {
                                    console.log(defenceFactionFile + " 已经存在...单独存在...错误...");
                                }
                            })
                        } else {
                            console.log(attackFactionFile + " 已经存在...");
                            fs.open(defenceFactionFile, "wx", function(error, fd) {
                                if (!error) {
                                    console.log(defenceFactionFile + " 等待写入...准备进入战斗...");
                                    ws.send(messageCode.TROOP_CONFIG_READY);                                    
                                } else {
                                    console.log(defenceFactionFile + " 已经存在...双重存在...严重错误...");
                                    throw error;
                                }
                            })                      
                        }
                    })
                    break;
                }
                case messageCode.LOAD_TROOPS : {
                    var attackFactionFile = armyTemplate.faction.attackFaction + ".json",
                        defenceFactionFile = armyTemplate.faction.defenceFaction + ".json";
                    fs.readFile(attackFactionFile, 'utf8', function(error, data) {
                        if (error) {
                            console.log(error);
                        } else {
                            console.log("send file: " + attackFactionFile);
                            ws.send(data)
                        }
                    })
                    fs.readFile(defenceFactionFile, 'utf8', function(error, data) {
                        if (error) {
                            console.log(error);
                        } else {
                            console.log("send file: " + defenceFactionFile);
                            ws.send(data);
                        }
                    })
                    break;
                }
                case messageCode.DELETE_TROOPS : {
                    var attackFactionFile = armyTemplate.faction.attackFaction + ".json",
                        defenceFactionFile = armyTemplate.faction.defenceFaction + ".json";
                    fs.unlink(attackFactionFile, function(error) {
                        if (error) {
                            console.log(error);
                        } else {
                            ws.send("delete file successfully: " + attackFactionFile);
                            fs.unlink(defenceFactionFile, function(error) {
                                if (error) {
                                    console.log(error);
                                } else {
                                    ws.send("delete file successfully: " + defenceFactionFile);
                                    ws.close();
                                }                    
                            })
                        }
                    }); 
                    break;
                }
                default : {
                    var jsonData;
                    try {
                        jsonData = JSON.parse(data);
                    } catch (error) {
                        console.log(error)
                        return;
                    }
                    if (jsonData) {
                        console.log(jsonData);
                        var filePath = jsonData.faction + ".json";
                        var otherFilePath;
                        if (jsonData.faction === armyTemplate.faction.attackFaction) {
                            otherFilePath = armyTemplate.faction.defenceFaction + ".json";
                        } else if (jsonData.faction === armyTemplate.faction.defenceFaction) {
                            otherFilePath = armyTemplate.faction.attackFaction + ".json";
                        }
                        console.log(filePath);
                        fs.open(filePath, "w", function(error, fd) {
                            if (error) {
                                return console.log(error);
                            }
                            console.log(filePath + " 文件打开成功！")
                            fs.writeFile(filePath, JSON.stringify(jsonData), function(error) {
                                if(error) {
                                    throw error;
                                }
                                console.log(filePath + " 文件写入成功！");
                                console.log(otherFilePath);
                                fs.readFile(otherFilePath, 'utf8', function(error, data) {
                                    if (!error) {
                                        console.log(otherFilePath + " 写入成功！" + "\n准备读入数据！");
                                        console.log(data);
                                        ws.send(messageCode.WAR_BEGIN);
                                        ws.close();
                                    } else {
                                        console.log(error);
                                    }
                                })
                            });
                        })
                    } else {
                        console.log(data);
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



