import { MultiDbORM } from 'multi-db-orm';
import { Request, Response } from 'express';
import { NPConfig, NPPlan, NPSubscription, NPTableNames, NPTransaction, NPUser } from '../models';
import { withClientConfigOverrides } from '../utils/buildConfig';
import { ISubscriptionProvider } from './adapters/interfaces';
import { RazorpayAdapter } from './adapters/razorpay';
import { NPUserController } from './user.controller';
import { Utils } from '../utils/utils';
import { renderRazorpayCheckout } from './htmlhelper';
import { LoadingSVG } from './static/loadingsvg';

export class SubscriptionController {
    private baseConfig: NPConfig;
    private db: MultiDbORM;
    private tableNames: NPTableNames = { USER: 'npusers', TRANSACTION: 'nptransactions', PLAN: 'npplans', SUBSCRIPTION: 'npsubscriptions' };
    private userController: NPUserController;

    constructor(baseConfig: NPConfig, db: MultiDbORM, tableNames?: NPTableNames) {
        this.baseConfig = baseConfig;
        this.db = db;
        if (tableNames) {
            this.tableNames = { ...this.tableNames, ...tableNames };
        }
        this.userController = new NPUserController(this.db, this.tableNames.USER);
        this.configure();
    }

    private configure() {
        const planSample: NPPlan = {
            id: 'stringsmall',
            name: 'stringsmall',
            description: 'stringlarge',
            amount: 100,
            currency: 'stringsmall',
            period: 'stringsmall' as any,
            planinterval: 1,
            trialdays: 0,
            gatewayplanid: 'stringsmall',
            clientid: 'stringsmall',
            isdeleted: false,
            createdat: 1770051201752,
            updatedat: 1770051201752
        };

        const subSample: NPSubscription = {
            id: 'stringsmall',
            planid: 'stringsmall',
            cusid: 'stringsmall',
            status: 'stringsmall',
            gatewaysubscriptionid: 'stringsmall',
            shorturl: 'stringlarge',
            clientid: 'stringsmall',
            returnurl: 'stringlarge',
            webhookurl: 'stringlarge',
            createdat: 1770051201752,
            updatedat: 1770051201752,
            expireby: 1770051201752,
            startat: 1770051201752,
            extra: 'stringlarge',
            state: 'stringsmall'
        };
        this.db.create(this.tableNames.PLAN, planSample).catch(() => { });
        this.db.create(this.tableNames.SUBSCRIPTION, subSample).catch(() => { });
    }

    private getProvider(config: NPConfig): ISubscriptionProvider | null {
        if (config.razor_url) {
            return new RazorpayAdapter();
        }
        // Future: add PayU adapter here
        return null;
    }

    // --- PLAN MANAGEMENT ---

    async createPlan(req: Request, res: Response): Promise<void> {
        try {
            const config = withClientConfigOverrides(this.baseConfig, req);
            const provider = this.getProvider(config);

            if (!provider) {
                res.status(400).send({ message: 'No supported subscription provider configured.' });
                return;
            }

            const rawInterval = req.body.planinterval ?? req.body.plan_interval ?? req.body.interval;
            const rawTrialDays = req.body.trialdays ?? req.body.trial_days;
            const rawClientId = req.body.clientid ?? req.body.clientId ?? req.query.client_id ?? req.query.clientId ?? '';
            const { id, name, description, amount, currency, period } = req.body;

            if (!id || !name || !amount || !period || !rawInterval) {
                res.status(400).send({ message: 'Missing required fields: id, name, amount, period, planinterval' });
                return;
            }

            // Check if plan already exists locally
            const existingPlan = await this.db.getOne(this.tableNames.PLAN, { id });
            if (existingPlan) {
                res.status(409).send({ message: 'Plan ID already exists locally.' });
                return;
            }

            const parsedInterval = parseInt(rawInterval, 10);
            const planData: NPPlan = {
                id,
                name,
                description,
                amount: parseFloat(amount),
                currency: currency || 'INR',
                period,
                planinterval: parsedInterval,
                trialdays: rawTrialDays ? parseInt(rawTrialDays, 10) : 0,
                clientid: rawClientId,
                createdat: Date.now(),
                updatedat: Date.now(),
                isdeleted: false
            };

            // Register plan with Gateway
            try {
                const gatewayPlanId = await provider.createPlan(planData, config);
                planData.gatewayplanid = gatewayPlanId;
            } catch (gwErr: any) {
                console.error("Gateway Create Plan Error:", gwErr);
                res.status(500).send({ message: 'Failed to create plan on Gateway', error: gwErr?.message || gwErr });
                return;
            }

            // Save locally
            await this.db.insert(this.tableNames.PLAN, planData);
            res.status(201).send(planData);

        } catch (err: any) {
            console.error("Create Plan Error:", err);
            res.status(500).send({ message: 'Internal Server Error', error: err?.message });
        }
    }

