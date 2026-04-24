export const PLAN_LIMITS = {
  FREE:     { uploadsPerMonth: 3, bulk: false, history: false, budget: false, excel: false, audit: false },
  PRO:      { uploadsPerMonth: null, bulk: false, history: true, budget: true, excel: true, audit: true },
  BUSINESS: { uploadsPerMonth: null, bulk: true,  history: true, budget: true, excel: true, audit: true },
};

export function getLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;
}

export function canUploadThisMonth(plan, monthlyUploads) {
  const limits = getLimits(plan);
  if (limits.uploadsPerMonth === null) return true;
  return monthlyUploads < limits.uploadsPerMonth;
}
