import { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import exphbs from 'express-handlebars';
import path from 'path';
import packageInfo from '../../package.json';
import { PaymentController } from '../controllers/payment.controller';

const paymentRoute = function (app: any, express: any, callbacks?: any) {
    const config = app.get('np_config');
    const pc = new PaymentController(app, callbacks);
    const router = express.Router();
    app.set('view_path', __dirname + config.view_path);
    const vp = app.get('view_path');

    console.log('PaytmPG : Using MultiDB ORM');

    app.engine('hbs', exphbs({
        extname: 'hbs',
        defaultLayout: vp + '/layouts/index.hbs',
        helpers: {
            theme_color: function () {
                return config.theme_color;
            },
            logo: function () {
                return config.logo;
            }
        }
    }));

    app.set('view engine', 'handlebars');

    let saveRawBody = function (req: any, res: any, buf: Buffer, encoding?: string) {
        req.rawBody = buf.toString();
    }
    app.use(bodyParser.urlencoded({ extended: true }))
    app.use(bodyParser.json({ verify: saveRawBody }))

    app.use('/' + config.path_prefix, express.static(path.join(__dirname, '../../public')));
    app.use('/' + config.path_prefix, router);

    router.all('/', pc.init);
    router.all('/init', pc.init);

    router.all('/callback', pc.callback)
    router.all('/api/webhook', pc.webhook)
    router.all('/api/status', pc.status)
    router.all('/api/createTxn/token', pc.createTxnToken)
    router.all('/api/createTxn', pc.createTxn)

    return router
}

export default paymentRoute;
