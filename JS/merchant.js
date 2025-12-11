// merchant.js - Cartify Merchant Dashboard
(function () {
  'use strict';

  // ==================== CONFIGURATION ====================
  const API_BASE_URL = "https://cartify.runasp.net";

  const endpoints = {
    // Product endpoints
    productsList: (merchantId, page, pageSize) => `/api/merchant/products/merchant/${merchantId}?page=${page}&pageSize=${pageSize}`,
    productById: (id) => `/api/merchant/products/${id}`,
    productCreate: () => `/api/merchant/products`,
    productUpdate: (id) => `/api/merchant/products/${id}`,
    productDelete: (id) => `/api/merchant/products/${id}`,
    productSearch: (name, page, pageSize) => `/api/merchant/products/search?name=${encodeURIComponent(name)}&page=${page}&pageSize=${pageSize}`,
    productUploadImages: (productId) => `/api/merchant/products/${productId}/images`,

    // Product Details (Variants) endpoints
    productDetailById: (detailId) => `/api/merchant/products/details/${detailId}`,
    productDetailCreate: () => `/api/merchant/products/details`,
    productDetailUpdate: () => `/api/merchant/products/details`,
    productDetailDelete: (detailId) => `/api/merchant/products/details/${detailId}`,

    // Inventory endpoints
    inventoryByDetailId: (productDetailId) => `/api/merchant/inventory/product-detail/${productDetailId}`,
    inventoryUpdateStock: (productDetailId) => `/api/merchant/inventory/product-detail/${productDetailId}/stock`,
    inventoryByStore: (storeId, page, pageSize) => `/api/merchant/inventory/store/${storeId}?page=${page}&pageSize=${pageSize}`,

    // Subcategory endpoints
    subcategories: () => `/api/Category/subcategory`,

    // Attributes & Measures endpoints
    attributesList: () => `/api/merchant/attributes-measures/attributes`,
    measuresList: () => `/api/merchant/attributes-measures/measures`
  };

  // ==================== STATE MANAGEMENT ====================
  let currentView = 'products';
  let currentProduct = null;
  let currentProductDetail = null;
  let subcategories = [];
  let attributes = [];
  let measures = [];

  // ==================== HELPER FUNCTIONS ====================
  function getAuthToken() {
    try {
      let authString = localStorage.getItem('Auth') || sessionStorage.getItem('Auth');
      if (!authString) return '';
      const authData = JSON.parse(authString);
      return authData?.jwt || authData?.token || '';
    } catch (error) {
      console.error('Error retrieving auth token:', error);
      return '';
    }
  }

  function getMerchantId() {
    try {
      let authString = localStorage.getItem('Auth') || sessionStorage.getItem('Auth');
      if (!authString) return null;
      const authData = JSON.parse(authString);
      return authData?.userId || authData?.merchantId || null;
    } catch (error) {
      console.error('Error retrieving merchant ID:', error);
      return null;
    }
  }

  function getStoreId() {
    return localStorage.getItem('storeId') || sessionStorage.getItem('storeId') || '1';
  }

  // ==================== API HELPER FUNCTIONS ====================
  async function apiGet(path) {
    const token = getAuthToken();
    const response = await fetch(API_BASE_URL + path, {
      method: 'GET',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Request failed');
    }

    return await response.json();
  }

  async function apiPost(path, body) {
    const token = getAuthToken();
    const response = await fetch(API_BASE_URL + path, {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Request failed');
    }

    return await response.json();
  }

  async function apiPostFormData(path, formData) {
    const token = getAuthToken();
    const response = await fetch(API_BASE_URL + path, {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Request failed');
    }

    return await response.json();
  }

  async function apiPut(path, body) {
    const token = getAuthToken();
    const response = await fetch(API_BASE_URL + path, {
      method: 'PUT',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Request failed');
    }

    return await response.json();
  }

  async function apiPutFormData(path, formData) {
    const token = getAuthToken();
    const response = await fetch(API_BASE_URL + path, {
      method: 'PUT',
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Request failed');
    }

    return await response.json();
  }

  async function apiDelete(path) {
    const token = getAuthToken();
    const response = await fetch(API_BASE_URL + path, {
      method: 'DELETE',
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Request failed');
    }

    return true;
  }

  async function apiUpload(path, file) {
    const formData = new FormData();
    formData.append('images', file);
    return await apiPostFormData(path, formData);
  }

  // ==================== UI HELPER FUNCTIONS ====================
  function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    notification.style.zIndex = '9999';
    notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 4000);
  }

  function showLoading(element) {
    element.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;
  }

  function showError(element, message) {
    element.innerHTML = `
            <div class="alert alert-danger m-3">
                <i class="bi bi-exclamation-triangle me-2"></i>${message}
            </div>
        `;
  }

  function showConfirmModal(title, message, onConfirm) {
    const modalHTML = `
            <div class="modal fade" id="confirmModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header bg-warning">
                            <h5 class="modal-title"><i class="bi bi-exclamation-triangle me-2"></i>${title}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body"><p>${message}</p></div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-danger" id="confirmBtn">Confirm</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
    modal.show();

    document.getElementById('confirmBtn').addEventListener('click', () => {
      onConfirm();
      modal.hide();
    });

    document.getElementById('confirmModal').addEventListener('hidden.bs.modal', () => {
      document.getElementById('confirmModal').remove();
    });
  }

  // ==================== PRODUCTS VIEW ====================
  async function renderProductsView() {
    const mainContent = document.getElementById('dynamicContentContainer');
    if (!mainContent) {
      console.error('Main content container not found');
      return;
    }

    showLoading(mainContent);

    try {
      // Load subcategories first
      if (subcategories.length === 0) {
        subcategories = await apiGet(endpoints.subcategories());
      }

      mainContent.innerHTML = `
                <div class="products-view">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h2><i class="bi bi-box-seam me-2"></i>Products</h2>
                        <button class="btn btn-primary" id="addProductBtn">
                            <i class="bi bi-plus-circle me-2"></i>Add Product
                        </button>
                    </div>
                    
                    <div class="card mb-4">
                        <div class="card-body">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <input type="text" class="form-control" id="searchProduct" 
                                           placeholder="Search products by name...">
                                </div>
                                <div class="col-md-3">
                                    <select class="form-select" id="filterSubcategory">
                                        <option value="">All Categories</option>
                                    </select>
                                </div>
                                <div class="col-md-3">
                                    <button class="btn btn-secondary w-100" id="searchBtn">
                                        <i class="bi bi-search me-2"></i>Search
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div id="productsContainer"></div>
                </div>
            `;

      // Populate subcategory filter
      const filterSelect = document.getElementById('filterSubcategory');
      subcategories.forEach(sub => {
        const option = document.createElement('option');
        option.value = sub.subCategoryId;
        option.textContent = sub.subCategoryName;
        filterSelect.appendChild(option);
      });

      // Event listeners
      document.getElementById('addProductBtn').addEventListener('click', showAddProductModal);
      document.getElementById('searchBtn').addEventListener('click', searchProducts);
      document.getElementById('searchProduct').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') searchProducts();
      });

      // Load products
      await loadProducts();
    } catch (error) {
      showError(mainContent, 'Failed to load products: ' + error.message);
    }
  }

  async function loadProducts(page = 1, pageSize = 10) {
    const container = document.getElementById('productsContainer');
    if (!container) return;

    showLoading(container);

    try {
      const merchantId = getMerchantId();
      if (!merchantId) {
        throw new Error('Merchant ID not found');
      }

      const products = await apiGet(endpoints.productsList(merchantId, page, pageSize));

      if (!products || products.length === 0) {
        container.innerHTML = `
                    <div class="text-center p-5">
                        <i class="bi bi-inbox" style="font-size: 3rem; color: #ccc;"></i>
                        <p class="text-muted mt-3">No products found</p>
                    </div>
                `;
        return;
      }

      container.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>Image</th>
                                <th>Name</th>
                                <th>Description</th>
                                <th>Category</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="productsTableBody"></tbody>
                    </table>
                </div>
            `;

      const tbody = document.getElementById('productsTableBody');
      products.forEach(product => {
        const row = document.createElement('tr');
        const imageUrl = product.imageUrl || 'images/placeholder.png';
        const subcategoryName = subcategories.find(s => s.subCategoryId === product.typeId)?.subCategoryName || 'N/A';

        row.innerHTML = `
                    <td><img src="${imageUrl}" alt="${product.productName}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;"></td>
                    <td>${product.productName}</td>
                    <td>${product.productDescription || 'N/A'}</td>
                    <td><span class="badge bg-info">${subcategoryName}</span></td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="window.viewProductDetails(${product.productId})">
                            <i class="bi bi-eye"></i> Details
                        </button>
                        <button class="btn btn-sm btn-warning" onclick="window.editProduct(${product.productId})">
                            <i class="bi bi-pencil"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="window.deleteProduct(${product.productId})">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </td>
                `;
        tbody.appendChild(row);
      });
    } catch (error) {
      showError(container, 'Failed to load products: ' + error.message);
    }
  }

  async function searchProducts() {
    const searchTerm = document.getElementById('searchProduct').value.trim();

    if (!searchTerm) {
      await loadProducts();
      return;
    }

    const container = document.getElementById('productsContainer');
    showLoading(container);

    try {
      const products = await apiGet(endpoints.productSearch(searchTerm, 1, 10));

      if (!products || products.length === 0) {
        container.innerHTML = `
                    <div class="text-center p-5">
                        <i class="bi bi-search" style="font-size: 3rem; color: #ccc;"></i>
                        <p class="text-muted mt-3">No products found matching "${searchTerm}"</p>
                    </div>
                `;
        return;
      }

      // Render products (same as loadProducts)
      container.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>Image</th>
                                <th>Name</th>
                                <th>Description</th>
                                <th>Category</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="productsTableBody"></tbody>
                    </table>
                </div>
            `;

      const tbody = document.getElementById('productsTableBody');
      products.forEach(product => {
        const row = document.createElement('tr');
        const imageUrl = product.imageUrl || 'images/placeholder.png';
        const subcategoryName = subcategories.find(s => s.subCategoryId === product.typeId)?.subCategoryName || 'N/A';

        row.innerHTML = `
                    <td><img src="${imageUrl}" alt="${product.productName}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;"></td>
                    <td>${product.productName}</td>
                    <td>${product.productDescription || 'N/A'}</td>
                    <td><span class="badge bg-info">${subcategoryName}</span></td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="window.viewProductDetails(${product.productId})">
                            <i class="bi bi-eye"></i> Details
                        </button>
                        <button class="btn btn-sm btn-warning" onclick="window.editProduct(${product.productId})">
                            <i class="bi bi-pencil"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="window.deleteProduct(${product.productId})">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </td>
                `;
        tbody.appendChild(row);
      });
    } catch (error) {
      showError(container, 'Search failed: ' + error.message);
    }
  }

  function showAddProductModal() {
    const modalHTML = `
            <div class="modal fade" id="productModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="bi bi-plus-circle me-2"></i>Add Product</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="productForm">
                                <div class="mb-3">
                                    <label for="productName" class="form-label">Product Name <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="productName" required>
                                </div>
                                <div class="mb-3">
                                    <label for="productDescription" class="form-label">Description</label>
                                    <textarea class="form-control" id="productDescription" rows="3"></textarea>
                                </div>
                                <div class="mb-3">
                                    <label for="subcategory" class="form-label">Category <span class="text-danger">*</span></label>
                                    <select class="form-select" id="subcategory" required>
                                        <option value="">Choose Category</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label for="productImage" class="form-label">Product Image</label>
                                    <input type="file" class="form-control" id="productImage" accept="image/*">
                                    <div id="imagePreview" class="mt-2"></div>
                                    <input type="hidden" id="imageUrl">
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="saveProductBtn">
                                <i class="bi bi-save me-2"></i>Save Product
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('productModal'));
    modal.show();

    // Populate subcategories
    const subcategorySelect = document.getElementById('subcategory');
    subcategories.forEach(sub => {
      const option = document.createElement('option');
      option.value = sub.subCategoryId;
      option.textContent = sub.subCategoryName;
      subcategorySelect.appendChild(option);
    });

    // Image upload handler
    document.getElementById('productImage').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Show preview
      const preview = document.getElementById('imagePreview');
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.innerHTML = `<img src="${e.target.result}" style="max-width: 200px; max-height: 200px;" class="img-thumbnail">`;
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('saveProductBtn').addEventListener('click', async () => {
      await saveProduct(modal);
    });

    document.getElementById('productModal').addEventListener('hidden.bs.modal', () => {
      document.getElementById('productModal').remove();
    });
  }

  async function saveProduct(modal) {
    const btn = document.getElementById('saveProductBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    try {
      const formData = new FormData();
      formData.append('ProductName', document.getElementById('productName').value);
      formData.append('ProductDescription', document.getElementById('productDescription').value || '');
      formData.append('TypeId', document.getElementById('subcategory').value);
      formData.append('StoreId', getStoreId());

      const product = await apiPostFormData(endpoints.productCreate(), formData);

      // Upload image if selected
      const imageFile = document.getElementById('productImage').files[0];
      if (imageFile && product.productId) {
        await apiUpload(endpoints.productUploadImages(product.productId), imageFile);
      }

      showNotification('Product created successfully!', 'success');
      modal.hide();
      await loadProducts();
    } catch (error) {
      showNotification('Failed to create product: ' + error.message, 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-save me-2"></i>Save Product';
    }
  }

  window.editProduct = async function (productId) {
    try {
      const product = await apiGet(endpoints.productById(productId));

      const modalHTML = `
                <div class="modal fade" id="productModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title"><i class="bi bi-pencil me-2"></i>Edit Product</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <form id="productForm">
                                    <div class="mb-3">
                                        <label for="productName" class="form-label">Product Name <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="productName" value="${product.productName}" required>
                                    </div>
                                    <div class="mb-3">
                                        <label for="productDescription" class="form-label">Description</label>
                                        <textarea class="form-control" id="productDescription" rows="3">${product.productDescription || ''}</textarea>
                                    </div>
                                    <div class="mb-3">
                                        <label for="subcategory" class="form-label">Category <span class="text-danger">*</span></label>
                                        <select class="form-select" id="subcategory" required>
                                            <option value="">Choose Category</option>
                                        </select>
                                    </div>
                                    <div class="mb-3">
                                        <label for="productImage" class="form-label">Product Image (Optional - to change)</label>
                                        <input type="file" class="form-control" id="productImage" accept="image/*">
                                        <div id="imagePreview" class="mt-2"></div>
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="button" class="btn btn-primary" id="saveProductBtn">
                                    <i class="bi bi-save me-2"></i>Update Product
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

      document.body.insertAdjacentHTML('beforeend', modalHTML);
      const modal = new bootstrap.Modal(document.getElementById('productModal'));
      modal.show();

      // Populate subcategories
      const subcategorySelect = document.getElementById('subcategory');
      subcategories.forEach(sub => {
        const option = document.createElement('option');
        option.value = sub.subCategoryId;
        option.textContent = sub.subCategoryName;
        if (sub.subCategoryId === product.typeId) {
          option.selected = true;
        }
        subcategorySelect.appendChild(option);
      });

      // Image upload handler
      document.getElementById('productImage').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const preview = document.getElementById('imagePreview');
        const reader = new FileReader();
        reader.onload = (e) => {
          preview.innerHTML = `<img src="${e.target.result}" style="max-width: 200px; max-height: 200px;" class="img-thumbnail">`;
        };
        reader.readAsDataURL(file);
      });

      document.getElementById('saveProductBtn').addEventListener('click', async () => {
        const btn = document.getElementById('saveProductBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Updating...';

        try {
          const formData = new FormData();
          formData.append('ProductName', document.getElementById('productName').value);
          formData.append('ProductDescription', document.getElementById('productDescription').value || '');
          formData.append('TypeId', document.getElementById('subcategory').value);

          const imageFile = document.getElementById('productImage').files[0];
          if (imageFile) {
            formData.append('NewImages', imageFile);
          }

          await apiPutFormData(endpoints.productUpdate(productId), formData);

          showNotification('Product updated successfully!', 'success');
          modal.hide();
          await loadProducts();
        } catch (error) {
          showNotification('Failed to update product: ' + error.message, 'danger');
        } finally {
          btn.disabled = false;
          btn.innerHTML = '<i class="bi bi-save me-2"></i>Update Product';
        }
      });

      document.getElementById('productModal').addEventListener('hidden.bs.modal', () => {
        document.getElementById('productModal').remove();
      });
    } catch (error) {
      showNotification('Failed to load product: ' + error.message, 'danger');
    }
  };

  window.deleteProduct = async function (productId) {
    showConfirmModal(
      'Delete Product',
      'Are you sure you want to delete this product? This action cannot be undone.',
      async () => {
        try {
          await apiDelete(endpoints.productDelete(productId));
          showNotification('Product deleted successfully!', 'success');
          await loadProducts();
        } catch (error) {
          showNotification('Failed to delete product: ' + error.message, 'danger');
        }
      }
    );
  };

  // ==================== PRODUCT DETAILS (VARIANTS) VIEW ====================
  window.viewProductDetails = async function (productId) {
    const mainContent = document.getElementById('dynamicContentContainer');
    if (!mainContent) return;

    showLoading(mainContent);

    try {
      const product = await apiGet(endpoints.productById(productId));
      currentProduct = product;

      mainContent.innerHTML = `
                <div class="product-details-view">
                    <nav aria-label="breadcrumb">
                        <ol class="breadcrumb">
                            <li class="breadcrumb-item"><a href="#" onclick="window.renderProductsView()">Products</a></li>
                            <li class="breadcrumb-item active">${product.productName}</li>
                        </ol>
                    </nav>
                    
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h2><i class="bi bi-tags me-2"></i>Product Variants</h2>
                        <button class="btn btn-primary" id="addVariantBtn">
                            <i class="bi bi-plus-circle me-2"></i>Add Variant
                        </button>
                    </div>
                    
                    <div class="card mb-4">
                        <div class="card-body">
                            <h5>${product.productName}</h5>
                            <p class="text-muted">${product.productDescription || 'No description'}</p>
                        </div>
                    </div>
                    
                    <div id="variantsContainer"></div>
                </div>
            `;

      document.getElementById('addVariantBtn').addEventListener('click', () => showAddVariantModal(productId));

      await loadProductVariants(productId);
    } catch (error) {
      showError(mainContent, 'Failed to load product details: ' + error.message);
    }
  };

  window.renderProductsView = renderProductsView;

  async function loadProductVariants(productId) {
    const container = document.getElementById('variantsContainer');
    if (!container) return;

    showLoading(container);

    try {
      const product = await apiGet(endpoints.productById(productId));
      const variants = product.productDetails || [];

      if (variants.length === 0) {
        container.innerHTML = `
                    <div class="text-center p-5">
                        <i class="bi bi-inbox" style="font-size: 3rem; color: #ccc;"></i>
                        <p class="text-muted mt-3">No variants found</p>
                    </div>
                `;
        return;
      }

      container.innerHTML = `
                <div class="row g-3">
                    ${variants.map(variant => `
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-body">
                                    <h6>Serial: ${variant.serialNumber}</h6>
                                    <p class="mb-2"><strong>Price:</strong> $${variant.price}</p>
                                    <p class="mb-2"><strong>Quantity:</strong> ${variant.quantityAvailable}</p>
                                    <p class="mb-2"><strong>Description:</strong> ${variant.description || 'N/A'}</p>
                                    ${variant.attributes && variant.attributes.length > 0 ? `
                                        <p class="mb-2"><strong>Attributes:</strong></p>
                                        <div class="d-flex flex-wrap gap-1">
                                            ${variant.attributes.map(attr => `
                                                <span class="badge bg-secondary">${attr.attributeName || 'Attr'}</span>
                                            `).join('')}
                                        </div>
                                    ` : ''}
                                    <div class="mt-3">
                                        <button class="btn btn-sm btn-info" onclick="window.viewInventory(${variant.productDetailId})">
                                            <i class="bi bi-clipboard-data"></i> Inventory
                                        </button>
                                        <button class="btn btn-sm btn-warning" onclick="window.editVariant(${variant.productDetailId})">
                                            <i class="bi bi-pencil"></i> Edit
                                        </button>
                                        <button class="btn btn-sm btn-danger" onclick="window.deleteVariant(${variant.productDetailId})">
                                            <i class="bi bi-trash"></i> Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
    } catch (error) {
      showError(container, 'Failed to load variants: ' + error.message);
    }
  }

  function showAddVariantModal(productId) {
    const modalHTML = `
            <div class="modal fade" id="variantModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="bi bi-plus-circle me-2"></i>Add Product Variant</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="variantForm">
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">Serial Number <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="serialNumber" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Price <span class="text-danger">*</span></label>
                                        <input type="number" class="form-control" id="price" step="0.01" min="0.01" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Quantity Available <span class="text-danger">*</span></label>
                                        <input type="number" class="form-control" id="quantityAvailable" min="0" required>
                                    </div>
                                    <div class="col-md-12">
                                        <label class="form-label">Description</label>
                                        <textarea class="form-control" id="variantDescription" rows="2"></textarea>
                                    </div>
                                </div>
                                
                                <hr>
                                <h6>Attributes (Optional)</h6>
                                <div id="attributesContainer">
                                    <div class="attribute-row row g-2 mb-2">
                                        <div class="col-md-5">
                                            <input type="number" class="form-control" placeholder="Attribute ID">
                                        </div>
                                        <div class="col-md-5">
                                            <input type="number" class="form-control" placeholder="Measure Unit ID">
                                        </div>
                                        <div class="col-md-2">
                                            <button type="button" class="btn btn-sm btn-danger remove-attr">
                                                <i class="bi bi-x"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <button type="button" class="btn btn-sm btn-secondary" id="addAttributeRowBtn">
                                    <i class="bi bi-plus"></i> Add Attribute
                                </button>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="saveVariantBtn">
                                <i class="bi bi-save me-2"></i>Save Variant
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('variantModal'));
    modal.show();

    document.getElementById('addAttributeRowBtn').addEventListener('click', () => {
      const newRow = document.createElement('div');
      newRow.className = 'attribute-row row g-2 mb-2';
      newRow.innerHTML = `
                <div class="col-md-5">
                    <input type="number" class="form-control" placeholder="Attribute ID">
                </div>
                <div class="col-md-5">
                    <input type="number" class="form-control" placeholder="Measure Unit ID">
                </div>
                <div class="col-md-2">
                    <button type="button" class="btn btn-sm btn-danger remove-attr">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
            `;
      document.getElementById('attributesContainer').appendChild(newRow);
    });

    document.getElementById('attributesContainer').addEventListener('click', (e) => {
      if (e.target.closest('.remove-attr')) {
        e.target.closest('.attribute-row').remove();
      }
    });

    document.getElementById('saveVariantBtn').addEventListener('click', async () => {
      await saveVariant(modal, productId);
    });

    document.getElementById('variantModal').addEventListener('hidden.bs.modal', () => {
      document.getElementById('variantModal').remove();
    });
  }

  async function saveVariant(modal, productId) {
    const btn = document.getElementById('saveVariantBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    try {
      const attributes = [];
      document.querySelectorAll('.attribute-row').forEach(row => {
        const inputs = row.querySelectorAll('input');
        const attrId = parseInt(inputs[0].value);
        const measureId = parseInt(inputs[1].value);
        if (attrId && measureId) {
          attributes.push({
            attributeId: attrId,
            measureUnitId: measureId
          });
        }
      });

      const variantData = {
        productId: parseInt(productId),
        serialNumber: document.getElementById('serialNumber').value,
        price: parseFloat(document.getElementById('price').value),
        quantityAvailable: parseInt(document.getElementById('quantityAvailable').value),
        description: document.getElementById('variantDescription').value || null,
        attributes: attributes.length > 0 ? attributes : null
      };

      await apiPost(endpoints.productDetailCreate(), variantData);
      showNotification('Variant created successfully!', 'success');
      modal.hide();
      await loadProductVariants(productId);
    } catch (error) {
      showNotification('Failed to create variant: ' + error.message, 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-save me-2"></i>Save Variant';
    }
  }

  window.editVariant = async function (variantId) {
    try {
      const variant = await apiGet(endpoints.productDetailById(variantId));

      const modalHTML = `
                <div class="modal fade" id="variantModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title"><i class="bi bi-pencil me-2"></i>Edit Product Variant</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <form id="variantForm">
                                    <div class="row g-3">
                                        <div class="col-md-6">
                                            <label class="form-label">Price</label>
                                            <input type="number" class="form-control" id="price" step="0.01" min="0.01" value="${variant.price}">
                                        </div>
                                        <div class="col-md-6">
                                            <label class="form-label">Quantity Available</label>
                                            <input type="number" class="form-control" id="quantityAvailable" min="0" value="${variant.quantityAvailable}">
                                        </div>
                                        <div class="col-md-12">
                                            <label class="form-label">Description</label>
                                            <textarea class="form-control" id="variantDescription" rows="2">${variant.description || ''}</textarea>
                                        </div>
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="button" class="btn btn-primary" id="saveVariantBtn">
                                    <i class="bi bi-save me-2"></i>Update Variant
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

      document.body.insertAdjacentHTML('beforeend', modalHTML);
      const modal = new bootstrap.Modal(document.getElementById('variantModal'));
      modal.show();

      document.getElementById('saveVariantBtn').addEventListener('click', async () => {
        const btn = document.getElementById('saveVariantBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Updating...';

        try {
          const updateData = {
            productDetailId: variantId,
            price: parseFloat(document.getElementById('price').value) || null,
            quantityAvailable: parseInt(document.getElementById('quantityAvailable').value) || null,
            description: document.getElementById('variantDescription').value || null,
            attributes: null
          };

          await apiPut(endpoints.productDetailUpdate(), updateData);
          showNotification('Variant updated successfully!', 'success');
          modal.hide();
          await loadProductVariants(currentProduct.productId);
        } catch (error) {
          showNotification('Failed to update variant: ' + error.message, 'danger');
        } finally {
          btn.disabled = false;
          btn.innerHTML = '<i class="bi bi-save me-2"></i>Update Variant';
        }
      });

      document.getElementById('variantModal').addEventListener('hidden.bs.modal', () => {
        document.getElementById('variantModal').remove();
      });
    } catch (error) {
      showNotification('Failed to load variant: ' + error.message, 'danger');
    }
  };

  window.deleteVariant = async function (variantId) {
    showConfirmModal(
      'Delete Variant',
      'Are you sure you want to delete this variant?',
      async () => {
        try {
          await apiDelete(endpoints.productDetailDelete(variantId));
          showNotification('Variant deleted successfully!', 'success');
          await loadProductVariants(currentProduct.productId);
        } catch (error) {
          showNotification('Failed to delete variant: ' + error.message, 'danger');
        }
      }
    );
  };

  // ==================== INVENTORY VIEW ====================
  window.viewInventory = async function (productDetailId) {
    const mainContent = document.getElementById('dynamicContentContainer');
    if (!mainContent) return;

    showLoading(mainContent);

    try {
      const inventory = await apiGet(endpoints.inventoryByDetailId(productDetailId));
      currentProductDetail = { productDetailId };

      mainContent.innerHTML = `
                <div class="inventory-view">
                    <nav aria-label="breadcrumb">
                        <ol class="breadcrumb">
                            <li class="breadcrumb-item"><a href="#" onclick="window.renderProductsView()">Products</a></li>
                            <li class="breadcrumb-item"><a href="#" onclick="window.viewProductDetails(${currentProduct?.productId})">Variants</a></li>
                            <li class="breadcrumb-item active">Inventory</li>
                        </ol>
                    </nav>
                    
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h2><i class="bi bi-clipboard-data me-2"></i>Inventory Management</h2>
                        <button class="btn btn-primary" id="updateStockBtn">
                            <i class="bi bi-box-arrow-up me-2"></i>Update Stock
                        </button>
                    </div>
                    
                    <div class="card">
                        <div class="card-body">
                            <h5>Current Stock Level</h5>
                            <p class="display-6">${inventory.quantityAvailable || 0} units</p>
                        </div>
                    </div>
                </div>
            `;

      document.getElementById('updateStockBtn').addEventListener('click', () => showUpdateStockModal(productDetailId));
    } catch (error) {
      showError(mainContent, 'Failed to load inventory: ' + error.message);
    }
  };

  function showUpdateStockModal(productDetailId) {
    const modalHTML = `
            <div class="modal fade" id="stockModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="bi bi-box-arrow-up me-2"></i>Update Stock</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="stockForm">
                                <div class="mb-3">
                                    <label class="form-label">New Quantity <span class="text-danger">*</span></label>
                                    <input type="number" class="form-control" id="newQuantity" min="0" required>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="saveStockBtn">
                                <i class="bi bi-save me-2"></i>Update Stock
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('stockModal'));
    modal.show();

    document.getElementById('saveStockBtn').addEventListener('click', async () => {
      const btn = document.getElementById('saveStockBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Updating...';

      try {
        const newQuantity = parseInt(document.getElementById('newQuantity').value);
        await apiPut(endpoints.inventoryUpdateStock(productDetailId), { newQuantity });
        showNotification('Stock updated successfully!', 'success');
        modal.hide();
        await window.viewInventory(productDetailId);
      } catch (error) {
        showNotification('Failed to update stock: ' + error.message, 'danger');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-save me-2"></i>Update Stock';
      }
    });

    document.getElementById('stockModal').addEventListener('hidden.bs.modal', () => {
      document.getElementById('stockModal').remove();
    });
  }

  // ==================== NAVIGATION ====================
  function initNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', async (e) => {
        const href = link.getAttribute('href');

        // Allow navigation to actual HTML pages
        if (href && href.endsWith('.html')) {
          return;
        }

        e.preventDefault();
        const target = link.getAttribute('data-target');

        // Update active state
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        // Render view
        switch (target) {
          case 'Products':
            await renderProductsView();
            break;
          case 'Dashboard':
            renderDashboard();
            break;
          case 'Orders':
            renderOrders();
            break;
          case 'Inventory':
            renderInventoryOverview();
            break;
          case 'Customer':
            renderCustomers();
            break;
          case 'Category':
            renderCategories();
            break;
          case 'Subcategory':
            renderSubcategories();
            break;
          case 'AttributeMeasure':
            renderAttributeMeasure();
            break;
          default:
            console.log('View not implemented:', target);
        }
      });
    });
  }

  function renderDashboard() {
    const mainContent = document.getElementById('dynamicContentContainer');
    if (!mainContent) return;

    mainContent.innerHTML = `
            <div class="dashboard-view">
                <h2><i class="bi bi-speedometer2 me-2"></i>Dashboard</h2>
                <p class="text-muted">Welcome to your merchant dashboard</p>
            </div>
        `;
  }

  function renderOrders() {
    const mainContent = document.getElementById('dynamicContentContainer');
    if (!mainContent) return;

    mainContent.innerHTML = `
            <div class="orders-view">
                <h2><i class="bi bi-cart-check me-2"></i>Orders</h2>
                <p class="text-muted">Manage your orders here</p>
            </div>
        `;
  }

  function renderInventoryOverview() {
    const mainContent = document.getElementById('dynamicContentContainer');
    if (!mainContent) return;

    mainContent.innerHTML = `
            <div class="inventory-overview-view">
                <h2><i class="bi bi-clipboard-data me-2"></i>Inventory Overview</h2>
                <p class="text-muted">View overall inventory status</p>
            </div>
        `;
  }

  function renderCustomers() {
    const mainContent = document.getElementById('dynamicContentContainer');
    if (!mainContent) return;

    mainContent.innerHTML = `
            <div class="customers-view">
                <h2><i class="bi bi-people me-2"></i>Customers</h2>
                <p class="text-muted">Manage your customers</p>
            </div>
        `;
  }

  function renderCategories() {
    const mainContent = document.getElementById('dynamicContentContainer');
    if (!mainContent) return;

    mainContent.innerHTML = `
            <div class="categories-view">
                <h2><i class="bi bi-folder me-2"></i>Categories</h2>
                <p class="text-muted">Manage product categories</p>
            </div>
        `;
  }

  function renderSubcategories() {
    const mainContent = document.getElementById('dynamicContentContainer');
    if (!mainContent) return;

    mainContent.innerHTML = `
            <div class="subcategories-view">
                <h2><i class="bi bi-folder2 me-2"></i>Subcategories</h2>
                <p class="text-muted">Manage product subcategories</p>
            </div>
        `;
  }

  function renderAttributeMeasure() {
    const mainContent = document.getElementById('dynamicContentContainer');
    if (!mainContent) return;

    mainContent.innerHTML = `
            <div class="attribute-measure-view">
                <h2><i class="bi bi-tags me-2"></i>Attributes & Measures</h2>
                <p class="text-muted">Manage product attributes and measure units</p>
            </div>
        `;
  }

  // ==================== LOGOUT ====================
  function initLogout() {
    const logoutBtn = document.getElementById('logout1');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('Auth');
        sessionStorage.removeItem('Auth');
        window.location.href = 'login.html';
      });
    }
  }

  // ==================== INITIALIZATION ====================
  function init() {
    console.log('Initializing Merchant Dashboard...');
    initNavigation();
    initLogout();

    // Load initial view based on active nav
    const activeNav = document.querySelector('.nav-link.active');
    if (activeNav) {
      const target = activeNav.getAttribute('data-target');
      if (target === 'Products') {
        renderProductsView();
      } else if (target === 'Dashboard') {
        renderDashboard();
      }
    } else {
      renderDashboard();
    }
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();