var packageInfo=require('../../package.json')
var config=require('../../config.json')
var packageInfo=require('../../package.json')
var vp=__dirname+config.view_path

exports.home=(req,res)=>{


    res.render(vp+"home.hbs",packageInfo)


}

exports.init=(req,res)=>{


    

    res.render(vp+"init.hbs",packageInfo)


}