module.exports = function(sequelize, DataTypes) {
    return sequelize.define("fight_process_table", {
        battleID : DataTypes.INTEGER,
        driveUnit : DataTypes.STRING,
        sufferUnit : DataTypes.STRING,
        status : DataTypes.STRING,
        driveLife : DataTypes.INTEGER,
        sufferLife : DataTypes.INTEGER,
        round : DataTypes.INTEGER,
    }, {
        freezeTableName :true
    })
}