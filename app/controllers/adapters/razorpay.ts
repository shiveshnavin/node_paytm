import RazorPay from 'razorpay';
import { ISubscriptionProvider } from './interfaces';
import { NPConfig, NPPlan, NPSubscription } from '../../models';

/**
 * Only used for subscriptions for now
 */
export class RazorpayAdapter implements ISubscriptionProvider {

    private getInstance(config: NPConfig) {
        return new RazorPay({
            key_id: config.KEY,
            key_secret: config.SECRET
        });
    }

    async createPlan(plan: NPPlan, config: NPConfig): Promise<string> {
        const instance = this.getInstance(config);

        const payload = {
            period: plan.period,
            interval: plan.interval,
            item: {
                name: plan.name,
                description: plan.description || plan.name,
                amount: plan.amount * 100, // Razorpay takes amount in smallest currency unit (paise)
                currency: plan.currency || 'INR'
            }
        };

        const result = await instance.plans.create(payload);
        return result.id;
    }

    async createSubscription(sub: NPSubscription, plan: NPPlan, config: NPConfig): Promise<{ id: string, url: string }> {
        const instance = this.getInstance(config);

        const payload: any = {
            plan_id: plan.gateway_plan_id,
            total_count: 120, // A reasonably large default total count to act as 'perpetual' unless overwritten, can be customized later
            customer_notify: 1 // Let razorpay handle links
        };

        // Trial Period Implementation
        if (plan.trial_days && plan.trial_days > 0) {
            // start_at should be a unix timestamp (in seconds)
            const trialEndTimestamp = Math.floor(Date.now() / 1000) + (plan.trial_days * 24 * 60 * 60);
            payload.start_at = trialEndTimestamp;
        }

        const result = await instance.subscriptions.create(payload);

        return {
            id: result.id,
            url: result.short_url
        };
    }

    async getSubscription(gatewayId: string, config: NPConfig): Promise<any> {
        const instance = this.getInstance(config);
        return await instance.subscriptions.fetch(gatewayId);
    }

    async cancelSubscription(gatewayId: string, cancelAtCycleEnd: boolean, config: NPConfig): Promise<any> {
        const instance = this.getInstance(config);
        return await instance.subscriptions.cancel(gatewayId, cancelAtCycleEnd);
    }

    async getOrder(orderId: string, config: NPConfig): Promise<any> {
        const instance = this.getInstance(config);
        return await instance.orders.fetch(orderId);
    }

    async validateWebhookSignature(reqBody: string, signature: string, secret: string, jsonBody: any, clientConfig: NPConfig): Promise<boolean> {
        try {
            return RazorPay.validateWebhookSignature(reqBody, signature, secret);
        } catch (e) {
            if (clientConfig && jsonBody && jsonBody.payload && jsonBody.payload.payment && jsonBody.payload.payment.entity) {
                let orderId = jsonBody?.payload?.payment?.entity?.order_id;
                let captureStatusClaimed = jsonBody?.payload?.payment?.entity?.status;
                console.log("Error validating Razorpay signature:", e);
                if (orderId) {
                    console.log("Attempting fallback validation method using GET Order", orderId);
                    try {
                        const orderDetails = await this.getOrder(orderId, { KEY: '', SECRET: secret } as NPConfig);
                        if (orderDetails && orderDetails.id === orderId && orderDetails.status === captureStatusClaimed) {
                            console.log("Fallback validation successful for order:", orderId);
                            return true;
                        } else {
                            console.log("Fallback validation failed: Order details do not match for order:", orderId, "Order details:", orderDetails);
                        }
                    } catch (e) {
                        console.log("Error in fallback validation:", e);
                    }
                }
            }
            return false;
        }
    }
}
