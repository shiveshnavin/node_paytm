import { MultiDbORM } from 'multi-db-orm';
import { Request, Response } from 'express';
import { NPConfig, NPPlan, NPSubscription, NPTableNames, NPTransaction, NPUser } from '../models';
import { withClientConfigOverrides } from '../utils/buildConfig';
import { ISubscriptionProvider } from './adapters/interfaces';
import { RazorpayAdapter } from './adapters/razorpay';
import { NPUserController } from './user.controller';
import { Utils } from '../utils/utils';

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
            id: 'plan_sample',
            name: 'Sample Plan',
            description: 'Sample Plan',
            amount: 100,
            currency: 'INR',
            period: 'monthly',
            interval: 1,
            clientId: 'client_1',
            gateway_plan_id: 'gw_plan_sample'
        };
        const subSample: NPSubscription = {
            id: 'sub_sample',
            planId: 'plan_sample',
            cusId: 'user_sample',
            status: 'CREATED',
            clientId: 'client_1',
            gateway_subscription_id: 'gw_sub_sample'
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

            const { id, name, description, amount, currency, period, interval, trial_days, clientId } = req.body;

            if (!id || !name || !amount || !period || !interval) {
                res.status(400).send({ message: 'Missing required fields: id, name, amount, period, interval' });
                return;
            }

            // Check if plan already exists locally
            const existingPlan = await this.db.getOne(this.tableNames.PLAN, { id });
            if (existingPlan) {
                res.status(409).send({ message: 'Plan ID already exists locally.' });
                return;
            }

            const planData: NPPlan = {
                id, name, description, amount: parseFloat(amount),
                currency: currency || 'INR', period, interval: parseInt(interval, 10),
                trial_days: trial_days ? parseInt(trial_days, 10) : 0,
                clientId: clientId || req.query.client_id || '',
                createdAt: Date.now(), updatedAt: Date.now(), is_deleted: false
            };

            // Register plan with Gateway
            try {
                const gatewayPlanId = await provider.createPlan(planData, config);
                planData.gateway_plan_id = gatewayPlanId;
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
            const clientId = req.query.clientId || req.query.client_id || req.headers['x-client-id'] || '';
            const query: any = { is_deleted: false };
            if (clientId) {
                query.clientId = clientId;
            }
            
            const limit = Math.min(parseInt((req.query.limit as string), 10) || 20, 100);
            const offset = Math.max(parseInt((req.query.offset as string), 10) || 0, 0);

            const plans = await this.db.get(this.tableNames.PLAN, query, {
                sort: [{ field: 'createdAt', order: 'desc' }],
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
            const plan = await this.db.getOne(this.tableNames.PLAN, { id, is_deleted: false });
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
            const plan = await this.db.getOne(this.tableNames.PLAN, { id, is_deleted: false }) as NPPlan;
            
            if (!plan) {
                res.status(404).send({ message: 'Plan not found' });
                return;
            }

            const { name, description, amount, interval, period } = req.body;
            
            // Check if Gateway immutable fields are changing
            let needsNewGatewayPlan = false;
            if (
                (amount !== undefined && parseFloat(amount) !== plan.amount) ||
                (interval !== undefined && parseInt(interval, 10) !== plan.interval) ||
                (period !== undefined && period !== plan.period)
            ) {
                needsNewGatewayPlan = true;
            }

            const updatedPlan: NPPlan = { ...plan, updatedAt: Date.now() };
            if (name !== undefined) updatedPlan.name = name;
            if (description !== undefined) updatedPlan.description = description;
            if (amount !== undefined) updatedPlan.amount = parseFloat(amount);
            if (interval !== undefined) updatedPlan.interval = parseInt(interval, 10);
            if (period !== undefined) updatedPlan.period = period;

            if (needsNewGatewayPlan) {
                 const config = withClientConfigOverrides(this.baseConfig, req);
                 const provider = this.getProvider(config);
                 if (provider) {
                    try {
                        const newGatewayId = await provider.createPlan(updatedPlan, config);
                        updatedPlan.gateway_plan_id = newGatewayId;
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
            await this.db.update(this.tableNames.PLAN, { id }, { ...plan, is_deleted: true, updatedAt: Date.now() });
            res.send({ message: 'Plan deleted successfully', id });
        } catch (err: any) {
            res.status(500).send({ message: 'Error deleting plan', error: err?.message });
        }
    }


    // --- SUBSCRIPTION MANAGEMENT ---

    async initSubscription(req: Request, res: Response): Promise<void> {
        try {
            const { planId, returnUrl, webhookUrl, NAME, EMAIL, MOBILE_NO, CLIENT_ID } = req.body;

            if (!planId || !NAME || !EMAIL) {
                res.status(400).send({ message: 'Missing required fields: planId, NAME, EMAIL' });
                return;
            }

            const plan = await this.db.getOne(this.tableNames.PLAN, { id: planId, is_deleted: false }) as NPPlan;
            if (!plan || !plan.gateway_plan_id) {
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
                planId: plan.id,
                cusId: user.id,
                status: 'CREATED',
                clientId: CLIENT_ID || req.query.client_id || '',
                returnUrl: returnUrl || '',
                webhookUrl: webhookUrl || '',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            // Call Gateway
            try {
                const { id: gateway_sub_id, url: short_url } = await provider.createSubscription(subData, plan, config);
                subData.gateway_subscription_id = gateway_sub_id;
                subData.short_url = short_url;
            } catch (gwErr: any) {
                 console.error("Gateway Sub Error:", gwErr);
                 res.status(500).send({ message: 'Failed to initialize subscription on gateway', error: gwErr?.message });
                 return;
            }

            await this.db.insert(this.tableNames.SUBSCRIPTION, subData);

            if (req.headers.accept?.includes('application/json')) {
                res.status(201).send(subData);
            } else if (subData.short_url) {
                res.redirect(subData.short_url);
            } else {
                 res.status(201).send(subData); // fallback
            }

        } catch (err: any) {
             console.error("Init Sub Error:", err);
             res.status(500).send({ message: 'Internal server error', error: err?.message });
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
            if (req.query.sync && sub.gateway_subscription_id) {
                const config = withClientConfigOverrides(this.baseConfig, req);
                const provider = this.getProvider(config);
                if (provider) {
                    try {
                        const gwData = await provider.getSubscription(sub.gateway_subscription_id, config);
                        let newStatus = sub.status;
                        
                        if (gwData.status === 'active') newStatus = 'ACTIVE';
                        else if (gwData.status === 'authenticated') newStatus = 'AUTHENTICATED';
                        else if (gwData.status === 'cancelled') newStatus = 'CANCELLED';
                        else if (gwData.status === 'completed') newStatus = 'COMPLETED';
                        else if (gwData.status === 'expired') newStatus = 'EXPIRED';
                        else if (gwData.status === 'pending' || gwData.status === 'halted') newStatus = 'HALTED';

                        if (newStatus !== sub.status) {
                            sub.status = newStatus;
                            sub.updatedAt = Date.now();
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

            const config = withClientConfigOverrides(this.baseConfig, req);
            const provider = this.getProvider(config);

            if (provider && sub.gateway_subscription_id) {
                try {
                     await provider.cancelSubscription(sub.gateway_subscription_id, cancelAtCycleEnd, config);
                     if (!cancelAtCycleEnd) {
                         sub.status = 'CANCELLED';
                     }
                     sub.updatedAt = Date.now();
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

            const limit = Math.min(parseInt((req.query.limit as string), 10) || 20, 100);
            const offset = Math.max(parseInt((req.query.offset as string), 10) || 0, 0);

            // Fetch transactions linked to this subscription
            const payments = await this.db.get(this.tableNames.TRANSACTION, { subscriptionId: id }, {
                sort: [{ field: 'time', order: 'desc' }],
                limit: limit, offset: offset
            });

            res.send({ limit, offset, count: payments.length, payments });
        } catch (err: any) {
             res.status(500).send({ message: 'Error fetching payments', error: err?.message });
        }
    }
}
