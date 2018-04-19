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
    LOAD_UNIT_TEMPLATE : "loadUnitTemplate",
    CHECK_PLAYER : "checkPlayer",
    CHECK_BATTLE_PROP : "CHECK_BATTLE_PROP",
    SET_LOCAL_BATTLE : "setLocalBattle",
    SET_REMOTE_BATTLE : "setRemoteBattle"
};

var TYPE_CLASS = {
    MSG : "MSG",
    CODE_DATA : "CODE_DATA",
    // UNIT_DATA 使用的是UnitMsg 格式。
    UNIT_DATA : "UNIT_DATA",
    BATTLE_DATA : "BATTLE_DATA",
    PLAYER_DATA : "PLAYER_DATA",
    // CHECK_BATTLE_PROP 使用的是 BattleMsg 格式。通过其中的 battleID 来查询对应的battleProp，将查询结果返回。
    CHECK_BATTLE_PROP : "CHECK_BATTLE_PROP",
    // LOAD_TROOPS_TO_CLIENT 使用的是 PlayerMsg 格式。通过其中的 battleID 来检索player记录，然后读取troops信息，将查询结果返回。
    LOAD_TROOPS_TO_CLIENT : "LOAD_TROOPS_TO_CLIENT",
    // FIGHT_PROCESS_DATA 使用的是 FightProcessMsg格式。
    FIGHT_PROCESS_DATA : "FIGHT_PROCESS_DATA"
};

