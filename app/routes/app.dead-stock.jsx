import { useLoaderData, useLocation, Outlet } from "react-router";
import { authenticate, sessionStorage } from "../shopify.server";
import DeadStock from "../../src/pages/DeadStock/DeadStock";

const GET_STORE_PRODUCTS_QUERY = `
  query GetStoreProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        id
        title
        handle
        status
        createdAt
        updatedAt
        totalInventory 
        featuredImage { url altText }
        variants(first: 250) {
          nodes {
            id
            title
            sku
            price
            createdAt
            updatedAt
            inventoryQuantity
            inventoryItem {
              unitCost { amount currencyCode }
            }
          }
          pageInfo { hasNextPage }
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// SSR Loader — runs on the server, provides initial page data.
// ─────────────────────────────────────────────────────────────────────────────
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session?.shop || "";

  let token = session?.accessToken || "";
  try {
    const offlineSession = await sessionStorage.loadSession(`offline_${shop}`);
    if (offlineSession?.accessToken) {
      token = offlineSession.accessToken;
    }
  } catch (err) {
    console.warn("[DeadStock SSR] Error loading offline session:", err.message);
  }

  const backendBaseUrl = process.env.BACKEND_URL || "http://localhost:5000";

  let initialSummary = { totalCashTiedUp: 0, deadStockSkuCount: 0 };
  let initialProducts = [];
  let initialPagination = {
    limit: 50,
    hasNextPage: false,
    hasPreviousPage: false,
    nextCursor: null,
    previousCursor: null,
    totalItems: null,
    totalPages: null,
  };

  const commonHeaders = {
    "Content-Type": "application/json",
    "X-Shopify-Shop-Domain": shop,
    "X-Shopify-Access-Token": token,
  };

  try {
    const [summaryRes, productsRes] = await Promise.all([
      fetch(
        `${backendBaseUrl}/api/dead-stock/summary?shop=${encodeURIComponent(shop)}`,
        { headers: commonHeaders }
      ).catch(() => null),
      fetch(
        `${backendBaseUrl}/api/dead-stock/store-products?shop=${encodeURIComponent(shop)}&limit=50`,
        { headers: commonHeaders }
      ).catch(() => null),
    ]);

    if (summaryRes && summaryRes.ok) {
      const summaryJson = await summaryRes.json().catch(() => ({}));
      if (summaryJson.success && summaryJson.data) {
        initialSummary = summaryJson.data;
      }
    }

    if (productsRes && productsRes.ok) {
      const productsJson = await productsRes.json().catch(() => ({}));
      if (productsJson.success) {
        initialProducts = productsJson.data || [];
        if (productsJson.pagination) {
          initialPagination = productsJson.pagination;
        }
      }
    } else if (admin) {
      // Fallback to admin.graphql directly if backend products request fails (e.g. 401)
      try {
        const response = await admin.graphql(GET_STORE_PRODUCTS_QUERY, {
          variables: { first: 50, after: null, query: "status:active" },
        });
        const result = await response.json();
        const connection = result?.data?.products;
        if (connection?.nodes) {
          const fallbackProducts = [];
          for (const product of connection.nodes) {
            const variants = product.variants?.nodes || [];
            if (variants.length === 0) {
              fallbackProducts.push({
                id: product.id,
                variantId: "",
                productId: product.id,
                productTitle: product.title,
                handle: product.handle,
                status: product.status,
                image: product.featuredImage?.url || null,
                sku: "",
                stock: 0,
                currentPrice: 0,
                unitCost: 0,
                cashTiedUp: 0,
                daysUnsold: 0,
                lastSoldAt: null,
                salesVelocity: 0,
                salesLast7Days: 0,
                salesLast30Days: 0,
                salesLast60Days: 0,
              });
              continue;
            }
            for (const variant of variants) {
              const currentPrice = Number(variant.price) || 0;
              const rawCost = variant.inventoryItem?.unitCost?.amount;
              const unitCost = rawCost != null && Number(rawCost) > 0 ? Number(rawCost) : currentPrice;
              let stock = variant.inventoryQuantity != null ? Number(variant.inventoryQuantity) : 0;
              if (isNaN(stock) || (stock === 0 && Number(product.totalInventory) > 0 && variants.length === 1)) {
                stock = Number(product.totalInventory) || 0;
              }
              const cashTiedUp = Number((stock * unitCost).toFixed(2));
              let daysUnsold = 0;
              const creationDate = variant.createdAt || product.createdAt;
              if (creationDate) {
                const diffMs = Date.now() - new Date(creationDate).getTime();
                daysUnsold = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
              }
              fallbackProducts.push({
                id: variant.id,
                variantId: variant.id,
                productId: product.id,
                title: variant.title !== "Default Title" ? `${product.title} - ${variant.title}` : product.title,
                productTitle: product.title,
                handle: product.handle,
                status: product.status,
                image: product.featuredImage?.url || null,
                sku: variant.sku || "",
                stock,
                currentPrice,
                unitCost,
                cashTiedUp,
                daysUnsold,
                lastSoldAt: null,
                salesVelocity: 0,
                salesLast7Days: 0,
                salesLast30Days: 0,
                salesLast60Days: 0,
              });
            }
          }
          initialProducts = fallbackProducts;
          initialPagination = {
            limit: 50,
            hasNextPage: connection.pageInfo?.hasNextPage || false,
            hasPreviousPage: connection.pageInfo?.hasPreviousPage || false,
            nextCursor: connection.pageInfo?.endCursor || null,
            previousCursor: connection.pageInfo?.startCursor || null,
            totalItems: null,
            totalPages: null,
          };
        }
      } catch (adminErr) {
        console.warn("[DeadStock SSR] Fallback admin.graphql error:", adminErr.message);
      }
    }
  } catch (err) {
    console.error("Dead Stock SSR Loader Error:", err.message);
  }

  return {
    shop,
    token,
    initialSummary,
    initialProducts,
    initialPagination,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Route component
//
// NESTED ROUTE HANDLING:
//   app.dead-stock.$variantId.jsx is a CHILD route of this file in React Router.
//   When on /app/dead-stock/:variantId, we must render <Outlet /> so the child
//   route (DeadStockProduct) can render. When on /app/dead-stock exactly,
//   we render the Dead Stock list.
// ─────────────────────────────────────────────────────────────────────────────
export default function DeadStockRoute() {
  const { shop, token, initialSummary, initialProducts, initialPagination } = useLoaderData();
  const location = useLocation();

  // Detect if a child route is active (URL has more path after /app/dead-stock)
  const isChildRoute =
    location.pathname !== "/app/dead-stock" &&
    location.pathname !== "/app/dead-stock/";

  if (isChildRoute) {
    // Render the child route (e.g. app.dead-stock.$variantId → DeadStockProduct)
    return <Outlet />;
  }

  return (
    <DeadStock
      shopDomain={shop}
      shopToken={token}
      initialSummary={initialSummary}
      initialProducts={initialProducts}
      initialPagination={initialPagination}
    />
  );
}