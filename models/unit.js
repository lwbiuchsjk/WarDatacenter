module.exports = function(sequelize, DataTypes) {
    return sequelize.define("unit_table", {
        playerID : DataTypes.INTEGER,
        unit : DataTypes.STRING,
        life : DataTypes.INTEGER,
        status : DataTypes.STRING,
        position : DataTypes.STRING,
        title : DataTypes.INTEGER,
        faction : DataTypes.STRING,
        serialNumber : DataTypes.INTEGER,
        sequence : DataTypes.STRING,
        attackWeapon : DataTypes.INTEGER,
        attackFormation : DataTypes.INTEGER,
        defenceWeapon : DataTypes.INTEGER,
        defenceFormation : DataTypes.INTEGER,
        fleeLife : DataTypes.INTEGER,
        maxLife : DataTypes.INTEGER,
        speciality : DataTypes.STRING,
        engage : DataTypes.STRING,
        ability : DataTypes.STRING
    }, {
        freezeTableName :true
    })
}