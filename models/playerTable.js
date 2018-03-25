module.exports = function(sequelize, DataTypes) {
    return sequelize.define("player_table", {
        playerID : DataTypes.INTEGER,
        battleID : DataTypes.INTEGER,
        faction : DataTypes.STRING,
        troops : DataTypes.STRING
    }, {
        freezeTableName :true
    })
}