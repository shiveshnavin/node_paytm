const mongoose = require('mongoose');

const UserSchema = mongoose.Schema({ 
    email: String,
    id: String,   
    name : String, 
    phone : String,  
}, {
    timestamps: true
});

 module.exports = mongoose.model('npuser', UserSchema);