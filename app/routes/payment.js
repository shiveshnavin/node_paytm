module.exports=(app)=>{


    var packageInfo=require('../../package.json')

    app.all('/',function(req,res)
    {
        res.send({message:packageInfo.description,developer:packageInfo.author,version:packageInfo.version})

    })






}