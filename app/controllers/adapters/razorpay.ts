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
}
