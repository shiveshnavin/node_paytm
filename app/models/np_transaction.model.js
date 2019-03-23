const mongoose=require('mongoose')
let TransactionSchema=mongoose.Schema({

    orderId:String,
    cusId:String,
    time:Number,
    status:String,
    name:String,
    email:String,
    phone:String,
    amount:Number,
    pname:String,
    extra:String

});
module.exports=mongoose.model('NPTransaction',TransactionSchema);
