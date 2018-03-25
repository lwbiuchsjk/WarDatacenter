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
    CLOSE_TO_WAR : "runButton",
    LOAD_TROOPS_TO_CLIENT : "loadTroopsClient",
    LOAD_TROOPS_TO_SERVER : "loadTroopsServer",    
    DELETE_TROOPS : "deleteTroops",
    WAR_BEGIN : "warBegin",
    FACTION_FILE : "factionTroops.json",
    FACTION_FILE_TEMPLATE : {
        attackFaction : null,
        defenceFaction : null,
    },
    LOAD_UNIT_TEMPLATE : "loadUnitTemplate",
    CHECK_PLAYER : "checkPlayer",
    SET_SINGLE_BATTLE : "setSingleBattle",
    SET_MULTI_BATTLE : "setMuLtiBattle"
};

MessageChecker = function() {
    this.type = null;
    this.value = null;
};
var TYPE_CLASS = {
    MSG : "MSG",
    CODE_DATA : "CODE_DATA",
    UNIT_DATA : "UNIT_DATA",
    BATTLE_DATA : "BATTLE_DATA",
    PLAYER_DATA : "PLAYER_DATA",
};

var checkInput = function(msgType) {
    return (msgType in TYPE_CLASS)
};

var PlayerMsg = function() {
    /*
     * arguments : battleID | playerInfo | battleID - faction | battleID - faction - playerID - troops
     */
    this._battleID = 0;
    this._playerID = 0;
    this._faction = "";
    this._otherFaction = "";
    this._troops = null;
    this._seprateMark = ";";
    switch (arguments.length) {
        case 1 : {
            if (typeof arguments[0] === "number") {
                this._battleID = arguments[0];
            } else if (typeof arguments[0] === "object" &&
                "battleID" in arguments[0] && "playerID" in arguments[0] && "faction" in arguments[0] && "troops" in arguments[0]) {
                this._battleID = arguments[0]["battleID"];
                this._playerID = arguments[0]["playerID"];
                this._faction = arguments[0]["faction"];
                this._troops = arguments[0]["troops"];
                this._getOtherFaction();
            } else {
                throw new Error("WRONG play msg format");
            }
            break;
        }
        case 2 : {
            if (typeof arguments[0] === "number" && typeof arguments[1] === "string") {
                this._battleID = arguments[0];
                this._faction = arguments[1];
                this._getOtherFaction();
            } else {
                throw new Error("WRONG play msg format");
            }
            break;
        }
        case 4 : {
            if (typeof arguments[0] === "number" && typeof arguments[1] === "string" &&
            typeof arguments[2] === "number" && arguments[3] instanceof Array) {
                this._battleID = arguments[0];
                this._faction = arguments[1];
                this._playerID = arguments[2];
                this._troops = arguments[3];
                this._getOtherFaction();
            } else {
                throw new Error("WRONG play msg format");
            }
            break;
        }
        default : {
            throw new Error("WRONG play msg format");
        }
    }
};
PlayerMsg.prototype = {
    get battleID () {
        return this._battleID;
    },

    set troops(value) {
        this._troops = value;
    },
    get troops () {
        return this._troops;
    },

    set playerID(value) {
        this._playerID = value;
    },
    get playerID () {
        return this._playerID;
    },

    set faction (value) {
        this._faction = value;
        this._getOtherFaction();
    },
    get faction () {
        return this._faction;
    },
    get otherFaction () {
        return this._otherFaction;
    },

    getMsg : function() {
        var wrapMsg  = this;
        return {
            battleID : wrapMsg._battleID,
            faction : wrapMsg._faction,
            playerID : wrapMsg._playerID,
            troops : wrapMsg._troops
        };
    },
    checkConfigReady : function() {
        return this._playerID != 0 && this._faction != "";
    },
    noFaction : function() {
        return this._faction === "";
    },
    troops2Array : function() {
        if (typeof this._troops === "string") {
            return this._troops.split(this._seprateMark);
        } else {
            throw new Error("troops is not String...")
        }
    },
    troops2String : function() {
        if (this._troops instanceof Array) {
            return this._troops.join(this._seprateMark);
        } else {
            throw new Error("troops is not Array...");
        }
    },
    _getOtherFaction : function() {
        if (this._faction !== "") {
            this._otherFaction = this._faction === armyTemplate.faction.attackFaction ? armyTemplate.faction.defenceFaction : armyTemplate.faction.attackFaction;
        } else {
            throw new Error("wrong faction format!!!");
        }
    }
};

var BattleMsg = function() {
    /*
     * arguments : battleInfo | battleID - battleProp
     */
    this._battleID = 0;
    this._battleProp = "";
    switch(arguments.length) {
        case 1 : {
            if (typeof arguments[0] === "object" && "battleID" in arguments[0] && "battleProp" in arguments[0]) {
                this._battleID = arguments[0]["battleID"];
                this._battleProp = arguments[0]["battleProp"];
            } else {
                throw new Error("battle config WRONG!!!");
            }
            break;
        }
        case 2 : {
            if (typeof arguments[0] === "number" && typeof  arguments[1] === "string" ) {
                this._battleID = arguments[0];
                this._battleProp = arguments[1];
            } else {
                throw new Error("battle config WRONG!!!");
            }
            break;
        }
        default : {
            throw new Error("battle config WRONG!!!");
        }
    }
};
BattleMsg.prototype = {
    get battleID() {
        return this._battleID;
    },
    get battleProp() {
        return this._battleProp;
    },
    getMsg : function() {
        var wrapMsg = this;
        return {
            battleID : wrapMsg._battleID,
            battleProp : wrapMsg._battleProp
        };
    }
};

var WebMsg = function() {
    this._type = null;
    this._value = null;
    switch (arguments.length) {
        case 1 : {
            var parsedData = JSON.parse(arguments[0]);
            if (typeof parsedData === "object" &&
            "type" in parsedData && "value" in parsedData) {
                this._type = parsedData["type"];
                this._value = parsedData["value"];
            } else {
                throw new Error("WRONG msg format");
            }
            break;
        }
        case 2 : {
            if (typeof arguments[0] === "string") {
                this._type = arguments[0];
                this._value = arguments[1];
            } else {
                throw new Error("WRONG msg format");
            }
            break;
        }
        default : {
            throw new Error("WRONG msg format");
        }
    }
};
WebMsg.TYPE_CLASS = TYPE_CLASS;
WebMsg.prototype = {
    get type () {
        if (this._type != null) {
            return this._type;
        }
    },
    get value() {
        if (this._value != null) {
            return this._value;
        }
    },
    toJSON : function () {
        var msg = this;
        return JSON.stringify({
            type : msg._type,
            value : msg._value
        });
    }
};

exports.armyTemplate = armyTemplate;
exports.messageCode = messageCode;
exports.WebMsg = WebMsg;
exports.PlayerMsg = PlayerMsg;
exports.BattleMsg = BattleMsg;
