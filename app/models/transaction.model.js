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
    extra:String

});
module.exports=mongoose.model('Transaction',TransactionSchema);
