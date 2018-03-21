module.exports = function(sequelize, DataTypes) {
    return sequelize.define("unit_template_table", {
        unit : DataTypes.STRING,
        sequence : DataTypes.STRING,
        attackWeapon : DataTypes.INTEGER,
        attackFormation : DataTypes.INTEGER,
        defenceWeapon : DataTypes.INTEGER,
        defenceFormation : DataTypes.INTEGER,
        fleeLife : DataTypes.INTEGER,
        maxLife : DataTypes.INTEGER,
        speciality : DataTypes.STRING,
    }, {
        freezeTableName :true
    })
}