var PlayerMsg = function() {
    /*
     * arguments : playerInfo | playerID | playerID - troops
     */
    this._playerID = 0;
    this._troops = [];
    this._active = 0;
    this._seperateMark = ";";

    this._battleID = null;
    this._faction = null;
    this._otherFaction = null;

    switch (arguments.length) {
        case 1 : {
            if (typeof arguments[0] === "string") {
                this._playerID = arguments[0];
            } else if (typeof arguments[0] === "object" &&
                "playerID" in arguments[0] && "troops" in arguments[0] && "active" in arguments[0] && "battleID" in arguments[0] && "faction" in arguments[0]) {
                this._playerID = arguments[0]["playerID"];
                this._faction = arguments[0]["faction"];
                this._troops = arguments[0]["troops"];
                this._faction = arguments[0]["faction"];
                this._battleID = arguments[0]["battleID"];
                this._active = arguments[0].active;
            } else {
                throw new Error("WRONG play msg format");
            }
            break;
        }
        case 2 : {
            if (typeof arguments[0] === "string" && arguments[1] instanceof Array) {
                this._playerID = arguments[0];
                this._troops = arguments[1];
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
PlayerMsg.STATUS = {
    SLEEP : 0,
    ACTIVE : 1,
    IN_FIGHT : 2,
    CHECK_RIGHT : "CHECK_RIGHT",
    EXACT_CHECK_WRONG : "EXACT_CHECK_WRONG",
    CHECK_WRONG : "CHECK_WRONG"
};
PlayerMsg.prototype = {
    get playerID () {
        return this._playerID;
    },

    set troops(value) {
        this._troops = value;
    },
    get troops () {
        return this._troops;
    },

    set active (value) {
        if (value == PlayerMsg.STATUS.SLEEP || value == PlayerMsg.STATUS.ACTIVE || value == PlayerMsg.STATUS.IN_FIGHT) {
            this._active = value;
        } else {
            throw new Error("...player status set wrong...");
        }
    },
    get active () {
        return this._active;
    },

    set battleID (value) {
        this._battleID = value;
    },
    get battleID () {
        return this._battleID;
    },

    set faction (value) {
        this._faction = value;
    },
    get faction() {
        return this._faction;
    },

    checkPlayerInBattle : function(playerID, faction) {
        if (playerID == this._playerID) {
            if (faction == this._faction) {
                return PlayerMsg.STATUS.CHECK_RIGHT;
            } else {
                return PlayerMsg.STATUS.CHECK_WRONG;
            }
        } else {
            return PlayerMsg.STATUS.EXACT_CHECK_WRONG;
        }
    },

    getMsg : function() {
        var wrapMsg  = this;
        return {
            playerID : wrapMsg._playerID,
            troops : wrapMsg._troops,
            active : wrapMsg._active,

            battleID : wrapMsg._battleID,
            faction : wrapMsg._faction
        };
    },
    troops2Array : function() {
        var string;
        if (arguments.length === 0 && typeof this._troops === "string") {
            string = this._troops;
        } else if (arguments.length === 1 && typeof arguments[0] === "string") {
            string = arguments[0];
        } else {
            throw new Error("wrong troops input...")
        }
        // 注意，此时return的数组，最后一个一定是""。这是因为string troops以_seperateMark结尾。因此在这里处理掉。
        var array = string.split(this._seperateMark);
        return array.slice(0, array.length)
    },
    troops2String : function() {
        var self = this;
        if (this._troops instanceof Array) {
            var stringTroops = "";
            this._troops.forEach(function(unit) {
                stringTroops += unit.serialNumber + self._seperateMark;
            });
            return stringTroops;
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
    this._attackFaction = "";
    this._defenceFaction = "";
    switch(arguments.length) {
        case 1 : {
            if (typeof arguments[0] === "object" && "battleID" in arguments[0] && "battleProp" in arguments[0] 
                && armyTemplate.faction.attackFaction in arguments[0] && armyTemplate.faction.defenceFaction in arguments[0]) {
                this._battleID = arguments[0]["battleID"];
                this._battleProp = arguments[0]["battleProp"];
                this._attackFaction = arguments[0][armyTemplate.faction.attackFaction];
                this._defenceFaction = arguments[0][armyTemplate.faction.defenceFaction];
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

    set attackFaction(value) {
        this._attackFaction = value;
    },
    get attackFaction() {
        return this._attackFaction;
    },

    set defenceFaction(value) {
        this._defenceFaction = value;
    },
    get defenceFaction() {
        return this._defenceFaction;
    },

    getMsg : function() {
        var wrapMsg = this;
        return {
            battleID : wrapMsg._battleID,
            battleProp : wrapMsg._battleProp,
            attackFaction : wrapMsg._attackFaction,
            defenceFaction : wrapMsg._defenceFaction
        };
    }
};

var UnitMsg = function() {
    /*
     * arguments = playerID && troops | playerID | playerID - troops |
     */
    this._playerID = "";
    this._troops = [];
    if (arguments.length === 1) {
        if (typeof arguments[0] === "object" && "playerID" in arguments[0] && "troops" in arguments[0]) {
            this._playerID = arguments[0].playerID;
            this._troops = arguments[0].troops;
        } else if (typeof arguments[0] === "string") {
            this._playerID = arguments[0]
        }
    } else if (arguments.length === 2 && typeof arguments[0] === "string" && arguments[1] instanceof Array) {
        this._playerID = arguments[0];
        this._troops = arguments[1];
    } else {
        throw new Error("wrong unit msg input");
    }
};
UnitMsg.prototype = {
    get playerID() {
        return this._playerID;
    },
    get troops () {
        return this._troops;
    },
    set troops (value) {
        this._troops = value;
    },
    getMsg : function() {
        var self = this;
        return {
            playerID : self._playerID,
            troops : self._troops
        }
    }
};

var FightProcessMsg = function() {
    // argument : fightInfo | battleID | battleID - driveUnit - sufferUnit - status - driveLife - sufferLife - round
    this._battleID = 0;
    this._driveUnit = "";
    this._sufferUnit = "";
    this._status = "";
    this._driveLife = 0;
    this._sufferLife = 0;
    this._round = 0;
    if (arguments.length === 1) {
        if (typeof arguments[0] === "object" && "battleID" in arguments[0] && "driveUnit" in arguments[0] && "sufferUnit" in arguments[0] &&
            "status" in arguments[0] && "driveLife" in arguments[0] && "sufferLife" in arguments[0] && "round" in arguments[0]) {
            this._battleID = arguments[0]["battleID"];
            this._driveUnit = arguments[0]["driveUnit"];
            this._sufferUnit = arguments[0]["sufferUnit"];
            this._status = arguments[0]["status"];
            this._driveLife = arguments[0]["driveLife"];
            this._sufferLife = arguments[0]["sufferLife"];
            this._round = arguments[0]["round"];
        } else if (typeof arguments[0] === "number") {
            this._battleID = arguments[0];
        } else {
            throw new Error("...wrong single input with FightProccessMsg...")
        }
    } else if (arguments.length === 7 &&
        typeof arguments[0] === "number" && typeof arguments[1] === "string" && typeof arguments[2] === "string" &&
        typeof arguments[3] === "string" && typeof arguments[4] === "number" && typeof arguments[5] === "number" && typeof arguments[6] === "number") {
        this._battleID = arguments[0];
        this._driveUnit = arguments[1];
        this._sufferUnit = arguments[2];
        this._status = arguments[3];
        this._driveLife = arguments[4];
        this._sufferLife = arguments[5];
        this._round = arguments[6];
    } else {
        throw new Error("...wrong input with FightProccessMsg...");
    }
};
FightProcessMsg.prototype = {
    set driveUnit (value) {
        this._driveUnit = value;
    },
    get driveUnit() {
        return this._driveUnit;
    },
    set sufferUnit(value) {
        this._sufferUnit = value;
    },
    get sufferUnit() {
        return this._sufferUnit;
    },
    set status(value) {
        this._status = value;
    },
    get status() {
        return this._status;
    },
    set driveLife(value) {
        this._driveLife = value;
    },
    get driveLife() {
        return this._driveLife;
    },
    set sufferLife (value) {
        this._sufferLife = value;
    },
    get sufferLife() {
        return this._sufferLife;
    },
    set round(value) {
        this._round = value;
    },
    get round() {
        return this._round;
    },
    getMsg () {
        return {
            battleID : this._battleID,
            driveUnit : this._driveUnit,
            sufferUnit : this._sufferUnit,
            status : this._status,
            driveLife : this._driveLife,
            sufferLife : this._sufferLife,
            round : this._round
        }
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
exports.UnitMsg = UnitMsg;
exports.FightProcessMsg = FightProcessMsg;
