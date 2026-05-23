import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Plan, SubscriptionStatus } from '@prisma/client';
import {
  REQUIRED_FEATURE_KEY,
  REQUIRED_PLAN_KEY,
} from '../decorators/subscription.decorator';

const planRank: Record<Plan, number> = {
  [Plan.FREE]: 0,
  [Plan.PRO]: 1,
  [Plan.ENTERPRISE]: 2,
};

const featureMinimumPlan: Record<string, Plan> = {
  API_KEYS: Plan.PRO,
  ANALYTICS: Plan.PRO,
  WEBHOOKS: Plan.ENTERPRISE,
};

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredPlan = this.reflector.getAllAndOverride<Plan>(
      REQUIRED_PLAN_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredFeature = this.reflector.getAllAndOverride<string>(
      REQUIRED_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPlan && !requiredFeature) return true;

    const request = context.switchToHttp().getRequest();
    const tenant = request.tenant;

    if (!tenant || !this.hasValidSubscription(tenant)) {
      throw new ForbiddenException('Active subscription required');
    }

    const minimumPlan =
      requiredPlan ??
      featureMinimumPlan[requiredFeature?.toUpperCase() ?? ''] ??
      Plan.ENTERPRISE;

    if (planRank[tenant.plan] < planRank[minimumPlan]) {
      throw new ForbiddenException('Tenant plan does not allow this feature');
    }

    return true;
  }

  private hasValidSubscription(tenant: {
    subscriptionStatus: SubscriptionStatus;
    trialEndsAt?: Date | null;
    currentPeriodEndsAt?: Date | null;
  }) {
    const now = new Date();

    if (tenant.subscriptionStatus === SubscriptionStatus.ACTIVE) {
      return (
        !tenant.currentPeriodEndsAt ||
        tenant.currentPeriodEndsAt.getTime() > now.getTime()
      );
    }

    if (tenant.subscriptionStatus === SubscriptionStatus.TRIALING) {
      return (
        !tenant.trialEndsAt || tenant.trialEndsAt.getTime() > now.getTime()
      );
    }

    return false;
  }
}
