var local = require("./messageModels");

module.exports = function(sequelize, DataTypes) {
    return sequelize.define("battle_table", {
        battleID : {
            type : DataTypes.INTEGER,
            unique : true
        },
        battleProp : {
            type : DataTypes.STRING,
            validate : {
                isLegal : function(value) {
                    if (value !== local.messageCode.SET_LOCAL_BATTLE && value !== local.messageCode.SET_REMOTE_BATTLE) {
                        throw new Error("battle scene set illegal!!!");
                    }
                }
            }
        },
        attackFaction : DataTypes.STRING,
        defenceFaction : DataTypes.STRING
    }, {
        freezeTableName :true
    })
}