const PLACEHOLDER_IMAGE = "https://placehold.co/120x120?text=Cartify";

const API_CONFIG = {
  baseUrl: "https://cartify.runasp.net",
  endpoints: {
    products: (merchantId, page = 1, size = 10) =>
      `/api/merchant/products/merchant/${merchantId}?page=${page}&pageSize=${size}`,
    productById: (productId) => `/api/merchant/products/${productId}`,
    createProduct: () => `/api/merchant/products`,
    updateProduct: (productId) => `/api/merchant/products/${productId}`,
    deleteProduct: (productId) => `/api/merchant/products/${productId}`,
    productDetailsByProduct: (productId) => `/api/merchant/products/${productId}`,
    productDetailById: (detailId) => `/api/merchant/products/details/${detailId}`,
    productDetails: () => `/api/merchant/products/details`,
    deleteProductDetail: (detailId) => `/api/merchant/products/details/${detailId}`,
    inventoryByDetail: (detailId) => `/api/merchant/inventory/product-detail/${detailId}`,
    inventoryStock: (detailId) => `/api/merchant/inventory/product-detail/${detailId}/stock`,
    subcategories: () => `/api/Category/subcategory`,
    attributes: () => `/api/merchant/attributes-measures/attributes`,
    measures: () => `/api/merchant/attributes-measures/measures`,
    uploadProductImages: (productId) => `/api/merchant/products/${productId}/images`,
  },
};

const state = {
  products: [],
  filteredProducts: [],
  pagination: { page: 1, size: 10 },
  selectedProduct: null,
  selectedProductDetails: [],
  selectedDetail: null,
  subcategories: [],
  attributes: [],
  measures: [],
  inventoryRecord: null,
};

document.addEventListener("DOMContentLoaded", () => {
  bindSidebar();
  bindButtons();
  bindForms();
  hydrateContextLabels();
  ensureCatalogs();
  loadProducts();
});

function getAuthToken() {
  const direct =
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("authToken") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token");
  if (direct) return direct.startsWith("Bearer ") ? direct.slice(7) : direct;

  const authObj =
    localStorage.getItem("Auth") ||
    sessionStorage.getItem("Auth") ||
    localStorage.getItem("auth") ||
    sessionStorage.getItem("auth");
  if (authObj) {
    try {
      const parsed = JSON.parse(authObj);
      const tok = parsed.jwt || parsed.token || parsed.accessToken || "";
      return tok.startsWith("Bearer ") ? tok.slice(7) : tok;
    } catch (err) {
      console.warn("Unable to parse Auth object", err);
    }
  }
  return "";
}

async function apiRequest(path, options = {}) {
  const token = getAuthToken();
  const config = {
    method: options.method || "GET",
    headers: new Headers(options.headers || {}),
  };

  const isFormData = options.body instanceof FormData;
  if (!isFormData && options.body !== undefined && !config.headers.has("Content-Type")) {
    config.headers.set("Content-Type", "application/json");
  }

  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body !== undefined) {
    config.body = options.body;
  }

  const response = await fetch(`${API_CONFIG.baseUrl}${path}`, config);
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || response.statusText);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getMerchantContext() {
  const context = {
    merchantId: localStorage.getItem("merchantId") || null,
    storeId: localStorage.getItem("storeId") || null,
  };

  const authObj =
    localStorage.getItem("Auth") ||
    sessionStorage.getItem("Auth") ||
    localStorage.getItem("auth") ||
    sessionStorage.getItem("auth");
  if (authObj) {
    try {
      const parsed = JSON.parse(authObj);
      context.merchantId =
        context.merchantId ||
        parsed.merchantId ||
        parsed.MerchantId ||
        parsed.userId ||
        parsed.UserId ||
        null;
      context.storeId = context.storeId || parsed.storeId || parsed.StoreId || null;
    } catch (err) {
      console.warn("Unable to parse Auth object", err);
    }
  }

  const token = getAuthToken();
  if (token && token.split(".").length === 3) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      context.merchantId =
        context.merchantId ||
        payload.merchantId ||
        payload.MerchantId ||
        payload.sub ||
        payload.nameid ||
        null;
      context.storeId =
        context.storeId || payload.storeId || payload.StoreId || payload.storeID || null;
    } catch (error) {
      console.warn("Unable to parse auth token", error);
    }
  }

  return context;
}

