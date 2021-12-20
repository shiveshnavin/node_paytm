var User ;
var Transaction = require('../models/np_transaction.model.js');
var IDLEN = 10 ;
function makeid(length) {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

module.exports = function (app, callbacks) {
  var module = {};
  var config = (app.get('np_config'))

  let usingMultiDbOrm = false;
  if (config.db_url) {
    User = require('../models/np_user.model.js');
    usingMultiDbOrm = false;
  } else if (app.multidborm) {
    User = require('../models/np_multidbplugin.js')('npusers',app.multidborm);
    User.db=app.multidborm;
    User.modelname='npusers'
    User.idFieldName='id'
    app.NPUser = User;
    usingMultiDbOrm = true;
  }
  module.create = (userData, cb) => {

    User.findOne({ email: userData.email }, function (err, user) {
      if (user) {

        // console.log("User Update : ",userData.name );
        var myquery = { email: userData.email };

        var objForUpdate = user;

        if (userData.email && userData.email.indexOf("@") !== -1) objForUpdate.email = userData.email;
        if (userData.phone && userData.phone.length > 2) objForUpdate.phone = userData.phone;
        if (userData.name && userData.name.length > 2) objForUpdate.name = userData.name;
        delete objForUpdate._id ;
        var newvalues = { $set: objForUpdate };
        //console.log("User Old : ",userData.name);
        User.updateOne(myquery, newvalues, function (err, saveRes) {
          if (err) cb({
            message: err.message || "Some error occurred while updating users."
          });

          // console.log("Sendiing callback")
          cb(user);
          //  console.log("sent callback")
        });


      } else {

        //  console.log("User New : ",userData.name);

        userData.id = makeid(IDLEN);
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

    },usingMultiDbOrm ? User : undefined);

  };
  return module;

}