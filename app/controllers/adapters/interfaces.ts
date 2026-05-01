import { NPConfig, NPPlan, NPSubscription } from "../../models";

export interface ISubscriptionProvider {
    createPlan(plan: NPPlan, config: NPConfig): Promise<string>;
    createSubscription(sub: NPSubscription, plan: NPPlan, config: NPConfig): Promise<{ id: string, url: string }>;
    getSubscription(gatewayId: string, config: NPConfig): Promise<any>;
    cancelSubscription(gatewayId: string, cancelAtCycleEnd: boolean, config: NPConfig): Promise<any>;
}
