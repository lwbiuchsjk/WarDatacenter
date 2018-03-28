module.exports = function(sequelize, DataTypes) {
    return sequelize.define("player_table", {
        playerID : {
            type : DataTypes.INTEGER,
            unique : true
        },
        battleID : DataTypes.INTEGER,
        faction : DataTypes.STRING,
        troops : DataTypes.STRING,
        active : {
            type : DataTypes.INTEGER,
            validate : {
                isNumeric : true,
                isLegal : function(value) {
                    if (value < 0 || value > 2) {
                        throw new Error("...ACTIVE value is out of range...");
                    }
                }
            }
        }
    }, {
        freezeTableName :true
    })
}