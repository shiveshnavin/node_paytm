import express, { Application, Request, Response, NextFunction, RequestHandler, Router } from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import exphbs from 'express-handlebars';
import mongoose from 'mongoose';
import { PaymentController } from './app/controllers/payment.controller';
import { NPCallbacks, NPConfig, NPConfigTheme, NPTableNames } from './app/models';
import { MultiDbORM } from 'multi-db-orm';
import { buildConfig, withClientConfigOverrides } from './app/utils/buildConfig';

export * from './app/models';

interface RawBodyRequest extends Request {
    rawBody?: string;
}

export function attachRawBodyAndEngine(app: Application, userConfig: Partial<NPConfig> = {}): void {
    const config: any = buildConfig(userConfig);
    const saveRawBody = (req: RawBodyRequest, res: Response, buf: Buffer) => {
        req.rawBody = buf && buf.toString();
    };
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json({ verify: saveRawBody as any }));

    const viewRoot = config.templateDir
        ? path.resolve(config.templateDir)
        : path.join(__dirname, 'app', 'views');
    const layoutPath = path.join(viewRoot, 'layouts', 'index.hbs');


    app.engine('hbs', exphbs({
        extname: 'hbs',
        defaultLayout: layoutPath,
        helpers: {
            theme_color: () => config.theme_color,
            logo: () => config.logo,
            brand: () => config.brand || 'Secure Pay',
        },
    } as any));

    app.set('view engine', 'handlebars');
    app.set('attachRawBodyAndEngine', true);
}

export function createPaymentMiddleware(
    app: Application,
    userConfig: NPConfig,
    db: MultiDbORM,
    callbacks?: NPCallbacks,
    authenticationMiddleware?: RequestHandler,
    tableNames?: NPTableNames): Router {

    //check attachRawBodyAndEngine
    if (!app.get('attachRawBodyAndEngine')) {
        console.warn('[node-paytmpg]: attachRawBodyAndEngine not attached. Make sure to call attachRawBodyAndEngine() or make sure hbs view engine is set and req.rawBody is available.');
        attachRawBodyAndEngine(app, userConfig);
    }

    const config: any = buildConfig(userConfig);
    const subApp = express.Router();

    if (!authenticationMiddleware) {
        authenticationMiddleware = (req: Request, res: Response, next: NextFunction) => next();
    }

    const saveRawBody = (req: RawBodyRequest, res: Response, buf: Buffer) => {
        req.rawBody = buf && buf.toString();
    };

    subApp.use(bodyParser.urlencoded({ extended: true }));
    subApp.use(bodyParser.json({ verify: saveRawBody as any }));

    callbacks = callbacks || config.callbacks;
    const pc = new PaymentController(config, db, callbacks, tableNames);

    subApp.use((req: Request, res: Response, next: NextFunction) => {
        let _client = withClientConfigOverrides(config, req);
        const theme = _client.theme || {} as NPConfigTheme;
        res.locals.theme = {
            primary: theme.primary || '#086cfe',
            accent: theme.accent || '#5ce1e6',
            surface: theme.surface || '#0f1021',
            text: theme.text || '#e9ecf2',
            success: theme.success || '#24cf5f',
            danger: theme.danger || '#ff6b6b',
        };
        res.locals.themeName = theme.name || 'dark';
        res.locals.brand = theme.brand || 'Secure Pay';
        res.locals.logo = theme.logo || '';
        res.locals.path_prefix = _client.path_prefix;
        next();
    });

    subApp.use((req: Request, res: Response, next: NextFunction) => {
        console.log('Received request at', req.originalUrl);
        next();
    });

    subApp.all('/init', authenticationMiddleware, (req, res) => {
        pc.init(req, res);
    });
    subApp.all('/callback', authenticationMiddleware, (req, res) => {
        pc.callback(req, res);
    });
    subApp.all('/api/webhook', authenticationMiddleware, (req, res) => {
        pc.webhook(req, res);
    });
    subApp.all('/api/status', authenticationMiddleware, (req, res) => {
        pc.status(req, res);
    });
    subApp.all('/api/transactions', authenticationMiddleware, (req, res) => {
        pc.getTransactions(req, res);
    });
    subApp.all('/api/createTxn/token', authenticationMiddleware, (req, res) => {
        pc.createTxnToken(req, res);
    });
    subApp.all('/api/createTxn', authenticationMiddleware, (req, res) => {
        pc.createTxn(req, res);
    });
    subApp.all('/', authenticationMiddleware, (req, res) => {
        pc.init(req, res);
    });

    subApp.use(express.static(path.join(__dirname, 'public')), authenticationMiddleware, (req, res) => {
        pc.init(req, res);
    });

    return subApp;
}

export default { createPaymentMiddleware };
