import { Request, Response } from 'express';
import RazorPay from 'razorpay';
import axios from 'axios';
import { MultiDbORM } from 'multi-db-orm';
import { NPConfig, NPTableNames, NPTransaction, NPPlan, NPUser, NPSubscription } from '../models';
import { withClientConfigOverrides } from '../utils/buildConfig';
import { RazorpayAdapter } from './adapters/razorpay';

export async function handleSubscriptionWebhook(
    req: Request,
    res: Response,
    db: MultiDbORM,
    baseConfig: NPConfig,
    tableNames: NPTableNames,
    makeid: (length: number) => string
): Promise<void> {
    const event = req.body.event;
    const config = withClientConfigOverrides(baseConfig, req);

    if (req.body.payload && req.body.payload.subscription && req.body.payload.subscription.entity) {
        const subEntity = req.body.payload.subscription.entity;
        const paymentEntity = req.body.payload.payment?.entity;
        const gateway_subscription_id = subEntity.id;

        const reqBody = (req as any).rawBody;
        const jsonBody = req.body;
        const signature = req.headers["x-razorpay-signature"];
        if (signature === undefined) {
            res.status(200).send({ message: "Missing Razorpay signature" });
            return;
        }

        // Find the local subscription
        const sub = await db.getOne(tableNames.SUBSCRIPTION, { gatewaysubscriptionid: gateway_subscription_id }) as NPSubscription;
        if (!sub) {
            console.log("Subscription not found for webhook:", gateway_subscription_id);
            res.status(200).send({ message: "Subscription not found locally" });
            return;
        }

        const clientConf = withClientConfigOverrides(baseConfig, req, { clientId: sub.clientid } as any);
        const razorPayInstance = new RazorpayAdapter();

        let signatureValid;
        try {
            signatureValid = await razorPayInstance.validateWebhookSignature(reqBody, signature as string, config.SECRET, jsonBody, clientConf);
        } catch (e) {
            signatureValid = false;
        }

        if (!signatureValid) {
            res.status(200).send({ message: "Invalid Rzpay signature" });
            return;
        }

        let statusChanged = false;

        // Map Razorpay events to local subscription status
        switch (event) {
            case "subscription.authenticated":
                sub.status = 'AUTHENTICATED';
                statusChanged = true;

                // Trigger Setup Success Webhook
                const planAuth = await db.getOne(tableNames.PLAN, { id: sub.planid }).catch(() => null) as NPPlan;
                const userAuth = await db.getOne(tableNames.USER, { id: sub.cusid }).catch(() => null) as NPUser;
                const authTxn: NPTransaction = {
                    id: sub.id,
                    orderid: sub.id,
                    cusid: sub.cusid,
                    time: Date.now(),
                    status: 'TXN_SUCCESS',
                    name: userAuth?.name || '',
                    email: userAuth?.email || '',
                    phone: userAuth?.phone || '',
                    amount: planAuth?.amount || 0,
                    pname: planAuth?.name || 'Subscription Authentication',
                    extra: JSON.stringify(subEntity),
                    txnid: paymentEntity?.id || '',
                    state: sub.state,
                    clientid: sub.clientid,
                    returnurl: sub.returnurl || '',
                    webhookurl: sub.webhookurl || '',
                    issubscription: true,
                    subscriptionid: sub.id
                };

                // Persist if doesn't exist
                const existingAuth = await db.getOne(tableNames.TRANSACTION, { orderid: sub.id }).catch(() => null);
                if (!existingAuth) {
                    await db.insert(tableNames.TRANSACTION, authTxn);
                } else {
                    await db.update(tableNames.TRANSACTION, { orderid: sub.id }, {
                        ...existingAuth,
                        ...authTxn
                    });
                }

                if (sub.webhookurl) {
                    try { await axios.post(sub.webhookurl, authTxn); } catch (e) { }
                }
                break;
            case "subscription.activated":
            case "subscription.resumed":
            case "subscription.updated": // An update might make it active again or just change metadata
                if (subEntity.status === 'active') {
                    sub.status = 'ACTIVE';
                    statusChanged = true;
                }
                break;
            case "subscription.paused":
                sub.status = 'PAUSED';
                statusChanged = true;
                break;
            case "subscription.pending":
                sub.status = 'PENDING';
                statusChanged = true;
                break;
            case "subscription.halted":
                sub.status = 'HALTED';
                statusChanged = true;
                break;
            case "subscription.cancelled":
                sub.status = 'CANCELLED';
                statusChanged = true;
                break;
            case "subscription.completed":
                sub.status = 'COMPLETED';
                statusChanged = true;
                break;
        }

        if (statusChanged) {
            sub.updatedat = Date.now();
            await db.update(tableNames.SUBSCRIPTION, { id: sub.id }, sub);
        }

        // Trigger client payment webhook ONLY on actual charges or definitive failures
        if (event === "subscription.charged" && paymentEntity) {
            sub.status = 'ACTIVE';
            await db.update(tableNames.SUBSCRIPTION, { id: sub.id }, sub);

            const [plan, user] = await Promise.all(
                [
                    db.getOne(tableNames.PLAN, { id: sub.planid }).catch(() => null),
                    db.getOne(tableNames.USER, { id: sub.cusid }).catch(() => null)
                ]
            ) as [NPPlan, NPUser];
            // Create a new transaction record for this specific charge
            const txnId = paymentEntity.order_id || ('order_' + makeid(10));
            const newTxn: NPTransaction = {
                id: txnId,
                orderid: txnId, // Use txnId as orderId for recurring payments since there is no explicit user-created order
                cusid: sub.cusid,
                time: Date.now(),
                status: 'TXN_SUCCESS',
                name: user?.name || '',
                email: user?.email || paymentEntity.email || '',
                phone: user?.phone || paymentEntity.contact || '',
                amount: paymentEntity.amount / 100,
                pname: plan?.name || 'Subscription Charge',
                extra: JSON.stringify(paymentEntity),
                state: sub.state,
                txnid: paymentEntity.id,
                clientid: sub.clientid,
                returnurl: sub.returnurl || '',
                webhookurl: sub.webhookurl || '',
                issubscription: true,
                subscriptionid: sub.id
            };

            await db.insert(tableNames.TRANSACTION, newTxn);

            // Trigger client webhook
            if (sub.webhookurl) {
                try {
                    await axios.post(sub.webhookurl, newTxn);
                    console.log("Sent subscription webhook to ", sub.webhookurl, 'txnId:', paymentEntity.id);
                } catch (e: any) {
                    console.log("Error sending subscription webhook to ", sub.webhookurl, e?.message || e);
                }
            }
        } else if (event === "subscription.halted") {
            const [plan, user] = await Promise.all(
                [
                    db.getOne(tableNames.PLAN, { id: sub.planid }).catch(() => null),
                    db.getOne(tableNames.USER, { id: sub.cusid }).catch(() => null)
                ]
            ) as [NPPlan, NPUser];

            // Optional: Inform client of a failed recurring payment that led to a halt
            const txnId = 'txn_' + makeid(10);
            const newTxn: NPTransaction = {
                id: txnId,
                orderid: txnId,
                cusid: sub.cusid,
                time: Date.now(),
                status: 'TXN_FAILURE',
                name: user?.name || '',
                email: user?.email || '',
                phone: user?.phone || '',
                amount: plan?.amount || 0,
                pname: plan?.name ? `${plan.name} (Halted)` : 'Subscription Halted',
                extra: JSON.stringify(subEntity),
                txnid: '',
                state: sub.state,
                clientid: sub.clientid,
                returnurl: sub.returnurl || '',
                webhookurl: sub.webhookurl || '',
                issubscription: true,
                subscriptionid: sub.id
            };
            await db.insert(tableNames.TRANSACTION, newTxn);
            if (sub.webhookurl) {
                try {
                    await axios.post(sub.webhookurl, newTxn);
                } catch (e: any) { }
            }
        }
        res.status(200).send({ message: "Subscription webhook processed" });
        return;
    }
}
