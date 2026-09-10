const mongoose = require("mongoose");


const storeSchema = new mongoose.Schema(

{
    shop: {
        type: String,
        required: true,
        unique: true,
    },


    accessToken: {
        type: String,
        required: true,
    },


    scope: {
        type: String,
    },


    active: {
        type: Boolean,
        default: true,
    },


    installedAt: {
        type: Date,
        default: Date.now,
    },

    appHandle: {
        type: String,
        default: null,
    },

},

{
    timestamps: true
}

);



module.exports = mongoose.model(
    "Store",
    storeSchema,
    "tbl_stores"
);