export function getPublicAppUrl() {
  return (process.env.PUBLIC_APP_URL ?? 'http://localhost:3000').replace(
    /\/+$/,
    '',
  );
}

export function buildTenantQrUrl(tenantSlug: string) {
  return `${getPublicAppUrl()}/t/${tenantSlug}`;
}

export function buildTableQrUrl(tenantSlug: string, tableCode: string) {
  return `${buildTenantQrUrl(tenantSlug)}/table/${tableCode}`;
}
