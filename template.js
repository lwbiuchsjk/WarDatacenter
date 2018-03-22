/*
 * armyTemplate与messageCode函数来自WarSimulator。务必注意两者版本要保持一致。
 * 在后续的代码中，应当显式同步配置文件。 
*/
exports.armyTemplate = {
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

exports.messageCode = {
    TROOP_CONFIG_READY : "runButton",
    LOAD_TROOPS : "loadTroops",
    DELETE_TROOPS : "deleteTroops",
    WAR_BEGIN : "warBegin",
    FACTION_FILE : "factionTroops.json",
    FACTION_FILE_TEMPLATE : {
        attackFaction : null,
        defenceFaction : null,
    },
    LOAD_UNIT_TEMPLATE : "loadUnitTemplate",
    CHECK_PLAYER : "checkPlayer"
}


/*
exports.WebMsg = function() {
    this.type = null;
    this.value = null
};

exports.WebMsg.TYPE_CLASS = {
    STRING : "string",
    DATA_RECORD : "dataRecord"
};

WebMsg.prototype.loadMsg = function(rawMsg) {
    if (rawMsg) {
        if (rawMsg.type != null && rawMsg.type in this.TYPE_CLASS && rawMsg.value != null) {
            this.type = rawMsg.type;
            this.value = rawMsg.type;
        }
    }
};
*/


MessageChecker = function() {
    this.type = null;
    this.value = null;
};
const TYPE_CLASS = {
    STRING : "STRING",
    DATA_RECORD : "DATA_RECORD"
};

var checkInput = function(msgType) {
    return (msgType in TYPE_CLASS)
};

var WebMsgMaker = function(msgType, msgValue) {
    this._type = null;
    this._value = null;
    if (msgType != null && msgValue != null) {
        if (checkInput(msgType)) {
            this._type = msgType;
            this._value = msgValue;
        } else {
            throw "msg WRONG TYPE!!!"
        }
    } else {
        throw "msg FORMAT ERROR!!!"
    }
};
WebMsgMaker.TYPE_CLASS = TYPE_CLASS;
WebMsgMaker.prototype.toJSON = function() {
    var msg = this;
    return JSON.stringify({
        type : msg._type,
        value : msg._value
    });
};

var WebMsgParser = function(msg) {
    this._type = null;
    this._value = null;
    var rawData = JSON.parse(msg);
    if (rawData.type != null && rawData.value != null) {
        if (checkInput(rawData.type)) {
            this._type = rawData.type;
            this._value = rawData.value;
        } else {
            throw "msg WRONG TYPE!!!"
        }
    } else {
        throw "msg FORMAT ERROR!!!"
    }
};
WebMsgParser.prototype = {
    get type () {
        if (this._type != null) {
            return this._type;
        }
    },
    get value() {
        if (this._value != null) {
            return this._value;
        }
    }
};
WebMsgParser.TYPE_CLASS = TYPE_CLASS;


exports.WebMsgMaker = WebMsgMaker;
exports.WebMsgParser = WebMsgParser;


/*
exports.WebMsg.TYPE_CLASS = enumeration({
    STRING : "string",
    DATA_RECORD : "dataRecord"
})
*/
