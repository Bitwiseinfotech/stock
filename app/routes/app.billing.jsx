import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import BillingPlans from "../../src/pages/Billing/BillingPlans";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const searchParams = Object.fromEntries(url.searchParams);
  return {
    shop: session?.shop || searchParams.shop || "",
    searchParams,
  };
};

export default function BillingRoute() {
  const { shop, searchParams } = useLoaderData();
  return <BillingPlans shopDomain={shop} initialParams={searchParams} />;
}
