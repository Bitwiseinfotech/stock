(function () {
  "use strict";

  try {
    var origWarn = console.warn;
    if (origWarn && !console.__ss_silence_patched) {
      console.__ss_silence_patched = true;
      console.warn = function() {
        var msg = "";
        for (var i = 0; i < arguments.length; i++) {
          try {
            var it = arguments[i];
            msg += " " + (typeof it === "object" ? (it && it.message ? it.message : JSON.stringify(it)) : String(it));
          } catch (_) {
            msg += " " + String(arguments[i]);
          }
        }
        if (
          msg.indexOf("deprecated parameters") !== -1 ||
          msg.indexOf("initialization function") !== -1 ||
          msg.indexOf("pass a single object instead") !== -1 ||
          msg.indexOf("preloaded using link preload") !== -1
        ) {
          return;
        }
        return origWarn.apply(console, arguments);
      };
    }
  } catch (_) {}

  const config = window.SmartStockEmbedConfig;

  if (
    !config ||
    !config.shop ||
    !config.productId ||
    !config.variantId
  ) {
    return;
  }

  const state = {
    productId: String(config.productId),
    variantId: String(config.variantId),
  };


  /* =========================================================
     FORMAT MONEY
     ========================================================= */

  function formatMoney(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "";
    }

    const amount = Math.round(number * 100);

    if (
      window.Shopify &&
      typeof window.Shopify.formatMoney === "function"
    ) {
      return window.Shopify.formatMoney(
        amount,
        config.moneyFormat || "${{amount}}"
      );
    }

    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: config.currency || "USD",
    }).format(number);
  }


  /* =========================================================
     HTML ESCAPE
     ========================================================= */

  function escapeHtml(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  /* =========================================================
     REMOVE SMART STOCK ELEMENTS
     ========================================================= */

  function removeElements() {
    document
      .querySelectorAll(
        "[data-smart-stock-feature]"
      )
      .forEach((element) => {
        element.remove();
      });

    document
      .querySelectorAll('[data-smart-stock-price-display]')
      .forEach((el) => el.remove());

    document
      .querySelectorAll('[data-smart-stock-hidden-price]')
      .forEach((el) => {
        el.style.removeProperty("display");
        el.removeAttribute("data-smart-stock-hidden-price");
      });
  }


  /* =========================================================
     CREATE FEATURE
     ========================================================= */

  function createFeature(
    type,
    className
  ) {
    const element =
      document.createElement("div");

    element.dataset.smartStockFeature =
      type;

    element.className =
      "smart-stock-embed-feature " +
      className;

    return element;
  }


  /* =========================================================
     PRODUCT FORM
     ========================================================= */

  function getProductForm() {
    return (
      document.querySelector(
        'form[action*="/cart/add"]'
      ) ||
      document.querySelector(
        ".product-form"
      ) ||
      document.querySelector(
        "product-form"
      )
    );
  }


  /* =========================================================
     BUY IT NOW
     ========================================================= */

  function getBuyItNowButton(
    productForm
  ) {
    if (!productForm) {
      return null;
    }

    const paymentWrapper =
      productForm.querySelector(
        ".shopify-payment-button"
      );

    if (paymentWrapper) {
      return paymentWrapper;
    }

    const checkoutButton =
      productForm.querySelector(
        'button[name="checkout"], input[name="checkout"]'
      );

    if (checkoutButton) {
      return (
        checkoutButton.closest(
          ".shopify-payment-button"
        ) ||
        checkoutButton
      );
    }

    const dynamicCheckout =
      productForm.querySelector(
        ".dynamic-checkout__content"
      );

    if (dynamicCheckout) {
      return dynamicCheckout;
    }

    const buttons =
      productForm.querySelectorAll(
        "button, a, input[type='submit']"
      );

    for (
      const button of buttons
    ) {
      const text = (
        button.textContent ||
        button.value ||
        ""
      )
        .trim()
        .toLowerCase();

      if (
        text.includes("buy it now") ||
        text.includes("buy now") ||
        text.includes("checkout")
      ) {
        return (
          button.closest(
            ".shopify-payment-button"
          ) ||
          button
        );
      }
    }

    return null;
  }


  /* =========================================================
     INSERT BELOW BUY IT NOW
     ========================================================= */

  function insertBelowBuyItNow(
    element,
    productForm
  ) {
    const paymentWrapper =
      (productForm && productForm.querySelector(".shopify-payment-button")) ||
      document.querySelector(".shopify-payment-button");

    if (paymentWrapper && paymentWrapper.parentNode) {
      paymentWrapper.parentNode.insertBefore(
        element,
        paymentWrapper.nextSibling
      );
      return true;
    }

    const buttonsWrapper =
      (productForm &&
        productForm.querySelector(
          ".product-form__buttons, .product__buy-buttons, .product-form__payment-container"
        )) ||
      document.querySelector(
        ".product-form__buttons, .product__buy-buttons, .product-form__payment-container"
      );

    if (buttonsWrapper && buttonsWrapper.parentNode) {
      buttonsWrapper.parentNode.insertBefore(
        element,
        buttonsWrapper.nextSibling
      );
      return true;
    }

    const buyItNow =
      getBuyItNowButton(
        productForm
      );

    if (buyItNow && buyItNow.parentNode) {
      const target =
        buyItNow.closest(".shopify-payment-button") ||
        buyItNow.closest(".product-form__buttons") ||
        buyItNow;

      if (target.parentNode) {
        target.parentNode.insertBefore(
          element,
          target.nextSibling
        );
        return true;
      }
    }

    return false;
  }


  /* =========================================================
     FALLBACK AFTER ADD TO CART
     ========================================================= */

  function insertAfterAddToCart(
    element,
    productForm
  ) {
    const addButton =
      (productForm &&
        productForm.querySelector(
          'button[name="add"], button[type="submit"], .product-form__submit'
        )) ||
      document.querySelector(
        'button[name="add"], button[type="submit"], .product-form__submit'
      );

    if (!addButton || !addButton.parentNode) {
      return false;
    }

    const buttonsWrapper =
      addButton.closest(".product-form__buttons, .product__buy-buttons");

    const target = buttonsWrapper || addButton;

    if (!target.parentNode) {
      return false;
    }

    target.parentNode.insertBefore(
      element,
      target.nextSibling
    );

    return true;
  }


  /* =========================================================
     FINAL INSERT
     ========================================================= */

  function insertClearanceElement(element) {
    const productForm = getProductForm();

    if (insertBelowBuyItNow(element, productForm)) {
      return true;
    }

    if (insertAfterAddToCart(element, productForm)) {
      return true;
    }

    if (productForm && productForm.parentNode) {
      productForm.parentNode.insertBefore(element, productForm.nextSibling);
      return true;
    }

    const infoContainer = document.querySelector(
      ".product__info-container, .product__info-wrapper, .product-single__meta, .product-info, .product-details, .product__column-sticky, [data-section-type='product']"
    );
    if (infoContainer) {
      infoContainer.appendChild(element);
      return true;
    }

    const mainContainer = document.querySelector("main, #MainContent, .main-content");
    if (mainContainer) {
      mainContainer.appendChild(element);
      return true;
    }

    return false;
  }


  /* =========================================================
     CLEARANCE SALE
     ========================================================= */

  function renderSale(data) {
    const cfg =
      data &&
      data.clearanceConfig;

    const sale =
      data &&
      data.deadStockOffer;

    if (
      cfg &&
      cfg.enabled === false &&
      (!sale || !sale.hasClearance)
    ) {
      document
        .querySelectorAll(
          '[data-smart-stock-feature="clearance"]'
        )
        .forEach((element) => {
          element.remove();
        });
      restoreStorefrontProductPrice();
      return;
    }

    if (
      !sale ||
      !sale.hasClearance
    ) {
      document
        .querySelectorAll(
          '[data-smart-stock-feature="clearance"]'
        )
        .forEach((element) => {
          element.remove();
        });
      restoreStorefrontProductPrice();
      return;
    }

    document
      .querySelectorAll(
        '[data-smart-stock-feature="clearance"]'
      )
      .forEach((element) => {
        element.remove();
      });

    const element =
      createFeature(
        "clearance",
        "smart-stock-embed-clearance smart-stock-embed-inline"
      );

    const showIcon =
      cfg
        ? Boolean(cfg.showIcon)
        : true;

    const showSupp =
      cfg
        ? Boolean(
          cfg.showSupportingText
        )
        : true;

    const title =
      cfg?.badgeTitle ||
      "Clearance Sale";

    const supportingText =
      cfg?.limitedTimeText ||
      cfg?.supportingText ||
      "Limited time offer";

    const showPrice =
      cfg
        ? Boolean(cfg.showPrice)
        : true;

    const showSavings =
      cfg
        ? Boolean(cfg.showSavings)
        : true;

    const layout =
      cfg?.layout ||
      "horizontal";

    const alignment =
      cfg?.alignment ||
      "left";

    const discountPercent =
      Number(
        sale?.discountPercent ??
        sale?.discountValue ??
        cfg?.discountPercentage ??
        10
      );

    element.style.cssText = `
      box-sizing:border-box;
      display:flex;
      flex-direction:${layout === "stacked"
        ? "column"
        : "row"
      };
      align-items:${layout === "stacked"
        ? (
          alignment === "center"
            ? "center"
            : alignment === "right"
              ? "flex-end"
              : "flex-start"
        )
        : "center"
      };
      justify-content:space-between;
      text-align:${alignment};
      gap:8px;
      width:100%;
      max-width:100%;
      margin:8px 0 0 0;
      padding:
        ${cfg?.paddingTop ?? 6}px
        ${cfg?.paddingRight ?? 9}px
        ${cfg?.paddingBottom ?? 6}px
        ${cfg?.paddingLeft ?? 9}px;
      color:${cfg?.textColor || "#991B1B"};
      background-color:${cfg?.backgroundColor || "#FFF1F2"};
      border:1px solid ${cfg?.borderColor || "#FECACA"};
      border-radius:${cfg?.borderRadius ?? 6}px;
      font-family:${cfg?.fontFamily || "Arial"};
      font-size:${cfg?.fontSize || "12px"};
      font-weight:${cfg?.fontWeight || "600"};
      line-height:1.2;
      min-height:0;
    `;

    const leftHtml = `
      <div
        style="
          display:flex;
          align-items:center;
          gap:5px;
          min-width:0;
        "
      >

        ${showIcon
        ? `
              <span
                style="
                  font-size:13px;
                  line-height:1;
                  flex:0 0 auto;
                "
              >
                🏷️
              </span>
            `
        : ""
      }

        <div
          style="
            display:flex;
            flex-direction:column;
            min-width:0;
          "
        >

          <span
            style="
              font-weight:600;
              font-size:12px;
              color:${cfg?.textColor ||
      "#991B1B"
      };
            "
          >
            ${escapeHtml(title)}
          </span>

          ${showSupp &&
        layout === "stacked"
        ? `
                <span
                  style="
                    font-size:10px;
                    opacity:.8;
                  "
                >
                  ${escapeHtml(
          supportingText
        )}
                </span>
              `
        : ""
      }

        </div>

      </div>
    `;

    let rightHtml = `
      <span
        style="
          color:${cfg?.accentColor ||
      "#DC2626"
      };
          font-weight:700;
          font-size:12px;
          white-space:nowrap;
        "
      >
        🔥 ${discountPercent}% OFF
      </span>
    `;

    if (
      showSupp &&
      layout !== "stacked"
    ) {
      rightHtml += `
        <span
          style="
            font-size:10px;
            opacity:.8;
            color:${cfg?.textColor ||
        "#991B1B"
        };
            white-space:nowrap;
          "
        >
          ${escapeHtml(
          supportingText
        )}
        </span>
      `;
    }

    if (
      showPrice &&
      sale.originalPrice != null &&
      sale.salePrice != null
    ) {
      rightHtml += `
        <div
          style="
            display:flex;
            align-items:center;
            gap:4px;
            font-size:11px;
            white-space:nowrap;
          "
        >

          <span
            style="
              text-decoration:line-through;
              opacity:.65;
            "
          >
            ${formatMoney(
        sale.originalPrice
      )}
          </span>

          <strong
            style="
              color:${cfg?.accentColor ||
        "#DC2626"
        };
            "
          >
            ${formatMoney(
          sale.salePrice
        )}
          </strong>

        </div>
      `;
    }

    if (
      showSavings &&
      sale.savings != null
    ) {
      rightHtml += `
        <span
          style="
            font-size:10px;
            font-weight:700;
            color:${cfg?.accentColor ||
        "#DC2626"
        };
            white-space:nowrap;
          "
        >
          Save ${formatMoney(
          sale.savings
        )}
        </span>
      `;
    }

    element.innerHTML = `
      ${leftHtml}

      <div
        style="
          display:flex;
          flex-direction:column;
          align-items:flex-end;
          gap:2px;
          min-width:0;
        "
      >
        ${rightHtml}
      </div>
    `;

    insertClearanceElement(
      element
    );

    if (sale.originalPrice && sale.salePrice && sale.originalPrice > sale.salePrice) {
      updateStorefrontProductPrice(sale.originalPrice, sale.salePrice);
    }
  }


  /* =========================================================
     RESTORE STOREFRONT PRODUCT PRICE
     ========================================================= */

  function restoreStorefrontProductPrice() {
    try {
      const priceContainers = document.querySelectorAll(
        ".product__info-container .price, .product-single__meta .price, .product-info .price, .product__price, .price"
      );
      priceContainers.forEach((priceContainer) => {
        if (priceContainer.dataset.smartStockOriginalHtml) {
          priceContainer.innerHTML = priceContainer.dataset.smartStockOriginalHtml;
          delete priceContainer.dataset.smartStockOriginalHtml;
        }
        priceContainer.classList.remove("price--on-sale", "price--show-badge");
      });
    } catch (_) {}
  }

  /* =========================================================
     UPDATE TOP STOREFRONT PRICE ON SALE / DISCOUNT
     ========================================================= */

  function updateStorefrontProductPrice(originalPrice, salePrice) {
    if (!originalPrice || !salePrice || originalPrice <= salePrice) {
      restoreStorefrontProductPrice();
      return;
    }

    try {
      const priceContainers = document.querySelectorAll(
        ".product__info-container .price, .product-single__meta .price, .product-info .price, .product__price, .price"
      );

      priceContainers.forEach((priceContainer) => {
        if (!priceContainer.dataset.smartStockOriginalHtml) {
          priceContainer.dataset.smartStockOriginalHtml = priceContainer.innerHTML;
        }
        priceContainer.classList.add("price--on-sale", "price--show-badge");

        const salePriceFormatted = formatMoney(salePrice);
        const origPriceFormatted = formatMoney(originalPrice);

        // Dawn / Standard themes with .price__sale
        const regularItem = priceContainer.querySelector(".price__sale .price-item--regular, .price__sale s, s.price-item");
        const saleItem = priceContainer.querySelector(".price-item--sale, .price-item.price-item--sale, .price-item--last");

        if (regularItem) {
          regularItem.textContent = origPriceFormatted;
        }
        if (saleItem) {
          saleItem.textContent = salePriceFormatted;
        }

        // If only .price__regular is present, update its contents
        const regularContainer = priceContainer.querySelector(".price__regular");
        const saleContainer = priceContainer.querySelector(".price__sale");
        if (regularContainer && (!saleContainer || window.getComputedStyle(saleContainer).display === "none")) {
          regularContainer.innerHTML = `
            <s style="opacity:0.65; margin-right:8px; font-weight:normal;">${origPriceFormatted}</s>
            <strong style="color:#DC2626; font-weight:700;">${salePriceFormatted}</strong>
          `;
        }
      });
    } catch (e) {
      console.warn("[SmartStock] Error updating price container:", e);
    }
  }


  /* =========================================================
     BUNDLE UI
     ========================================================= */

  function renderBundle(data) {
    if (
      !data?.deadStockOffer?.hasBundle ||
      data?.bundleConfig?.enabled === false
    ) {
      document
        .querySelectorAll('[data-smart-stock-feature="bundle"]')
        .forEach((element) => {
          element.remove();
        });
      return;
    }

    document
      .querySelectorAll(
        '[data-smart-stock-feature="bundle"]'
      )
      .forEach((element) => {
        element.remove();
      });

    const bundleCfg = data.bundleConfig || {};
    const bundleInfo =
      data.deadStockOffer.bundle ||
      {};

    const bundleName =
      bundleInfo.bundleName ||
      data.deadStockOffer.bundleName ||
      "Frequently Bought Together";

    const discount =
      Number(
        bundleInfo.discountPercent ??
        data.deadStockOffer.bundleDiscountPercent ??
        15
      );

    const isBOGO =
      String(bundleInfo.offerType || "").trim().toUpperCase() === "BOGO";

    const headerIcon = isBOGO ? "🎁" : "";

    const headerTitle = isBOGO
      ? "Buy One Get One Free"
      : (bundleCfg.headerTitle || "Frequently Bought Together");

    const buttonLabel = isBOGO
      ? "Claim BOGO Offer"
      : (bundleCfg.buttonText || "Add Both to Cart");

    const companionLabel = isBOGO
      ? "🎁 Buy One Get One Free"
      : "Recommended companion";

    const showDiscountBadge = bundleCfg.showDiscountBadge !== false;
    const discountText = isBOGO ? "SAVE 100% OFF" : `Save ${escapeHtml(discount)}% OFF`;

    const badgeBgColor = bundleCfg.badgeColor || (isBOGO ? "#ECFDF5" : "#DCFCE7");
    const badgeTextColor = bundleCfg.badgeTextColor || (isBOGO ? "#059669" : "#15803D");
    const buttonBgColor = bundleCfg.buttonColor || "#111827";
    const buttonTextColor = bundleCfg.buttonTextColor || "#FFFFFF";
    const borderRadius = Number(bundleCfg.borderRadius) || 12;

    const pageProductTitle = document.querySelector('h1, .product__title, .product-title')?.innerText?.trim() || "";

    const isPlaceholderTitle = (str) => {
      if (!str || typeof str !== "string") return true;
      const s = str.trim().toLowerCase();
      return (
        s === "" ||
        s === "this product" ||
        s === "primary product" ||
        s === "recommended companion item" ||
        s === "recommended companion" ||
        s === "companion product" ||
        s === "recommended product" ||
        s === "product" ||
        s === "product unavailable"
      );
    };

    const deadStockTitle =
      (!isPlaceholderTitle(bundleInfo.deadStockTitle) ? bundleInfo.deadStockTitle : "") ||
      pageProductTitle ||
      bundleInfo.deadStockVariantTitle ||
      "Product unavailable";

    const companionTitle = isBOGO
      ? ((!isPlaceholderTitle(bundleInfo.freeProductTitle) ? bundleInfo.freeProductTitle : "") ||
         (!isPlaceholderTitle(bundleInfo.companionTitle) ? bundleInfo.companionTitle : "") ||
         bundleInfo.companionVariantTitle ||
         "Free Gift")
      : ((!isPlaceholderTitle(bundleInfo.companionTitle) ? bundleInfo.companionTitle : "") ||
         bundleInfo.companionVariantTitle ||
         "Product unavailable");

    const deadStockImage =
      bundleInfo.deadStockImage && !bundleInfo.deadStockImage.includes("placeholder-images-image_large.png")
        ? bundleInfo.deadStockImage
        : "";

    const companionImage = isBOGO
      ? ((bundleInfo.freeProductImage && !bundleInfo.freeProductImage.includes("placeholder-images-image_large.png"))
          ? bundleInfo.freeProductImage
          : (bundleInfo.companionImage && !bundleInfo.companionImage.includes("placeholder-images-image_large.png"))
          ? bundleInfo.companionImage
          : "")
      : (bundleInfo.companionImage && !bundleInfo.companionImage.includes("placeholder-images-image_large.png")
          ? bundleInfo.companionImage
          : "");

    // Individual product prices for per-item display
    const deadStockPrice = Number(bundleInfo.deadStockPrice || 0);
    const companionPrice = Number(bundleInfo.companionPrice || 0);

    const originalPrice =
      Number(
        bundleInfo.originalPrice || (deadStockPrice + companionPrice) || 0
      );

    const discountAmount = Number((originalPrice * (discount / 100)).toFixed(2));

    const bundlePrice =
      Number(
        bundleInfo.bundlePrice || (originalPrice > 0 ? originalPrice - discountAmount : 0)
      );

    const savings =
      Number(bundleInfo.savings || (originalPrice > bundlePrice ? originalPrice - bundlePrice : 0));

    const originalFormatted =
      originalPrice > 0
        ? formatMoney(originalPrice)
        : "";

    const bundleFormatted =
      bundlePrice > 0
        ? formatMoney(bundlePrice)
        : "Special Offer";

    const savingsFormatted =
      savings > 0
        ? formatMoney(savings)
        : "";

    const deadStockPriceFormatted = deadStockPrice > 0 ? formatMoney(deadStockPrice) : "";
    const companionPriceFormatted = companionPrice > 0 ? formatMoney(companionPrice) : "";

    // Shopify discount ID (automatic discount already created server-side for this bundle)
    const bundleShopifyDiscountId = bundleInfo.shopifyDiscountId || "";

    if (
      !companionTitle ||
      companionTitle === "Product unavailable" ||
      isPlaceholderTitle(companionTitle) ||
      !deadStockTitle ||
      deadStockTitle === "Product unavailable" ||
      isPlaceholderTitle(deadStockTitle)
    ) {
      return;
    }

    const element =
      createFeature(
        "bundle",
        "smart-stock-embed-bundle smart-stock-embed-inline"
      );

    element.style.borderRadius = `${borderRadius}px`;

    element.innerHTML = `

      <!-- HEADER -->

      <div class="smart-stock-bundle-header">

        <div class="smart-stock-bundle-heading">
          ${headerIcon ? `
          <div class="smart-stock-bundle-icon">
            ${headerIcon}
          </div>
          ` : ""}
          <div class="smart-stock-bundle-title">
            ${escapeHtml(headerTitle)}
          </div>
        </div>

        ${showDiscountBadge
        ? `
            <div class="smart-stock-bundle-discount ${isBOGO ? 'bogo-badge' : ''}" style="background:${badgeBgColor} !important; color:${badgeTextColor} !important; border:1px solid ${badgeBgColor} !important;">
              ${discountText}
            </div>
          `
        : ""
      }

      </div>


      <!-- SUBTITLE -->

      <div class="smart-stock-bundle-subtitle">
        ${escapeHtml(bundleName)}
      </div>


      <!-- PRODUCTS -->

      <div class="smart-stock-bundle-products">


        <!-- PRODUCT 1 -->

        <div class="smart-stock-bundle-product">

          <div class="smart-stock-bundle-check">
            ✓
          </div>

          ${deadStockImage
        ? `
                <img
                  class="smart-stock-bundle-image"
                  src="${escapeHtml(
          deadStockImage
        )}"
                  alt="${escapeHtml(
          deadStockTitle
        )}"
                  loading="lazy"
                />
              `
        : `
                <div
                  class="smart-stock-bundle-image"
                  style="
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:16px;
                  "
                >
                  📦
                </div>
              `
      }

          <div class="smart-stock-bundle-info">

            <span class="smart-stock-bundle-product-name">
              ${escapeHtml(
        deadStockTitle
      )}
            </span>

            <span class="smart-stock-bundle-product-label">
              Current item
            </span>

            ${!isBOGO && deadStockPriceFormatted ? `
              <span style="font-size:13px;font-weight:600;color:#374151;display:block;margin-top:3px;">
                ${escapeHtml(deadStockPriceFormatted)}
              </span>
            ` : ""}

          </div>

        </div>


        <!-- PLUS -->

        <div class="smart-stock-bundle-plus ${isBOGO ? 'smart-stock-bundle-bogo-plus' : ''}">
          <span>${isBOGO ? "+ GET 1 FREE" : "+"}</span>
        </div>


        <!-- PRODUCT 2 -->

        <div class="smart-stock-bundle-product">

          <div class="smart-stock-bundle-check" ${isBOGO ? 'style="background:#059669;"' : ''}>
            ✓
          </div>

          ${companionImage
        ? `
                <img
                  class="smart-stock-bundle-image"
                  src="${escapeHtml(
          companionImage
        )}"
                  alt="${escapeHtml(
          companionTitle
        )}"
                  loading="lazy"
                />
              `
        : `
                <div
                  class="smart-stock-bundle-image"
                  style="
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:16px;
                  "
                >
                  📦
                </div>
              `
      }

          <div class="smart-stock-bundle-info">

            <span class="smart-stock-bundle-product-name">
              ${escapeHtml(
        companionTitle
      )}
            </span>

            <span class="smart-stock-bundle-product-label recommended" ${isBOGO ? 'style="color:#059669;font-weight:700;font-size:13px;"' : ''}>
              ${escapeHtml(companionLabel)}
            </span>

            ${!isBOGO && companionPriceFormatted ? `
              <span style="font-size:13px;font-weight:600;color:#374151;display:block;margin-top:3px;">
                ${escapeHtml(companionPriceFormatted)}
              </span>
            ` : ""}

          </div>

        </div>

      </div>


      <!-- PRICE -->

      <div class="smart-stock-bundle-price">

        <div>

          <div class="smart-stock-bundle-price-label">
            Bundle price
          </div>

          <div class="smart-stock-bundle-price-main">

            <span class="smart-stock-bundle-price-current">
              ${bundleFormatted}
            </span>

            ${originalFormatted
        ? `
                  <span class="smart-stock-bundle-price-old">
                    ${originalFormatted}
                  </span>
                `
        : ""
      }

          </div>

        </div>


        ${savingsFormatted
        ? `
              <div class="smart-stock-bundle-saving" style="background:${badgeBgColor} !important; color:${badgeTextColor} !important;">
                Save ${savingsFormatted}
              </div>
            `
        : ""
      }

      </div>


      <!-- BUTTON -->

      <button
        type="button"
        class="smart-stock-buy-bundle-btn"
        style="background:${buttonBgColor} !important; color:${buttonTextColor} !important; border-radius:${Math.min(borderRadius, 8)}px !important;"
      >

        <span>
          ⚡
        </span>

        <span>
          ${escapeHtml(buttonLabel)}
          ${bundlePrice > 0
        ? ` · ${bundleFormatted}`
        : ""
      }
        </span>

      </button>
    `;


    /* =======================================================
       BUTTON
       ======================================================= */

    const button =
      element.querySelector(
        ".smart-stock-buy-bundle-btn"
      );

    if (!button) {
      return;
    }


    /* =======================================================
       ADD TO CART (LIVE CART-AWARE SYNC)
       ======================================================= */

    button.addEventListener(
      "click",
      async function () {
        const originalButtonHTML = button.innerHTML;
        button.disabled = true;

        button.innerHTML = `
          <span
            style="
              display:inline-block;
              width:14px;
              height:14px;
              border:2px solid rgba(255,255,255,.5);
              border-top-color:#fff;
              border-radius:50%;
              animation:smartStockSpin .7s linear infinite;
            "
          ></span>
          <span>Adding bundle...</span>
        `;

        try {
          // 1. Resolve Target Bundle Variant IDs
          const var1Raw =
            bundleInfo.deadStockVariantId || state.variantId || "";
          const var2Raw =
            bundleInfo.companionVariantId || "";

          const cleanVar1 = Number(
            String(var1Raw).replace(/\D/g, "")
          );
          const cleanVar2 = Number(
            String(var2Raw).replace(/\D/g, "")
          );

          const standaloneBundleVar =
            bundleInfo.shopifyVariantId
              ? Number(
                  String(
                    bundleInfo.shopifyVariantId
                  ).replace(/\D/g, "")
                )
              : 0;

          // 2. Fetch Latest Live Cart State from Shopify
          let currentCartItems = [];
          try {
            const cartRes = await fetch("/cart.js", {
              method: "GET",
              headers: { Accept: "application/json" },
              cache: "no-store",
              credentials: "same-origin",
            });
            if (cartRes.ok) {
              const cartData = await cartRes.json();
              currentCartItems = Array.isArray(cartData.items)
                ? cartData.items
                : [];
            }
          } catch (cartErr) {
            console.warn(
              "[Smart Stock Bundle] Live cart fetch warning:",
              cartErr
            );
          }

          // Map quantities of variants currently in the cart
          const cartVariantQtyMap = {};
          for (const item of currentCartItems) {
            const vid = Number(item.variant_id || item.id);
            if (vid) {
              cartVariantQtyMap[vid] =
                (cartVariantQtyMap[vid] || 0) +
                Number(item.quantity || 0);
            }
          }

          // 3. Determine Exactly Which Items Need to be Added
          let itemsToAdd = [];

          if (cleanVar1 && cleanVar2) {
            const qty1InCart = cartVariantQtyMap[cleanVar1] || 0;
            const qty2InCart = cartVariantQtyMap[cleanVar2] || 0;

            if (qty1InCart > 0 && qty2InCart === 0) {
              // Main product is already in cart, but companion was deleted/missing.
              // Add ONLY the missing companion product to avoid unwanted duplicate main product.
              itemsToAdd.push({
                id: cleanVar2,
                quantity: 1,
                properties: {
                  _smart_stock_bundle: bundleName,
                },
              });
            } else if (qty2InCart > 0 && qty1InCart === 0) {
              // Companion product is already in cart, but main product is missing.
              // Add ONLY the missing main product.
              itemsToAdd.push({
                id: cleanVar1,
                quantity: 1,
                properties: {
                  _smart_stock_bundle: bundleName,
                },
              });
            } else {
              // Both are missing OR both are in cart (add full bundle set)
              itemsToAdd.push({
                id: cleanVar1,
                quantity: 1,
                properties: {
                  _smart_stock_bundle: bundleName,
                },
              });
              itemsToAdd.push({
                id: cleanVar2,
                quantity: 1,
                properties: {
                  _smart_stock_bundle: bundleName,
                },
              });
            }
          } else if (cleanVar1) {
            itemsToAdd.push({
              id: cleanVar1,
              quantity: 1,
              properties: {
                _smart_stock_bundle: bundleName,
              },
            });
          } else if (standaloneBundleVar) {
            itemsToAdd.push({
              id: standaloneBundleVar,
              quantity: 1,
            });
          }

          if (itemsToAdd.length === 0) {
            throw new Error(
              "Could not resolve bundle items to add."
            );
          }

          // 4. Send POST /cart/add.js to Shopify Cart
          const response = await fetch("/cart/add.js", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ items: itemsToAdd }),
          });

          if (!response.ok) {
            const error = await response
              .json()
              .catch(() => ({}));
            throw new Error(
              error.description ||
                error.message ||
                "Failed to add bundle to cart."
            );
          }

          const addedResult = await response
            .json()
            .catch(() => ({}));

          // 5. Trigger Theme Cart Events (for cart drawer & badge updates)
          try {
            document.dispatchEvent(
              new CustomEvent("cart:updated", {
                detail: { cart: addedResult },
              })
            );
            document.dispatchEvent(
              new CustomEvent("cart:refresh")
            );
            document.dispatchEvent(
              new CustomEvent("theme:cart:update")
            );
            if (
              window.Shopify &&
              typeof window.Shopify.onItemAdded === "function"
            ) {
              window.Shopify.onItemAdded(addedResult);
            }
          } catch (e) {}

          // 6. Success Feedback & Redirect
          button.style.background = "#059669";
          button.innerHTML = `
            <span>✓</span>
            <span>Added to Cart</span>
          `;

          // Redirect to cart page. If a Shopify automatic discount is linked, append it to the URL
          // so Shopify applies it immediately on the cart/checkout page.
          setTimeout(function () {
            if (bundleShopifyDiscountId) {
              // Encode the discount GID as a discount code query param if it looks like a code,
              // otherwise just go to cart (Shopify automatic discounts apply automatically).
              window.location.href = "/cart";
            } else {
              window.location.href = "/cart";
            }
          }, 450);
        } catch (error) {
          console.error(
            "[Smart Stock Bundle] Error adding to cart:",
            error
          );
          button.disabled = false;
          button.innerHTML = originalButtonHTML;
          button.style.background = "";

          // Remove any previous error message
          const existingErr =
            button.parentNode.querySelector(
              ".smart-stock-bundle-error-msg"
            );
          if (existingErr) {
            existingErr.remove();
          }

          const cleanMessage = String(
            error.message ||
              "Failed to add bundle to cart."
          ).replace(/^Bundle Error:\s*/i, "");

          const errorDiv = document.createElement("div");
          errorDiv.className = "smart-stock-bundle-error-msg";
          errorDiv.innerHTML = `
            <span class="smart-stock-bundle-error-icon">⚠️</span>
            <span class="smart-stock-bundle-error-text">${escapeHtml(cleanMessage)}</span>
          `;

          button.parentNode.insertBefore(
            errorDiv,
            button.nextSibling
          );
        }
      }
    );


    /* =======================================================
       INSERT INTO PRODUCT FORM
       ======================================================= */

    insertClearanceElement(
      element
    );
  }


  /* =========================================================
     REPLACE THEME SALE BADGE WITH PROGRESSIVE MARKDOWN
     ========================================================= */

  function replaceThemeSaleBadge(element) {
    const saleBadges = document.querySelectorAll(
      ".price__badge-sale, .price .badge, .product__info-container .price .badge, .badge.price__badge-sale, [data-price-badge]"
    );

    let replaced = false;
    for (const badge of saleBadges) {
      if (badge && badge.parentNode) {
        const text = (badge.textContent || "").trim().toLowerCase();
        if (text.includes("sale") || badge.classList.contains("price__badge-sale")) {
          badge.style.display = "none";
          badge.parentNode.insertBefore(element, badge.nextSibling);
          replaced = true;
        }
      }
    }

    if (replaced) return true;

    const priceInner = document.querySelector(
      ".product__info-container .price__container, .product-info .price__container, .price__sale, .price__regular, .product__info-container .price, .product-info .price, .price"
    );

    if (priceInner) {
      if (priceInner.classList.contains("price__container") || priceInner.classList.contains("price__sale") || priceInner.classList.contains("price")) {
        priceInner.appendChild(element);
        return true;
      }
      if (priceInner.parentNode) {
        priceInner.parentNode.insertBefore(element, priceInner.nextSibling);
        return true;
      }
    }

    return insertClearanceElement(element);
  }

  /* =========================================================
     PROGRESSIVE MARKDOWN BADGE
     ========================================================= */

  function renderMarkdown(data) {
    if (!data?.progressiveMarkdown?.enabled) {
      document
        .querySelectorAll('[data-smart-stock-feature="markdown"], .smart-stock-progressive-markdown-wrapper, [data-progressive-markdown-root], .smart-stock-markdown-badge, [data-markdown-badge]')
        .forEach((element) => {
          element.remove();
        });
      restoreStorefrontProductPrice();
    } else {
      document
        .querySelectorAll('[data-smart-stock-feature="markdown"], .smart-stock-progressive-markdown-wrapper, [data-progressive-markdown-root], .smart-stock-markdown-badge, [data-markdown-badge]')
        .forEach((element) => {
          element.remove();
        });
    }

    updateThemeSaleBadges(data);
  }

  /* =========================================================
     UPDATE THEME SALE BADGES & DISCOUNTED PRICE DISPLAY
     ========================================================= */

  function updateThemeSaleBadges(data) {
    const cfg = data?.markdownConfig || data?.progressiveMarkdown?.config || {};
    if (cfg.enabled === false) {
      document
        .querySelectorAll('[data-smart-stock-progressive-markdown], [data-smart-stock-price-display]')
        .forEach((el) => el.remove());
      const hiddenThemePrices = document.querySelectorAll('[data-smart-stock-hidden-price]');
      hiddenThemePrices.forEach((el) => {
        el.style.removeProperty("display");
        el.removeAttribute("data-smart-stock-hidden-price");
      });
      return;
    }

    const deadOffer = data?.deadStockOffer;
    const bundleIsActive = deadOffer?.hasBundle && !deadOffer?.hasClearance;
    const hasActiveMarkdown = Boolean(data?.progressiveMarkdown?.enabled && Number(data.progressiveMarkdown.currentDiscount) > 0);
    const hasActiveClearance = Boolean(deadOffer?.hasClearance && Number(deadOffer.discountPercent) > 0);

    // If a bundle is active OR if neither markdown nor clearance is active,
    // do NOT inject ANY sale or markdown badges or price overrides.
    if (bundleIsActive || (!hasActiveMarkdown && !hasActiveClearance)) {
      document
        .querySelectorAll('[data-smart-stock-progressive-markdown], [data-smart-stock-price-display], .smart-stock-markdown-badge, [data-markdown-badge]')
        .forEach((el) => el.remove());
      const hiddenPrices = document.querySelectorAll('[data-smart-stock-hidden-price]');
      hiddenPrices.forEach((el) => {
        el.style.removeProperty("display");
        el.removeAttribute("data-smart-stock-hidden-price");
      });
      return;
    }

    const bgColor = cfg.badgeBackgroundColor || "#df2626";
    const textColor = cfg.badgeTextColor || "#FFFFFF";
    const borderRadius = cfg.borderRadius != null ? cfg.borderRadius : 4;
    // Strip any stray leading/trailing % from the badge template (common misconfiguration)
    const rawTemplate = cfg.badgeText || "{discount}% OFF";
    const templateText = rawTemplate.replace(/^%\s*/, "").trim();

    let discountPct = 0;
    let originalPriceVal = 0;
    let salePriceVal = 0;

    // 0a. Clearance sale takes highest priority
    if (hasActiveClearance) {
      discountPct = Number(deadOffer.discountPercent);
      if (Number(deadOffer.originalPrice) > 0) {
        originalPriceVal = Number(deadOffer.originalPrice);
        salePriceVal = deadOffer.salePrice != null ? Number(deadOffer.salePrice) : originalPriceVal * (1 - discountPct / 100);
      }
    // 0b. Progressive Markdown
    } else if (hasActiveMarkdown) {
      const cleanCurrentVar = String(state.variantId || "").replace(/\D/g, "");
      const ruleVar = String(data.progressiveMarkdown.variantId || "").replace(/\D/g, "");
      if (!ruleVar || !cleanCurrentVar || cleanCurrentVar === ruleVar) {
        discountPct = Number(data.progressiveMarkdown.currentDiscount);
        if (Number(data.progressiveMarkdown.originalPrice) > 0) {
          originalPriceVal = Number(data.progressiveMarkdown.originalPrice);
          salePriceVal = Number(data.progressiveMarkdown.currentPrice) || (originalPriceVal * (1 - discountPct / 100));
        }

        // Live Shopify Variant confirmation:
        // Check window.SmartStockProduct to see if Shopify variant already has updated prices
        const prodVariant = (window.SmartStockProduct?.variants || []).find(
          (v) => String(v.id) === cleanCurrentVar
        );
        if (prodVariant) {
          const vCompare = Number(prodVariant.compare_at_price) > 0 ? Number(prodVariant.compare_at_price) / 100 : 0;
          const vPrice = Number(prodVariant.price) > 0 ? Number(prodVariant.price) / 100 : 0;
          if (vCompare > 0 && vPrice > 0 && vCompare > vPrice) {
            originalPriceVal = vCompare;
            salePriceVal = vPrice;
            const liveComputedDiscount = Math.round(((vCompare - vPrice) / vCompare) * 100);
            if (liveComputedDiscount > 0) {
              discountPct = liveComputedDiscount;
            }
          }
        }
      }
    }

    // 5. Fallback: Parse existing DOM price elements ONLY if compare-at price exists in theme
    const priceRoot = document.querySelector(
      ".product__info-container .price, .product__price .price, .price, .product-single__price"
    );
    const regPriceEl = priceRoot
      ? priceRoot.querySelector(".price-item--regular, .price__regular .price-item, .price-item")
      : document.querySelector(".price-item--regular, .price__regular .price-item, .price-item");
    const existingSaleEl = priceRoot
      ? priceRoot.querySelector(".price-item--sale, .price__sale .price-item")
      : document.querySelector(".price-item--sale, .price__sale .price-item");

    const regText = regPriceEl ? regPriceEl.textContent.trim() : "";
    const regNum = regText ? parseFloat(regText.replace(/[^0-9.]/g, "")) : 0;

    if (discountPct <= 0) {
      // Clean up any previously applied price display or markdown badges if discount is 0
      document.querySelectorAll('[data-smart-stock-price-display="true"], [data-smart-stock-progressive-markdown="true"]').forEach((el) => el.remove());
      const hiddenPrices = document.querySelectorAll('[data-smart-stock-hidden-price]');
      hiddenPrices.forEach((el) => {
        el.style.removeProperty("display");
        el.removeAttribute("data-smart-stock-hidden-price");
      });
      return;
    }

    // Ensure price values are calculated
    if (!originalPriceVal || originalPriceVal <= 0) {
      originalPriceVal = regNum > 0 ? regNum : 0;
    }
    if (!salePriceVal || salePriceVal <= 0) {
      salePriceVal = originalPriceVal > 0 ? originalPriceVal * (1 - discountPct / 100) : 0;
    }

    // Helper to format price maintaining original currency suffix if present in DOM
    function formatPriceWithSuffix(amount, sample) {
      if (isNaN(amount) || amount <= 0) return "";
      let formatted = formatMoney(amount);
      if (sample && typeof sample === "string") {
        const trimmed = sample.trim();
        const suffixMatch = trimmed.match(/([A-Z]{3})$/i);
        if (suffixMatch && !formatted.includes(suffixMatch[1])) {
          formatted += " " + suffixMatch[1];
        }
      }
      return formatted;
    }

    const originalFormatted = formatPriceWithSuffix(originalPriceVal, regText);
    const saleFormatted = formatPriceWithSuffix(salePriceVal, regText);

    // =========================================================
    // UPDATE DOM: STRIKETHROUGH ORIGINAL PRICE & SHOW DISCOUNTED PRICE
    // User requirement: Real price has strikethrough (underline/line-through),
    // discounted price is shown, and % off badge is shown right next to it ("baju ma").
    // =========================================================
    const isThemeOnSale = Boolean(
      priceRoot && priceRoot.classList.contains("price--on-sale")
    );

    if (isThemeOnSale && !deadOffer?.hasBundle) {
      // Theme is natively in on-sale mode with .price__sale
      // 1. Remove any custom injected wrapper so we don't have duplicate prices
      document.querySelectorAll('[data-smart-stock-price-display="true"]').forEach((el) => el.remove());

      // 2. Ensure strikethrough compare-at element shows the original price with strikethrough
      const regularItem = priceRoot.querySelector(".price__sale .price-item--regular, .price__sale s, s.price-item");
      if (regularItem) {
        if (originalFormatted) regularItem.textContent = originalFormatted;
        regularItem.style.setProperty("text-decoration", "line-through", "important");
        regularItem.style.setProperty("color", "#6b7280", "important");
        regularItem.style.setProperty("opacity", "0.75", "important");
        regularItem.style.setProperty("display", "inline", "important");
      }

      // 3. Ensure sale item shows the current markdown price
      const saleItem = priceRoot.querySelector(".price-item--sale, .price__sale .price-item--last");
      if (saleItem) {
        if (saleFormatted) saleItem.textContent = saleFormatted;
        saleItem.style.setProperty("font-weight", "700", "important");
        saleItem.style.setProperty("color", "#111827", "important");
      }
    } else if (!deadOffer?.hasBundle && priceRoot && originalFormatted && saleFormatted) {
      // Theme does NOT have .price--on-sale (e.g. compareAtPrice is null on Shopify variant)
      // Inject both strikethrough original price and discounted markdown price cleanly
      let priceDisplayWrapper = priceRoot.querySelector('[data-smart-stock-price-display="true"]');
      if (!priceDisplayWrapper) {
        priceDisplayWrapper = document.createElement("div");
        priceDisplayWrapper.setAttribute("data-smart-stock-price-display", "true");
        priceDisplayWrapper.style.cssText = `
          display: inline-flex !important;
          align-items: baseline !important;
          gap: 8px !important;
          flex-wrap: wrap !important;
          vertical-align: middle !important;
          margin-right: 4px !important;
        `;

        // Hide default regular price container to avoid duplicate un-discounted price
        const regWrapper = priceRoot.querySelector(".price__regular");
        if (regWrapper) {
          regWrapper.style.setProperty("display", "none", "important");
          regWrapper.setAttribute("data-smart-stock-hidden-price", "true");
        } else if (regPriceEl) {
          regPriceEl.style.setProperty("display", "none", "important");
          regPriceEl.setAttribute("data-smart-stock-hidden-price", "true");
        }

        const container = priceRoot.querySelector(".price__container") || priceRoot;
        container.prepend(priceDisplayWrapper);
      }

      priceDisplayWrapper.innerHTML = `
        <s class="price-item price-item--regular" style="text-decoration: line-through !important; color: #6b7280 !important; font-size: 0.95em !important; opacity: 0.75 !important; font-weight: 400 !important; margin-right: 2px !important;">
          ${escapeHtml(originalFormatted)}
        </s>
        <span class="price-item price-item--sale" style="font-weight: 700 !important; color: #111827 !important; font-size: 1.05em !important;">
          ${escapeHtml(saleFormatted)}
        </span>
      `;
    } else {
      // If bundle is active or no discount, clean up custom price display
      document.querySelectorAll('[data-smart-stock-price-display="true"]').forEach((el) => el.remove());
      const hiddenPrices = document.querySelectorAll('[data-smart-stock-hidden-price]');
      hiddenPrices.forEach((el) => {
        el.style.removeProperty("display");
        el.removeAttribute("data-smart-stock-hidden-price");
      });
    }

    // =========================================================
    // BADGE HTML & INJECTION ("baju ma %off price show")
    // =========================================================
    const badgeText = templateText.replace(/\{discount\}/g, String(discountPct));

    const badgeHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; flex-shrink:0;">
        <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
        <polyline points="17 18 23 18 23 12"></polyline>
      </svg>
      <span>${escapeHtml(badgeText)}</span>
    `;

    // 1. Hide/remove ALL generic theme "Sale" badges so "Sale" NEVER shows
    const themeSaleBadges = Array.from(
      document.querySelectorAll(
        ".price__badge-sale, .price .badge, .product__info-container .price .badge, .badge.price__badge-sale, [data-price-badge]"
      )
    );
    themeSaleBadges.forEach((b) => {
      if (!b.hasAttribute("data-smart-stock-progressive-markdown")) {
        const txt = (b.textContent || "").trim().toLowerCase();
        if (txt === "sale" || b.classList.contains("price__badge-sale")) {
          b.style.setProperty("display", "none", "important");
          b.setAttribute("data-smart-stock-duplicate-hidden", "true");
        }
      }
    });

    // 2. Locate or create our dedicated Progressive Markdown % OFF badge
    let markdownBadge = document.querySelector('[data-smart-stock-progressive-markdown="true"]');
    if (!markdownBadge) {
      const eligibleBadge = themeSaleBadges.find((b) => b.closest(".price__sale") || b.closest(".price__container") || b.classList.contains("price__badge-sale"));
      if (eligibleBadge) {
        markdownBadge = eligibleBadge;
      } else {
        markdownBadge = document.createElement("span");
        markdownBadge.className = "badge price__badge-sale smart-stock-markdown-badge";
      }
      markdownBadge.setAttribute("data-smart-stock-progressive-markdown", "true");
    }

    // Remove any duplicate markdown badges if more than one exists
    document.querySelectorAll('[data-smart-stock-progressive-markdown="true"]').forEach((el, idx) => {
      if (idx > 0) el.remove();
    });

    markdownBadge.style.cssText = `
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
      background: ${bgColor} !important;
      color: ${textColor} !important;
      border: none !important;
      padding: 4px 8px !important;
      border-radius: ${borderRadius}px !important;
      font-weight: 700 !important;
      font-size: 12px !important;
      line-height: 1.2 !important;
      letter-spacing: 0.3px !important;
      text-transform: uppercase !important;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1) !important;
      margin-left: 8px !important;
      vertical-align: middle !important;
    `;
    markdownBadge.innerHTML = badgeHTML;

    // 3. Ensure the % OFF badge is placed directly next to the price ("baju ma")
    const priceParent =
      priceRoot?.querySelector('[data-smart-stock-price-display="true"]') ||
      priceRoot?.querySelector(".price__sale") ||
      priceRoot?.querySelector(".price__container") ||
      priceRoot;

    if (priceParent && !priceParent.contains(markdownBadge)) {
      priceParent.appendChild(markdownBadge);
    }
  }

  /* =========================================================
     URGENCY
     ========================================================= */

  function renderUrgency(data) {
    // Suppressed: Handled exclusively in-form by Stockout Shield
    return;
  }

  /* =========================================================
     LOAD FEATURES (MODULE A)
     ========================================================= */

  async function loadFeatures() {
    const cacheKey = "ss_widget_" + config.shop + "_" + state.productId + "_" + state.variantId;
    let cachedData = null;
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.data) {
          // If progressive markdown is enabled, NEVER use cached data because discounts and prices change dynamically
          if (parsed.data.progressiveMarkdown?.enabled) {
            sessionStorage.removeItem(cacheKey);
          } else {
            cachedData = parsed.data;
            renderSale(cachedData);
            renderBundle(cachedData);
            renderMarkdown(cachedData);
            renderUrgency(cachedData);
            updateThemeSaleBadges(cachedData);
          }
        }
      }
    } catch (_) {}

    const params = new URLSearchParams({
      shop: config.shop,
      productId: state.productId,
      variantId: state.variantId,
      _t: Date.now().toString(),
    });

    try {
      let data = null;
      if (window.__SmartStockPreloadPromise) {
        try {
          data = await window.__SmartStockPreloadPromise;
        } catch (_) {}
        window.__SmartStockPreloadPromise = null;
      }

      if (!data) {
        const response = await fetch(
          `/apps/smart-stock/product-widget?${params.toString()}`,
          {
            credentials: "same-origin",
          }
        );

        if (!response.ok) {
          throw new Error(`Smart Stock request failed: ${response.status}`);
        }

        data = await response.json();
      }

      if (!data?.deadStockOffer?.hasClearance && !data?.deadStockOffer?.hasBundle) {
        try {
          sessionStorage.removeItem(cacheKey);
        } catch (_) {}
      } else if (data?.progressiveMarkdown?.enabled) {
        // Progressive markdown rules change over time; never persist in sessionStorage
        try {
          sessionStorage.removeItem(cacheKey);
        } catch (_) {}
      } else {
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ data: data, time: Date.now() }));
        } catch (_) {}
      }

      /* -----------------------------------------------
         Immediate render (zero delay)
         ----------------------------------------------- */
      renderSale(data);
      renderBundle(data);
      renderMarkdown(data);
      renderUrgency(data);
      updateThemeSaleBadges(data);

      /* -----------------------------------------------
         Theme re-render
         ----------------------------------------------- */
      setTimeout(function () {
        const clearance = document.querySelector('[data-smart-stock-feature="clearance"]');
        const bundle = document.querySelector('[data-smart-stock-feature="bundle"]');
        const markdown = document.querySelector('[data-smart-stock-feature="markdown"]');

        if (data?.deadStockOffer?.hasClearance && !clearance) {
          renderSale(data);
        }
        if (data?.deadStockOffer?.hasBundle && !bundle) {
          renderBundle(data);
        }
        if (data?.progressiveMarkdown?.enabled && !markdown) {
          renderMarkdown(data);
        }
        updateThemeSaleBadges(data);
      }, 600);

      /* -----------------------------------------------
         Final theme retry
         ----------------------------------------------- */
      setTimeout(function () {
        const clearance = document.querySelector('[data-smart-stock-feature="clearance"]');
        const bundle = document.querySelector('[data-smart-stock-feature="bundle"]');
        const markdown = document.querySelector('[data-smart-stock-feature="markdown"]');

        if (data?.deadStockOffer?.hasClearance && !clearance) {
          renderSale(data);
        }
        if (data?.deadStockOffer?.hasBundle && !bundle) {
          renderBundle(data);
        }
        if (data?.progressiveMarkdown?.enabled && !markdown) {
          renderMarkdown(data);
        }
        updateThemeSaleBadges(data);
      }, 1500);
    } catch (error) {
      console.error(
        "[Smart Stock]",
        error
      );
      removeElements();
    }
  }


  /* =========================================================
     VARIANT EVENT
     ========================================================= */

  function getVariantIdFromEvent(
    event
  ) {

    return (
      event.detail?.variant?.id ||
      event.target?.value ||
      ""
    );
  }


  document.addEventListener(
    "variant:change",
    function (event) {

      const variantId =
        getVariantIdFromEvent(
          event
        );


      if (variantId) {

        state.variantId =
          String(
            variantId
          );


        loadFeatures();

      }

    }
  );


  /* =========================================================
     VARIANT SELECT & URL MONITORING
     ========================================================= */

  function checkUrlVariant() {
    try {
      const match = window.location.search.match(/[?&]variant=([0-9]+)/);
      if (match && match[1] && String(match[1]) !== String(state.variantId).replace(/\D/g, "")) {
        state.variantId = String(match[1]);
        loadFeatures();
      }
    } catch (_) {}
  }
  window.addEventListener("popstate", checkUrlVariant);

  document.addEventListener(
    "change",
    function (event) {
      if (event.target?.name === "id" && event.target.value) {
        state.variantId = String(event.target.value);
        loadFeatures();
        return;
      }

      // Check if an option change updated the hidden form [name="id"]
      const form = event.target?.closest?.("form[action*='/cart/add']");
      if (form) {
        setTimeout(function () {
          const idInput = form.querySelector('[name="id"]');
          if (idInput && idInput.value && String(idInput.value) !== String(state.variantId)) {
            state.variantId = String(idInput.value);
            loadFeatures();
          } else {
            checkUrlVariant();
          }
        }, 50);
      }
    }
  );


  /* =========================================================
     CART PRE-ORDER DEPOSIT DISPLAY ENHANCEMENT
     ========================================================= */
  async function enhanceCartPreOrderDisplay() {
    try {
      var isCartPage = window.location.pathname.indexOf("/cart") !== -1;
      var hasDrawer = !!document.querySelector("cart-drawer, [data-cart-drawer], .cart-drawer");
      if (!isCartPage && !hasDrawer) return;

      var cartRes = await fetch("/cart.js", { headers: { Accept: "application/json" } });
      if (!cartRes.ok) return;
      var cart = await cartRes.json();
      if (!cart || !cart.items || cart.items.length === 0) return;

      var hasPreOrder = false;
      var totalPayableCents = 0;

      cart.items.forEach(function (item) {
        var props = item.properties || {};
        var isPre = props._preorder === "true" || props._preorder_launch === "true" || props["Deposit Paid"] || props["Remaining Balance Due"] || props["Pre-Order Total"];
        var depositCents = props._deposit_cents ? Number(props._deposit_cents) : null;

        if (isPre) {
          hasPreOrder = true;
          if (depositCents == null) {
            var depStr = props["Deposit Paid"] || props["Deposit Paid (0%)"] || "";
            var num = parseFloat(String(depStr).replace(/[^0-9.]/g, ""));
            depositCents = !isNaN(num) && num > 0 ? Math.round(num * 100) : item.final_line_price;
          }
          totalPayableCents += depositCents * (props._deposit_cents ? 1 : item.quantity);
        } else {
          totalPayableCents += item.final_line_price;
        }
      });

      if (!hasPreOrder) return;

      var cartItems = document.querySelectorAll("cart-items .cart-item, .cart-item, .cart__items tr, tr.cart-item, [data-cart-item], .cart-drawer .cart-item");
      cartItems.forEach(function (row) {
        var rowText = row.textContent || "";
        if (!rowText.includes("Deposit Paid") && !rowText.includes("Remaining Balance Due") && !rowText.includes("Pre-Order Total")) return;

        var match = rowText.match(/Deposit Paid[^:]*:\s*\$?([\d,]+(?:\.\d{2})?)/i);
        var depAmt = match ? match[1].replace(/,/g, "") : "";
        if (!depAmt) {
          var match2 = rowText.match(/Pre-Order Total[^:]*:\s*\$?([\d,]+(?:\.\d{2})?)/i);
          if (match2) depAmt = match2[1].replace(/,/g, "");
        }

        if (depAmt) {
          var priceContainers = row.querySelectorAll(".cart-item__price-wrapper, .cart-item__totals, .cart-item__price, .price--end, [data-cart-item-line-price], .cart-item__final-price");
          priceContainers.forEach(function (pEl) {
            if (pEl.getAttribute("data-smart-stock-enhanced")) return;
            pEl.setAttribute("data-smart-stock-enhanced", "true");
            var origHtml = pEl.innerHTML;
            pEl.innerHTML =
              '<div style="display:inline-flex; flex-direction:column; align-items:flex-end;">' +
              '<span style="color:#0F172A; font-weight:800; font-size:15px; display:inline-flex; align-items:center; gap:6px;">$' +
              parseFloat(depAmt).toFixed(2) +
              ' <span style="font-size:11px; background:#EEF2FF; color:#4F46E5; padding:2px 6px; border-radius:4px; font-weight:700; text-transform:uppercase;">Deposit</span></span>' +
              '<span style="font-size:12px; color:#94A3B8; text-decoration:line-through;">' +
              origHtml.replace(/<[^>]*>?/gm, "").trim() +
              '</span></div>';
          });
        }
      });

      var subtotalEls = document.querySelectorAll(".totals__total-value, .cart__subtotal-value, .cart-subtotal, [data-cart-subtotal], .cart__total, .cart-drawer__total, .totals__subtotal-value, .cart__footer .totals__total-value, [data-cart-total]");
      subtotalEls.forEach(function (stEl) {
        if (stEl.getAttribute("data-smart-stock-subtotal-enhanced")) return;
        stEl.setAttribute("data-smart-stock-subtotal-enhanced", "true");
        var formattedDeposit = "$" + (totalPayableCents / 100).toFixed(2);
        stEl.innerHTML =
          '<div style="text-align:right;">' +
          '<div style="font-size:18px; font-weight:800; color:#0F172A;">' + formattedDeposit + ' USD</div>' +
          '<div style="font-size:11.5px; color:#64748B; font-weight:600; margin-top:2px;">Pay Now Deposit (Remaining balance due before shipping)</div>' +
          '</div>';
      });
    } catch (_) {}
  }

  /* =========================================================
     INITIAL LOAD
     ========================================================= */

  function init() {
    loadFeatures();
    enhanceCartPreOrderDisplay();
  }

  // Start immediately so cached data renders in 0ms and network request starts instantly
  init();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  }

  setTimeout(enhanceCartPreOrderDisplay, 500);
  setTimeout(enhanceCartPreOrderDisplay, 1500);
  document.addEventListener("cart:updated", enhanceCartPreOrderDisplay);
  document.addEventListener("theme:cart:update", enhanceCartPreOrderDisplay);
  document.addEventListener("cart:refresh", enhanceCartPreOrderDisplay);
})();