function bindSidebar() {
  const navItems = document.querySelectorAll(".sidebar .nav-link");
  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      navItems.forEach((item) => item.classList.remove("active"));
      btn.classList.add("active");
      if (btn.dataset.target === "products") {
        showSection("productsSection");
        loadProducts();
      } else {
        showToast("This section is handled elsewhere in the platform.", "info");
      }
    });
  });
}

function bindButtons() {
  const searchInput = document.getElementById("productSearchInput");
  searchInput.addEventListener("input", (event) => handleSearch(event.target.value));

  document.getElementById("openProductModalBtn").addEventListener("click", () =>
    openProductModal(),
  );
  document.getElementById("productsEmptyPrimaryBtn").addEventListener("click", () =>
    openProductModal(),
  );

  document.getElementById("refreshProductsBtn").addEventListener("click", () => loadProducts());

  document
    .getElementById("productsTableBody")
    .addEventListener("click", handleProductsTableAction);
  document
    .getElementById("productDetailsTableBody")
    .addEventListener("click", handleDetailsTableAction);

  document.getElementById("backToProductsBtn").addEventListener("click", () => {
    showSection("productsSection");
  });

  document
    .getElementById("refreshProductDetailsBtn")
    .addEventListener("click", () => refreshSelectedProductDetails());

  document.getElementById("productDetailsEmptyBtn").addEventListener("click", () =>
    openProductDetailModal(),
  );

  document.getElementById("addProductDetailBtn").addEventListener("click", () =>
    openProductDetailModal(),
  );

  document.getElementById("backToProductDetailsBtn").addEventListener("click", () => {
    showSection("productDetailsSection");
  });

  document.getElementById("refreshInventoryBtn").addEventListener("click", () => {
    if (state.selectedDetail) {
      loadInventory(state.selectedDetail);
    }
  });

  document.getElementById("detailAttributesWrapper").addEventListener("click", (event) => {
    if (event.target.classList.contains("attribute-remove")) {
      event.preventDefault();
      event.target.closest(".attribute-row")?.remove();
    }
  });

  document.getElementById("addAttributeRowBtn").addEventListener("click", async () => {
    await ensureAttributeCatalogs();
    addAttributeRow();
  });

  document.getElementById("productImageUrlInput").addEventListener("input", (event) => {
    const preview = document.getElementById("productImagePreview");
    preview.src = event.target.value.trim() || PLACEHOLDER_IMAGE;
  });

  document.getElementById("productImageFileInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    const preview = document.getElementById("productImagePreview");
    if (file) {
      preview.src = URL.createObjectURL(file);
    } else {
      preview.src = document.getElementById("productImageUrlInput").value.trim() || PLACEHOLDER_IMAGE;
    }
  });
}

function bindForms() {
  document.getElementById("addProductForm").addEventListener("submit", handleProductSubmit);
  document
    .getElementById("addProductDetailForm")
    .addEventListener("submit", handleProductDetailSubmit);
  document.getElementById("addInventoryForm").addEventListener("submit", handleInventorySubmit);

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
  });

  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal(modal.id);
      }
    });
  });
}

function showSection(sectionId) {
  document.querySelectorAll(".content-section").forEach((section) => {
    if (section.id === sectionId) {
      section.classList.add("active");
      section.classList.remove("hidden");
    } else {
      section.classList.remove("active");
      section.classList.add("hidden");
    }
  });
}

function hydrateContextLabels() {
  const { merchantId, storeId } = getMerchantContext();
  document.getElementById("merchantIdLabel").textContent = merchantId || "–";
  document.getElementById("storeIdLabel").textContent = storeId || "–";
}