    async getPlans(req: Request, res: Response): Promise<void> {
        try {
            const clientId = req.query.clientid || req.query.clientId || req.query.client_id || req.headers['x-client-id'] || '';
            const query: any = { isdeleted: false };
            if (clientId) {
                query.clientid = clientId;
            }

            const limit = Math.min(parseInt((req.query.limit as string), 10) || 20, 100);
            const offset = Math.max(parseInt((req.query.offset as string), 10) || 0, 0);

            const plans = await this.db.get(this.tableNames.PLAN, query, {
                sort: [{ field: 'createdat', order: 'desc' }],
                limit: limit, offset: offset
            });

            res.send({ limit, offset, count: plans.length, plans });
        } catch (err: any) {
            res.status(500).send({ message: 'Error fetching plans', error: err?.message });
        }
    }

    async getPlan(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id;
            const plan = await this.db.getOne(this.tableNames.PLAN, { id, isdeleted: false });
            if (!plan) {
                res.status(404).send({ message: 'Plan not found' });
                return;
            }
            res.send(plan);
        } catch (err: any) {
            res.status(500).send({ message: 'Error fetching plan', error: err?.message });
        }
    }

    async updatePlan(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id;
            const plan = await this.db.getOne(this.tableNames.PLAN, { id, isdeleted: false }) as NPPlan;

            if (!plan) {
                res.status(404).send({ message: 'Plan not found' });
                return;
            }

            const rawInterval = req.body.planinterval ?? req.body.plan_interval ?? req.body.interval;
            const rawTrialDays = req.body.trialdays ?? req.body.trial_days;
            const { name, description, amount, period, currency } = req.body;

            // Check if Gateway immutable fields are changing
            let needsNewGatewayPlan = false;
            if (
                (amount !== undefined && parseFloat(amount) !== plan.amount) ||
                (rawInterval !== undefined && parseInt(rawInterval, 10) !== plan.planinterval) ||
                (period !== undefined && period !== plan.period) ||
                (currency !== undefined && currency !== plan.currency) ||
                (rawTrialDays !== undefined && parseInt(rawTrialDays, 10) !== plan.trialdays)
            ) {
                needsNewGatewayPlan = true;
            }

            const updatedPlan: NPPlan = { ...plan, updatedat: Date.now() };
            if (name !== undefined) updatedPlan.name = name;
            if (description !== undefined) updatedPlan.description = description;
            if (amount !== undefined) updatedPlan.amount = parseFloat(amount);
            if (rawInterval !== undefined) updatedPlan.planinterval = parseInt(rawInterval, 10);
            if (period !== undefined) updatedPlan.period = period;
            if (currency !== undefined) updatedPlan.currency = currency;
            if (rawTrialDays !== undefined) updatedPlan.trialdays = parseInt(rawTrialDays, 10);

            if (needsNewGatewayPlan) {
                const config = withClientConfigOverrides(this.baseConfig, req);
                const provider = this.getProvider(config);
                if (provider) {
                    try {
                        const newGatewayId = await provider.createPlan(updatedPlan, config);
                        updatedPlan.gatewayplanid = newGatewayId;
                    } catch (gwErr: any) {
                        res.status(500).send({ message: 'Failed to create updated plan on Gateway', error: gwErr?.message });
                        return;
                    }
                }
            }

            await this.db.update(this.tableNames.PLAN, { id }, updatedPlan);
            res.send(updatedPlan);

        } catch (err: any) {
            res.status(500).send({ message: 'Error updating plan', error: err?.message });
        }
    }

    async deletePlan(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id;
            const plan = await this.db.getOne(this.tableNames.PLAN, { id });
            if (!plan) {
                res.status(404).send({ message: 'Plan not found' });
                return;
            }

            // Soft delete
            await this.db.update(this.tableNames.PLAN, { id }, { ...plan, isdeleted: true, updatedat: Date.now() });
            res.send({ message: 'Plan deleted successfully', id });
        } catch (err: any) {
            res.status(500).send({ message: 'Error deleting plan', error: err?.message });
        }
    }


    // --- SUBSCRIPTION MANAGEMENT ---

    async initSubscription(req: Request, res: Response): Promise<void> {
        try {
            const rawPlanId = req.body.planid ?? req.body.planId;
            const rawReturnUrl = req.body.returnurl ?? req.body.returnUrl;
            const rawWebhookUrl = req.body.webhookurl ?? req.body.webhookUrl;
            const rawClientId = req.body.clientid ?? req.body.clientId ?? req.body.CLIENT_ID ?? req.query.client_id ?? req.query.clientId ?? '';
            const { NAME, EMAIL, MOBILE_NO, PRODUCT_NAME } = req.body;

            if (!rawPlanId || !NAME || !EMAIL) {
                res.status(400).send({ message: 'Missing required fields: planid, NAME, EMAIL' });
                return;
            }

            const plan = await this.db.getOne(this.tableNames.PLAN, { id: rawPlanId, isdeleted: false }) as NPPlan;
            if (!plan || !plan.gatewayplanid) {
                res.status(404).send({ message: 'Active plan not found or not synced with gateway.' });
                return;
            }

            const config = withClientConfigOverrides(this.baseConfig, req);
            const provider = this.getProvider(config);

            if (!provider) {
                res.status(400).send({ message: 'No supported subscription provider configured.' });
                return;
            }

            // Create/Get User
            const user = await this.userController.create({ name: NAME, email: EMAIL, phone: MOBILE_NO } as NPUser);

            const subId = 'sub_' + Utils.makeid(14);
            const subData: NPSubscription = {
                id: subId,
                planid: plan.id,
                cusid: user.id,
                status: 'CREATED',
                clientid: rawClientId,
                returnurl: rawReturnUrl || '',
                webhookurl: rawWebhookUrl || '',
                extra: (req.body.EXTRA || ''),
                state: req.body.STATE || '',
                createdat: Date.now(),
                updatedat: Date.now(),
            };

            // Call Gateway
            try {
                const { id: gateway_sub_id, url: short_url } = await provider.createSubscription(subData, plan, config);
                subData.gatewaysubscriptionid = gateway_sub_id;
                subData.shorturl = short_url;
            } catch (gwErr: any) {
                console.error("Gateway Sub Error:", gwErr);
                res.status(500).send({ message: 'Failed to initialize subscription on gateway', error: gwErr?.message });
                return;
            }

            await this.db.insert(this.tableNames.SUBSCRIPTION, subData);

            const responseData = {
                ...subData,
                orderid: subData.id,
                orderId: subData.id,
                payurl: config.host_url + '/' + config.path_prefix + '/sub/checkout/' + subData.id,
                pname: PRODUCT_NAME || plan.name,
                amount: plan.amount,
                name: user.name,
                email: user.email,
                phone: user.phone
            };

            if (req.headers.accept?.includes('application/json') || req.path.includes('/createTxn')) {
                res.status(201).send(responseData);
            } else if (subData.shorturl) {
                res.redirect(config.host_url + '/' + config.path_prefix + '/sub/checkout/' + subData.id);
            } else {
                res.status(201).send(responseData); // fallback
            }

        } catch (err: any) {
            console.error("Init Sub Error:", err);
            res.status(500).send({ message: 'Internal server error', error: err?.message });
        }
    }

    async checkoutSubscription(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id;
            const sub = await this.db.getOne(this.tableNames.SUBSCRIPTION, { id }) as NPSubscription;
            if (!sub || !sub.gatewaysubscriptionid) {
                res.status(404).send({ message: 'Subscription not found or not ready.' });
                return;
            }

            const [plan, user] = await Promise.all(
                [
                    this.db.getOne(this.tableNames.PLAN, { id: sub.planid }).catch(() => null),
                    this.db.getOne(this.tableNames.USER, { id: sub.cusid }).catch(() => null)
                ]
            ) as [NPPlan, NPUser];


            const config = withClientConfigOverrides(this.baseConfig, req, { clientId: sub.clientid } as any);

            const params = {
                ORDER_ID: sub.gatewaysubscriptionid,
                CALLBACK_URL: config.host_url + '/' + config.path_prefix + '/callback',
                NAME: user?.name || '',
                EMAIL: user?.email || '',
                MOBILE_NO: user?.phone || '',
                PRODUCT_NAME: plan?.name || ''
            };

            renderRazorpayCheckout(req, res, params, config, LoadingSVG, true);

        } catch (err: any) {
            res.status(500).send({ message: 'Error rendering checkout', error: err?.message });
        }
    }

    async getSubscription(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id;
            const sub = await this.db.getOne(this.tableNames.SUBSCRIPTION, { id }) as NPSubscription;
            if (!sub) {
                res.status(404).send({ message: 'Subscription not found' });
                return;
            }

            // Optionally sync from provider
            if (req.query.sync && sub.gatewaysubscriptionid) {
                const config = withClientConfigOverrides(this.baseConfig, req, { clientId: sub.clientid } as any);
                const provider = this.getProvider(config);
                if (provider) {
                    try {
                        const gwData = await provider.getSubscription(sub.gatewaysubscriptionid, config);
                        let newStatus = sub.status;

                        if (gwData.status === 'active') newStatus = 'ACTIVE';
                        else if (gwData.status === 'authenticated') newStatus = 'AUTHENTICATED';
                        else if (gwData.status === 'cancelled') newStatus = 'CANCELLED';
                        else if (gwData.status === 'completed') newStatus = 'COMPLETED';
                        else if (gwData.status === 'expired') newStatus = 'EXPIRED';
                        else if (gwData.status === 'pending' || gwData.status === 'halted') newStatus = 'HALTED';

                        if (newStatus !== sub.status) {
                            sub.status = newStatus;
                            sub.updatedat = Date.now();
                            await this.db.update(this.tableNames.SUBSCRIPTION, { id }, sub);
                        }
                    } catch (gwErr) {
                        console.error('Failed to sync sub status:', gwErr);
                    }
                }
            }

            res.send(sub);
        } catch (err: any) {
            res.status(500).send({ message: 'Error fetching subscription', error: err?.message });
        }
    }

    async getSubscriptions(req: Request, res: Response): Promise<void> {
        try {
            const clientId = req.query.clientid || req.query.clientId || req.query.client_id || req.headers['x-client-id'] || '';
            const userId = req.query.cusid || req.query.cusId || req.query.userId || req.query.user_id;
            const userEmail = req.query.email || req.query.userEmail || req.query.user_email;

            const query: any = {};
            if (clientId) {
                query.clientid = clientId;
            }

            if (userId) {
                query.cusid = userId;
            }

            if (userEmail) {
                const user = await this.db.getOne(this.tableNames.USER, { email: userEmail }).catch(() => null) as NPUser;
                if (user) {
                    query.cusid = user.id;
                } else {
                    res.send({ limit: 20, offset: 0, count: 0, subscriptions: [] });
                    return;
                }
            }

            const limit = Math.min(parseInt((req.query.limit as string), 10) || 20, 100);
            const offset = Math.max(parseInt((req.query.offset as string), 10) || 0, 0);

            const subs = await this.db.get(this.tableNames.SUBSCRIPTION, query, {
                sort: [{ field: 'createdat', order: 'desc' }],
                limit: limit, offset: offset
            });

            res.send({ limit, offset, count: subs.length, subscriptions: subs });
        } catch (err: any) {
            res.status(500).send({ message: 'Error fetching subscriptions', error: err?.message });
        }
    }

    async cancelSubscription(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id;
            const cancelAtCycleEnd = req.body.cancel_at_cycle_end === true || req.body.cancel_at_cycle_end === 'true';

            const sub = await this.db.getOne(this.tableNames.SUBSCRIPTION, { id }) as NPSubscription;
            if (!sub) {
                res.status(404).send({ message: 'Subscription not found' });
                return;
            }

            if (sub.status === 'CANCELLED' || sub.status === 'EXPIRED' || sub.status === 'COMPLETED') {
                res.status(400).send({ message: `Cannot cancel subscription in ${sub.status} state` });
                return;
            }

            const config = withClientConfigOverrides(this.baseConfig, req, { clientId: sub.clientid } as any);
            const provider = this.getProvider(config);

            if (provider && sub.gatewaysubscriptionid) {
                try {
                    await provider.cancelSubscription(sub.gatewaysubscriptionid, cancelAtCycleEnd, config);
                    if (!cancelAtCycleEnd) {
                        sub.status = 'CANCELLED';
                    }
                    sub.updatedat = Date.now();
                    await this.db.update(this.tableNames.SUBSCRIPTION, { id }, sub);

                    res.send({ message: 'Cancellation processed successfully', status: sub.status });
                } catch (gwErr: any) {
                    res.status(500).send({ message: 'Failed to cancel on gateway', error: gwErr?.message || gwErr });
                }
            } else {
                res.status(400).send({ message: 'No provider configured or missing gateway subscription ID' });
            }

        } catch (err: any) {
            res.status(500).send({ message: 'Error cancelling subscription', error: err?.message });
        }
    }

    async getSubscriptionPayments(req: Request, res: Response): Promise<void> {
        try {
            const id = req.params.id;
            const sub = await this.db.getOne(this.tableNames.SUBSCRIPTION, { id }) as NPSubscription;
            if (!sub) {
                res.status(404).send({ message: 'Subscription not found' });
                return;
            }

            const config = withClientConfigOverrides(this.baseConfig, req, { clientId: sub.clientid } as any);

            const limit = Math.min(parseInt((req.query.limit as string), 10) || 20, 100);
            const offset = Math.max(parseInt((req.query.offset as string), 10) || 0, 0);

            // Fetch transactions linked to this subscription
            const payments = await this.db.get(this.tableNames.TRANSACTION, { subscriptionid: id }, {
                sort: [{ field: 'time', order: 'desc' }],
                limit: limit, offset: offset
            });

            res.send({ limit, offset, count: payments.length, payments });
        } catch (err: any) {
            res.status(500).send({ message: 'Error fetching payments', error: err?.message });
        }
    }
}
