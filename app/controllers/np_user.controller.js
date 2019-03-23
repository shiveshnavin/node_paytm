const User = require('../models/np_user.model.js'); 
const Transaction = require('../models/np_transaction.model.js');

function makeid(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  
    for (var i = 0; i < length; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));
  
    return text;
}

exports.create = (userData, cb) => { 
     
    User.findOne({email: userData.email}, function(err, user) {
        if (user){
           
   // console.log("User Update : ",userData.name );
                var myquery = { email: userData.email };
                
                var objForUpdate = user;
  
if (userData.email && userData.email.indexOf("@")!==-1 ) objForUpdate.email = userData.email;  
if (userData.phone && userData.phone.length>2 ) objForUpdate.phone = userData.phone; 
if (userData.name && userData.name.length>2 ) objForUpdate.name = userData.name;    

                    var newvalues = { $set: objForUpdate }; 
                    //console.log("User Old : ",userData.name);
                    User.updateOne(myquery, newvalues, function(err, saveRes) {
                        if (err) cb({
                            message: err.message || "Some error occurred while updating users."
                        });
        
                       // console.log("Sendiing callback")
                        cb(user);
                      //  console.log("sent callback")
                    });
               

        }else{
                    
                  //  console.log("User New : ",userData.name);

                                userData.id=makeid(6);
                                var userTask = new User(userData);
                                userTask.save()
                                .then(user => {
                                  //  console.log("Sendiing callback")
                                    cb(user);
                                  //  console.log("sent callback")

                                }).catch(err => {
                                    return cb(err);
                                });
                            
             }
                        
            });

};

