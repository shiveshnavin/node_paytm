import { Request, Response, NextFunction } from 'express';
import { SubscriptionController } from '../controllers/subscription.controller';

const subscriptionRoute = function (app: any, express: any, callbacks?: any) {
    const config = app.get('np_config');
    const sc = new SubscriptionController(config, app);
    const router = express.Router();

    // Plan Management
    router.post('/plans', (req, res) => sc.createPlan(req, res));
    router.get('/plans', (req, res) => sc.getPlans(req, res));
    router.get('/plans/:id', (req, res) => sc.getPlan(req, res));
    router.patch('/plans/:id', (req, res) => sc.updatePlan(req, res));
    router.delete('/plans/:id', (req, res) => sc.deletePlan(req, res));

    // Subscription Management
    router.post('/init', (req, res) => sc.initSubscription(req, res));
    router.post('/createTxn', (req, res) => sc.initSubscription(req, res));
    router.post('/createTxn/token', (req, res) => sc.initSubscription(req, res));
    router.get('/checkout/:id', (req, res) => sc.checkoutSubscription(req, res));
    router.get('/:id', (req, res) => sc.getSubscription(req, res));
    router.post('/:id/cancel', (req, res) => sc.cancelSubscription(req, res));
    router.get('/:id/payments', (req, res) => sc.getSubscriptionPayments(req, res));

    return router;
}

export default subscriptionRoute;