async function ensureCatalogs() {
  await Promise.all([ensureSubcategories(), ensureAttributeCatalogs()]);
}

async function ensureSubcategories() {
  if (state.subcategories.length) {
    populateTypeSelect();
    return;
  }

  if (!getAuthToken()) return;

  try {
    const data = await apiRequest(API_CONFIG.endpoints.subcategories());
    const items = data?.data || data?.items || data;
    state.subcategories = Array.isArray(items) ? items : [];
    populateTypeSelect();
  } catch (error) {
    console.warn("Unable to load subcategories", error);
    showToast("Could not load product types. Try again after signing in.", "error");
    const select = document.getElementById("productTypeSelect");
    if (select) {
      select.innerHTML = '<option value="">Sign in to load types</option>';
    }
  }
}

async function ensureAttributeCatalogs() {
  if (!getAuthToken()) return;
  if (state.attributes.length && state.measures.length) return;
  try {
    const [attributes, measures] = await Promise.all([
      apiRequest(API_CONFIG.endpoints.attributes()),
      apiRequest(API_CONFIG.endpoints.measures()),
    ]);
    state.attributes = Array.isArray(attributes?.data || attributes)
      ? attributes.data || attributes
      : [];
    state.measures = Array.isArray(measures?.data || measures) ? measures.data || measures : [];
  } catch (error) {
    console.warn("Unable to load attribute/measure catalogs", error);
    showToast("Attributes/measures could not be loaded. You can still type IDs manually.", "error");
  }
}

function populateTypeSelect() {
  const select = document.getElementById("productTypeSelect");
  if (!select) return;

  const options = state.subcategories
    .map((sub) => {
      const id = sub.subCategoryId || sub.id;
      const name = sub.subCategoryName || sub.name || `Type ${id}`;
      return `<option value="${id}">${name}</option>`;
    })
    .join("");

  select.innerHTML = `<option value="">Select type</option>${options}`;
}

async function loadProducts() {
  const tbody = document.getElementById("productsTableBody");
  tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Loading products…</td></tr>`;

  if (!getAuthToken()) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Log in to load products (token not found).</td></tr>`;
    showToast("Login required to load products. Set authToken in storage.", "error");
    return;
  }

  const { merchantId } = getMerchantContext();
  if (!merchantId) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">merchantId missing. Store it in localStorage before loading.</td></tr>`;
    showToast("Set merchantId in localStorage to load catalog data.", "error");
    return;
  }

  try {
    const response = await apiRequest(
      API_CONFIG.endpoints.products(merchantId, state.pagination.page, state.pagination.size),
    );
    const products = response?.data || response?.items || response?.value || response || [];
    state.products = Array.isArray(products) ? products : [];
    state.filteredProducts = [...state.products];

    document.getElementById("productsCount").textContent = state.products.length;
    renderProducts(state.filteredProducts);
  } catch (error) {
    console.error(error);
    if (error.status === 401) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Unauthorized. Please log in and ensure authToken is stored.</td></tr>`;
      showToast("Unauthorized. Please log in again.", "error");
    } else {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Unable to load products (${error.message}).</td></tr>`;
      showToast("Failed to load products.", "error");
    }
  }
}

