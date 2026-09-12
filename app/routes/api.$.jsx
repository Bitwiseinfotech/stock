import { authenticate } from "../shopify.server";

async function proxyToBackend(request, params) {
  let session = null;
  try {
    const auth = await authenticate.admin(request);
    session = auth.session;
  } catch {
    // If session is missing, continue gracefully
  }

  const primaryBackendUrl = process.env.BACKEND_URL || "http://127.0.0.1:5000";
  const requestUrl = new URL(request.url);

  const shop = requestUrl.searchParams.get("shop") || session?.shop || "";
  if (shop && !requestUrl.searchParams.has("shop")) {
    requestUrl.searchParams.set("shop", shop);
  }

  let token = session?.accessToken || "";
  if ((!token || token.startsWith("shpua_")) && shop) {
    try {
      const { sessionStorage } = await import("../shopify.server");
      const offlineId = `offline_${shop}`;
      const offlineSession = await sessionStorage.loadSession(offlineId);
      if (offlineSession?.accessToken) {
        token = offlineSession.accessToken;
      }
    } catch {
      // ignore
    }
  }

  const backendUrl = new URL(requestUrl.pathname, primaryBackendUrl);
  backendUrl.search = requestUrl.search;

  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Shop-Domain": shop,
    "X-Shopify-Access-Token": token || session?.accessToken || "",
  };

  let body = undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      body = await request.text();
    } catch {
      body = undefined;
    }
  }

  try {
    let backendResponse;
    try {
      backendResponse = await fetch(backendUrl.toString(), {
        method: request.method,
        headers,
        body,
      });
    } catch (primaryErr) {
      // Fallback: if 127.0.0.1 failed and no explicit BACKEND_URL was set, try localhost
      if (!process.env.BACKEND_URL) {
        const fallbackUrl = new URL(requestUrl.pathname, "http://localhost:5000");
        fallbackUrl.search = requestUrl.search;
        backendResponse = await fetch(fallbackUrl.toString(), {
          method: request.method,
          headers,
          body,
        });
      } else {
        throw primaryErr;
      }
    }

    const responseText = await backendResponse.text();

    return new Response(responseText, {
      status: backendResponse.status,
      headers: {
        "Content-Type": backendResponse.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    console.error("Global API Proxy Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Unable to connect to Express backend server.",
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export const loader = async ({ request, params }) => {
  return proxyToBackend(request, params);
};

export const action = async ({ request, params }) => {
  return proxyToBackend(request, params);
};
