import { SetMetadata } from '@nestjs/common';
import { Plan } from '@prisma/client';

export const REQUIRED_PLAN_KEY = 'requiredPlan';
export const REQUIRED_FEATURE_KEY = 'requiredFeature';

export const RequiredPlan = (plan: Plan) =>
  SetMetadata(REQUIRED_PLAN_KEY, plan);

export const RequiredFeature = (feature: string) =>
  SetMetadata(REQUIRED_FEATURE_KEY, feature);
