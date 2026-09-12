import { authenticate, sessionStorage } from "../shopify.server";

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

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session?.shop || "";

  // 1. Try to load offline token from Prisma session storage
  let token = session?.accessToken || "";
  try {
    const offlineSession = await sessionStorage.loadSession(`offline_${shop}`);
    if (offlineSession?.accessToken) {
      token = offlineSession.accessToken;
    }
  } catch (err) {
    console.warn("[StoreProducts] Error loading offline session:", err.message);
  }

  const backendBaseUrl = process.env.BACKEND_URL || "http://localhost:5000";
  const requestUrl = new URL(request.url);

  if (!requestUrl.searchParams.has("shop") && shop) {
    requestUrl.searchParams.set("shop", shop);
  }

  const backendUrl = new URL("/api/dead-stock/store-products", backendBaseUrl);
  backendUrl.search = requestUrl.search;

  try {
    const backendResponse = await fetch(backendUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Shop-Domain": shop,
        "X-Shopify-Access-Token": token,
      },
    });

    if (backendResponse.ok) {
      const body = await backendResponse.text();
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": backendResponse.headers.get("content-type") || "application/json",
        },
      });
    }

    console.warn(`[StoreProducts] Backend returned status ${backendResponse.status}. Falling back to admin.graphql...`);
  } catch (err) {
    console.warn("[StoreProducts] Backend fetch failed:", err.message, "Falling back to admin.graphql...");
  }

  // 2. Authoritative fallback using admin.graphql
  try {
    const limit = Math.min(Math.max(Number(requestUrl.searchParams.get("limit")) || 50, 1), 250);
    const cursor = requestUrl.searchParams.get("cursor") || null;
    const rawSearch = String(requestUrl.searchParams.get("search") || "").trim().replace(/['"\\]/g, "");
    const shopifyQuery = rawSearch ? `title:*${rawSearch}*` : "status:active";

    const response = await admin.graphql(GET_STORE_PRODUCTS_QUERY, {
      variables: {
        first: limit,
        after: cursor,
        query: shopifyQuery,
      },
    });

    const result = await response.json();
    const connection = result?.data?.products;

    if (!connection) {
      return Response.json({
        success: false,
        message: "Failed to load products from Shopify.",
      }, { status: 500 });
    }

    // Attempt to load dead stock summary / docs from MongoDB backend
    let deadStockMap = new Map();
    try {
      const mongoRes = await fetch(`${backendBaseUrl}/api/dead-stock?shop=${encodeURIComponent(shop)}&limit=250`);
      if (mongoRes.ok) {
        const mongoJson = await mongoRes.json();
        if (mongoJson.data && Array.isArray(mongoJson.data)) {
          for (const item of mongoJson.data) {
            if (item.variantId) deadStockMap.set(String(item.variantId), item);
          }
        }
      }
    } catch (e) {
      // ignore MongoDB error during fallback
    }

    const products = [];
    for (const product of connection.nodes || []) {
      const variants = product.variants?.nodes || [];
      if (variants.length === 0) {
        products.push({
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
        const cleanVarId = String(variant.id).replace("gid://shopify/ProductVariant/", "");
        const deadStockDoc = deadStockMap.get(variant.id) || deadStockMap.get(cleanVarId);

        let stock = variant.inventoryQuantity != null ? Number(variant.inventoryQuantity) : (deadStockDoc?.stock || 0);
        if (isNaN(stock) || (stock === 0 && Number(product.totalInventory) > 0 && variants.length === 1)) {
          stock = Number(product.totalInventory) || 0;
        }

        const currentPrice = Number(variant.price) || 0;
        const rawCost = variant.inventoryItem?.unitCost?.amount;
        const unitCost = rawCost != null && Number(rawCost) > 0
          ? Number(rawCost)
          : (deadStockDoc?.costPrice && deadStockDoc.costPrice > 0 ? deadStockDoc.costPrice : currentPrice);

        const cashTiedUp = deadStockDoc?.cashTiedUp != null
          ? deadStockDoc.cashTiedUp
          : Number((stock * unitCost).toFixed(2));

        let daysUnsold = deadStockDoc?.daysUnsold;
        if (daysUnsold == null) {
          const creationDate = variant.createdAt || product.createdAt;
          if (creationDate) {
            const diffMs = Date.now() - new Date(creationDate).getTime();
            daysUnsold = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
          } else {
            daysUnsold = 0;
          }
        }

        products.push({
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
          lastSoldAt: deadStockDoc?.lastSoldAt || null,
          salesVelocity: deadStockDoc?.salesVelocity || 0,
          salesLast7Days: deadStockDoc?.salesLast7Days || 0,
          salesLast30Days: deadStockDoc?.salesLast30Days || 0,
          salesLast60Days: deadStockDoc?.salesLast60Days || 0,
        });
      }
    }

    return Response.json({
      success: true,
      data: products,
      pagination: {
        limit,
        hasNextPage: connection.pageInfo?.hasNextPage || false,
        hasPreviousPage: connection.pageInfo?.hasPreviousPage || false,
        nextCursor: connection.pageInfo?.endCursor || null,
        previousCursor: connection.pageInfo?.startCursor || null,
        totalItems: null,
        totalPages: null,
      },
      billing: {
        plan: "free",
        productLimit: 50,
      },
    });
  } catch (fallbackErr) {
    console.error("[StoreProducts] Fallback admin.graphql failed:", fallbackErr.message);
    return Response.json({
      success: false,
      message: fallbackErr.message || "Failed to load products from Shopify.",
    }, { status: 500 });
  }
};
