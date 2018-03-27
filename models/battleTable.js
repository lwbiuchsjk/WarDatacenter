var local = require("./messageModels");

module.exports = function(sequelize, DataTypes) {
    return sequelize.define("battle_table", {
        battleID : DataTypes.INTEGER,
        battleProp : {
            type : DataTypes.STRING,
            validate : {
                isLegal : function(value) {
                    if (value !== local.messageCode.SET_SINGLE_BATTLE && value !== local.messageCode.SET_MULTI_BATTLE) {
                        throw new Error("battle scene set illegal!!!");
                    }
                }
            }
        }
    }, {
        freezeTableName :true
    })
}