function renderProducts(products) {
  const tbody = document.getElementById("productsTableBody");
  const emptyState = document.getElementById("productsEmptyState");

  if (!products.length) {
    tbody.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  const rows = products
    .map((product) => {
      const id = getProductId(product);
      const name = product.productName || product.name || `Product #${id}`;
      const description = product.productDescription || product.description || "—";
      const variants =
        product.productDetails?.length ||
        product.ProductDetails?.length ||
        product.details?.length ||
        0;
      const created = product.createdDate || product.CreatedAt || product.createdAt;
      const createdLabel = created ? new Date(created).toLocaleDateString() : "—";

      return `
        <tr>
          <td>
            <strong>${escapeHtml(name)}</strong>
            <div class="muted">ID: ${id}</div>
          </td>
          <td>${escapeHtml(description)}</td>
          <td>${variants}</td>
          <td>${createdLabel}</td>
          <td>
            <div class="action-group">
              <button class="btn ghost" data-action="details" data-id="${id}">Details</button>
              <button class="btn" data-action="edit" data-id="${id}">Edit</button>
              <button class="btn danger" data-action="delete" data-id="${id}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  tbody.innerHTML = rows;
}

function handleSearch(term) {
  const normalized = term.trim().toLowerCase();
  if (!normalized) {
    state.filteredProducts = [...state.products];
  } else {
    state.filteredProducts = state.products.filter((product) => {
      const name = (product.productName || product.name || "").toLowerCase();
      return name.includes(normalized);
    });
  }
  document.getElementById("productsCount").textContent = state.filteredProducts.length;
  renderProducts(state.filteredProducts);
}

function handleProductsTableAction(event) {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;

  const id = Number(btn.dataset.id);
  if (!id) return;

  if (btn.dataset.action === "details") {
    showProductDetails(id);
  } else if (btn.dataset.action === "edit") {
    const product = state.products.find((item) => getProductId(item) === id);
    openProductModal(product || null);
  } else if (btn.dataset.action === "delete") {
    deleteProduct(id);
  }
}

function showProductDetails(productId) {
  const product = state.products.find((item) => getProductId(item) === productId) || null;
  if (product) {
    state.selectedProduct = product;
  } else {
    state.selectedProduct = { productId };
  }

  showSection("productDetailsSection");
  hydrateProductHeader(state.selectedProduct);
  loadProductDetails(productId);
}

function hydrateProductHeader(product) {
  const name =
    product.productName || product.name || product.title || `Product #${getProductId(product)}`;
  document.getElementById("selectedProductTitle").textContent = name;
  document.getElementById("selectedProductDescription").textContent =
    product.productDescription || product.description || "";
  document.getElementById("selectedProductId").textContent = getProductId(product);
  const image = product.imageUrl || product.ImageUrl || product.productImageUrl || PLACEHOLDER_IMAGE;
  document.getElementById("selectedProductImage").src = image;
}

async function loadProductDetails(productId) {
  const tbody = document.getElementById("productDetailsTableBody");
  tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Loading variants…</td></tr>`;

  try {
    const response = await apiRequest(
      API_CONFIG.endpoints.productDetailsByProduct(productId),
    );
    state.selectedProduct = response || state.selectedProduct;
    hydrateProductHeader(state.selectedProduct);

    const details =
      response?.productDetails ||
      response?.ProductDetails ||
      response?.details ||
      response?.variants ||
      [];
    state.selectedProductDetails = Array.isArray(details) ? details : [];

    renderProductDetails(state.selectedProductDetails);
  } catch (error) {
    console.error(error);
    if (error.status === 401) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Unauthorized. Please log in again.</td></tr>`;
      showToast("Unauthorized. Please log in again.", "error");
    } else {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Unable to load variants (${error.message}).</td></tr>`;
      showToast("Failed to load product variants.", "error");
    }
  }
}

function renderProductDetails(details) {
  const tbody = document.getElementById("productDetailsTableBody");
  const emptyState = document.getElementById("productDetailsEmptyState");

  if (!details.length) {
    tbody.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  tbody.innerHTML = details
    .map((detail) => {
      const id = getProductDetailId(detail);
      const serial = detail.serialNumber || detail.SerialNumber || `Variant #${id}`;
      const price = detail.price ?? detail.Price;
      const qty =
        detail.quantityAvailable || detail.QuantityAvailable || detail.quantity || detail.Quantity;
      const description = detail.description || detail.Description || "—";
      return `
        <tr>
          <td>${escapeHtml(serial)}</td>
          <td>${price !== undefined ? formatCurrency(price) : "—"}</td>
          <td>${qty ?? "—"}</td>
          <td>${escapeHtml(description)}</td>
          <td>
            <div class="action-group">
              <button class="btn ghost" data-detail-action="inventory" data-id="${id}">Inventory</button>
              <button class="btn" data-detail-action="edit" data-id="${id}">Edit</button>
              <button class="btn danger" data-detail-action="delete" data-id="${id}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function handleDetailsTableAction(event) {
  const btn = event.target.closest("button[data-detail-action]");
  if (!btn) return;

  const detailId = Number(btn.dataset.id);
  if (!detailId) return;

  if (btn.dataset.detailAction === "inventory") {
    const detail =
      state.selectedProductDetails.find((item) => getProductDetailId(item) === detailId) || null;
    showInventory(detailId, detail);
  } else if (btn.dataset.detailAction === "edit") {
    editProductDetail(detailId);
  } else if (btn.dataset.detailAction === "delete") {
    deleteProductDetail(detailId);
  }
}

function getProductId(product) {
  return Number(product?.productId || product?.id || product?.ProductId || product?.ID || 0);
}

function getProductDetailId(detail) {
  return Number(
    detail?.productDetailId ||
      detail?.ProductDetailId ||
      detail?.productDetailID ||
      detail?.id ||
      detail?.ID ||
      0,
  );
}

function openProductModal(product = null) {
  const modal = document.getElementById("productModal");
  const form = document.getElementById("addProductForm");
  form.reset();

  if (product) {
    document.getElementById("productModalTitle").textContent = "Edit product";
    document.getElementById("productIdField").value = getProductId(product);
    document.getElementById("productNameInput").value = product.productName || product.name || "";
    document.getElementById("productDescriptionInput").value =
      product.productDescription || product.description || "";
    document.getElementById("productImageUrlInput").value =
      product.imageUrl || product.ImageUrl || "";
    document.getElementById("productImagePreview").src =
      product.imageUrl || product.ImageUrl || PLACEHOLDER_IMAGE;
    document.getElementById("productStoreInput").value =
      getMerchantContext().storeId || product.storeId || product.StoreId || 1;
    const typeId =
      product.typeId || product.TypeId || product.subCategoryId || product.SubCategoryId;
    if (typeId) {
      ensureSubcategories().then(() => {
        document.getElementById("productTypeSelect").value = typeId;
      });
    }
  } else {
    document.getElementById("productModalTitle").textContent = "Add product";
    document.getElementById("productImagePreview").src = PLACEHOLDER_IMAGE;
    document.getElementById("productStoreInput").value = getMerchantContext().storeId || "";
    document.getElementById("productIdField").value = "";
  }

  modal.classList.add("open");
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("open");
}

async function handleProductSubmit(event) {
  event.preventDefault();
  if (!getAuthToken()) {
    showToast("Login required. Token not found.", "error");
    return;
  }

  const isEdit = Boolean(document.getElementById("productIdField").value);
  const productId = document.getElementById("productIdField").value;

  const productName = document.getElementById("productNameInput").value.trim();
  const description = document.getElementById("productDescriptionInput").value.trim();
  const typeId = document.getElementById("productTypeSelect").value;
  const storeId = document.getElementById("productStoreInput").value;
  const imageUrl = document.getElementById("productImageUrlInput").value.trim();
  const imageFile = document.getElementById("productImageFileInput").files?.[0];

  if (!productName || !typeId || !storeId) {
    showToast("Name, type, and store are required.", "error");
    return;
  }

  const formData = new FormData();
  formData.append("ProductName", productName);
  formData.append("TypeId", typeId);
  formData.append("StoreId", storeId);
  if (description) formData.append("ProductDescription", description);
  if (imageUrl) formData.append("ImageUrl", imageUrl);

  try {
    let createdProductId = productId;
    if (isEdit) {
      await apiRequest(API_CONFIG.endpoints.updateProduct(productId), {
        method: "PUT",
        body: formData,
      });
      showToast("Product updated.", "success");
    } else {
      const resp = await apiRequest(API_CONFIG.endpoints.createProduct(), {
        method: "POST",
        body: formData,
      });
      createdProductId =
        resp?.productId ||
        resp?.ProductId ||
        resp?.id ||
        resp?.ID ||
        resp?.data?.productId ||
        resp?.data?.id;
      showToast("Product created.", "success");
    }

    if (!isEdit && imageFile && createdProductId) {
      await uploadProductImages(createdProductId, [imageFile]);
    }

    closeModal("productModal");
    loadProducts();
  } catch (error) {
    console.error(error);
    if (error.status === 401) {
      showToast("Unauthorized. Please log in again.", "error");
    } else {
      showToast(`Failed to save product (${error.message}).`, "error");
    }
  }
}

async function uploadProductImages(productId, files) {
  const fd = new FormData();
  files.forEach((file) => fd.append("images", file));
  try {
    await apiRequest(API_CONFIG.endpoints.uploadProductImages(productId), {
      method: "POST",
      body: fd,
    });
    showToast("Image uploaded to S3.", "success");
  } catch (error) {
    console.error("Image upload failed", error);
    showToast(`Product created but image upload failed (${error.message}).`, "error");
  }
}

function attributeOptionsHtml() {
  if (!state.attributes.length) {
    return '<option value="">Enter attribute ID manually</option>';
  }
  return state.attributes
    .map((attr, index) => {
      const id = attr.attributeId || attr.id || attr.attributeID || attr.value || index + 1;
      const label = attr.name || attr.attributeName || attr || `Attribute ${id}`;
      return `<option value="${id}">${escapeHtml(label)}</option>`;
    })
    .join("");
}

function measureOptionsHtml() {
  if (!state.measures.length) {
    return '<option value="">Enter measure unit ID manually</option>';
  }
  return state.measures
    .map((measure, index) => {
      const id = measure.measureUnitId || measure.id || measure.measureId || measure.value || index + 1;
      const label = measure.name || measure.measureName || measure || `Measure ${id}`;
      return `<option value="${id}">${escapeHtml(label)}</option>`;
    })
    .join("");
}

function addAttributeRow(values = {}) {
  const wrapper = document.getElementById("detailAttributesWrapper");
  const row = document.createElement("div");
  row.className = "attribute-row";
  row.innerHTML = `
    <select class="attribute-select">
      <option value="">Select attribute</option>
      ${attributeOptionsHtml()}
    </select>
    <select class="measure-select">
      <option value="">Select measure unit</option>
      ${measureOptionsHtml()}
    </select>
    <button type="button" class="attribute-remove" aria-label="Remove attribute">×</button>
  `;
  wrapper.appendChild(row);

  if (values.attributeId) row.querySelector(".attribute-select").value = values.attributeId;
  if (values.measureUnitId) row.querySelector(".measure-select").value = values.measureUnitId;
}

function openProductDetailModal(detail = null) {
  if (!state.selectedProduct) {
    showToast("Select a product first.", "error");
    return;
  }

  const modal = document.getElementById("productDetailModal");
  const form = document.getElementById("addProductDetailForm");
  form.reset();
  document.getElementById("detailAttributesWrapper").innerHTML = "";

  const init = async () => {
    await ensureAttributeCatalogs();

    if (detail) {
      document.getElementById("detailModalTitle").textContent = "Edit variant";
      document.getElementById("productDetailIdField").value = getProductDetailId(detail);
      document.getElementById("detailSerialInput").value =
        detail.serialNumber || detail.SerialNumber || "";
      document.getElementById("detailPriceInput").value = detail.price || detail.Price || "";
      document.getElementById("detailQuantityInput").value =
        detail.quantityAvailable || detail.QuantityAvailable || "";
      document.getElementById("detailDescriptionInput").value =
        detail.description || detail.Description || "";
      const attributes = detail.attributes || detail.Attributes || [];
      if (Array.isArray(attributes) && attributes.length) {
        attributes.forEach((attr) => addAttributeRow(attr));
      } else {
        addAttributeRow();
      }
    } else {
      document.getElementById("detailModalTitle").textContent = "Add variant";
      document.getElementById("productDetailIdField").value = "";
      addAttributeRow();
    }

    modal.classList.add("open");
  };

  init();
}

async function editProductDetail(detailId) {
  try {
    const detail = await apiRequest(API_CONFIG.endpoints.productDetailById(detailId));
    openProductDetailModal(detail);
  } catch (error) {
    console.error(error);
    if (error.status === 401) {
      showToast("Unauthorized. Please log in again.", "error");
    } else {
      showToast(`Unable to load variant (${error.message}).`, "error");
    }
  }
}

async function handleProductDetailSubmit(event) {
  event.preventDefault();
  if (!state.selectedProduct) {
    showToast("Select a product first.", "error");
    return;
  }

  const productId = getProductId(state.selectedProduct);
  const detailId = document.getElementById("productDetailIdField").value;
  const serialNumber = document.getElementById("detailSerialInput").value.trim();
  const price = parseFloat(document.getElementById("detailPriceInput").value);
  const qty = parseInt(document.getElementById("detailQuantityInput").value, 10);
  const description = document.getElementById("detailDescriptionInput").value.trim();

  if (!serialNumber || Number.isNaN(price) || Number.isNaN(qty)) {
    showToast("Serial number, price, and quantity are required.", "error");
    return;
  }

  const attributes = Array.from(
    document.querySelectorAll("#detailAttributesWrapper .attribute-row"),
  )
    .map((row) => {
      const attrSelect = row.querySelector(".attribute-select");
      const measureSelect = row.querySelector(".measure-select");
      const attributeId = parseInt(attrSelect.value, 10);
      const measureUnitId = parseInt(measureSelect.value, 10);
      if (Number.isNaN(attributeId) || Number.isNaN(measureUnitId)) return null;
      return { attributeId, measureUnitId };
    })
    .filter(Boolean);

  const payload = {
    productId,
    serialNumber,
    price,
    quantityAvailable: qty,
  };

  if (description) payload.description = description;
  if (attributes.length) payload.attributes = attributes;
  if (detailId) payload.productDetailId = Number(detailId);

  try {
    await apiRequest(API_CONFIG.endpoints.productDetails(), {
      method: detailId ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    showToast(detailId ? "Variant updated." : "Variant created.", "success");
    closeModal("productDetailModal");
    loadProductDetails(productId);
  } catch (error) {
    console.error(error);
    if (error.status === 401) {
      showToast("Unauthorized. Please log in again.", "error");
    } else {
      showToast(`Failed to save variant (${error.message}).`, "error");
    }
  }
}

async function deleteProduct(productId) {
  if (!confirm("Delete this product? This cannot be undone.")) return;
  try {
    await apiRequest(API_CONFIG.endpoints.deleteProduct(productId), { method: "DELETE" });
    showToast("Product deleted.", "success");
    loadProducts();
  } catch (error) {
    console.error(error);
    showToast(`Failed to delete product (${error.message}).`, "error");
  }
}

async function deleteProductDetail(detailId) {
  if (!confirm("Delete this product variant?")) return;
  try {
    await apiRequest(API_CONFIG.endpoints.deleteProductDetail(detailId), { method: "DELETE" });
    showToast("Variant deleted.", "success");
    refreshSelectedProductDetails();
  } catch (error) {
    console.error(error);
    showToast(`Failed to delete variant (${error.message}).`, "error");
  }
}

function refreshSelectedProductDetails() {
  if (!state.selectedProduct) return;
  loadProductDetails(getProductId(state.selectedProduct));
}

function showInventory(detailId, detail) {
  state.selectedDetail = detail || { productDetailId: detailId };
  showSection("inventorySection");

  const variantName = detail?.serialNumber || detail?.SerialNumber || `Variant #${detailId}`;
  document.getElementById("inventoryHeaderName").textContent = variantName;
  loadInventory(state.selectedDetail);
}

async function loadInventory(detail) {
  const detailId = getProductDetailId(detail);
  const tbody = document.getElementById("inventoryTableBody");
  tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Loading inventory…</td></tr>`;

  try {
    const data = await apiRequest(API_CONFIG.endpoints.inventoryByDetail(detailId));
    state.inventoryRecord = data;
    renderInventory(data);
  } catch (error) {
    console.error(error);
    if (error.status === 401) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Unauthorized. Please log in again.</td></tr>`;
      showToast("Unauthorized. Please log in again.", "error");
    } else if (error.message.includes("404")) {
      renderInventory([]);
    } else {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-row">Unable to load inventory (${error.message}).</td></tr>`;
      showToast("Failed to load inventory.", "error");
    }
  }
}

function renderInventory(inventory) {
  const tbody = document.getElementById("inventoryTableBody");
  const emptyState = document.getElementById("inventoryEmptyState");

  const list = Array.isArray(inventory)
    ? inventory
    : inventory?.items
    ? inventory.items
    : inventory
    ? [inventory]
    : [];

  if (!list.length) {
    tbody.innerHTML = "";
    emptyState.classList.remove("hidden");
    updateInventorySummary(null);
    return;
  }

  emptyState.classList.add("hidden");

  const inv = list[0];
  const available = inv.quantityAvailable || inv.QuantityAvailable || 0;
  const reserved = inv.quantityReserved || inv.QuantityReserved || 0;
  updateInventorySummary({ available, reserved });

  const created = inv.createdDate || inv.CreatedDate || inv.createdAt;
  const createdLabel = created ? new Date(created).toLocaleString() : "—";

  tbody.innerHTML = `
    <tr>
      <td>1</td>
      <td><div class="muted">Quantity-based inventory</div></td>
      <td>${createdLabel}</td>
      <td>
        <span class="badge success">Available: ${available}</span>
        <span class="badge warning">Reserved: ${reserved}</span>
      </td>
      <td>
        <button class="btn" type="button" onclick="document.getElementById('inventoryQuantityInput').focus()">Adjust</button>
      </td>
    </tr>
  `;
}

function updateInventorySummary(data) {
  if (!data) {
    document.getElementById("inventoryTotal").textContent = "0";
    document.getElementById("inventoryAvailable").textContent = "0";
    document.getElementById("inventoryReserved").textContent = "0";
    return;
  }
  const total = Number(data.available || 0) + Number(data.reserved || 0);
  document.getElementById("inventoryTotal").textContent = total;
  document.getElementById("inventoryAvailable").textContent = data.available || 0;
  document.getElementById("inventoryReserved").textContent = data.reserved || 0;
}

async function handleInventorySubmit(event) {
  event.preventDefault();
  if (!state.selectedDetail) {
    showToast("Open a variant inventory first.", "error");
    return;
  }

  const newQuantity = parseInt(document.getElementById("inventoryQuantityInput").value, 10);
  if (Number.isNaN(newQuantity) || newQuantity < 0) {
    showToast("Enter a valid quantity.", "error");
    return;
  }

  const detailId = getProductDetailId(state.selectedDetail);
  try {
    await apiRequest(API_CONFIG.endpoints.inventoryStock(detailId), {
      method: "PUT",
      body: JSON.stringify({ newQuantity }),
    });
    showToast("Quantity updated.", "success");
    document.getElementById("inventoryQuantityInput").value = "";
    loadInventory(state.selectedDetail);
  } catch (error) {
    console.error(error);
    if (error.status === 401) {
      showToast("Unauthorized. Please log in again.", "error");
    } else {
      showToast(`Unable to update stock (${error.message}).`, "error");
    }
  }
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("hide");
    toast.addEventListener("transitionend", () => toast.remove());
    toast.remove();
  }, 3500);
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function formatCurrency(amount) {
  const value = Number(amount);
  if (Number.isNaN(value)) return amount;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}

window.MerchantProducts = {
  refresh: loadProducts,
};
