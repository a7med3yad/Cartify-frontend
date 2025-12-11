// Shared utilities for Cartify merchant pages (products & product details)
(function () {
  const API_ROOT = 'https://cartify.runasp.net/api';
  const ENDPOINTS = {
    products: `${API_ROOT}/merchant/products`,
    productDetails: `${API_ROOT}/merchant/products/details`,
    attributes: `${API_ROOT}/merchant/attributes-measures/attributes`,
    measures: `${API_ROOT}/merchant/attributes-measures/measures`,
    subcategories: `${API_ROOT}/Category/subcategory`,
    productDetailsByProduct: (productId) => `${API_ROOT}/merchant/products/${productId}/details`
  };

  const getAuthToken = () => {
    try {
      const auth = JSON.parse(localStorage.getItem('Auth') || sessionStorage.getItem('Auth') || '{}');
      return auth.jwt || auth.token || null;
    } catch (e) {
      return null;
    }
  };

  const getStoreId = () => {
    try {
      const auth = JSON.parse(localStorage.getItem('Auth') || sessionStorage.getItem('Auth') || '{}');
      return auth.storeId || auth.storeID || auth.store || 1;
    } catch (e) {
      return 1;
    }
  };

  const authHeaders = () => {
    const token = getAuthToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const ajaxJson = (options) => {
    return $.ajax({
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) },
      contentType: 'application/json',
      dataType: 'json',
      data: options.data ? JSON.stringify(options.data) : undefined
    });
  };

  const ajaxForm = (options) => {
    return $.ajax({
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) },
      processData: false,
      contentType: false
    });
  };

  const setStatus = ($el, message, type = 'info') => {
    if (!$el || !$el.length) return;
    $el
      .removeClass('status-success status-error status-info')
      .addClass(`status-${type}`)
      .text(message)
      .show();
  };

  const parseError = (xhr) => {
    if (xhr?.responseJSON?.message) return xhr.responseJSON.message;
    if (xhr?.responseJSON?.errors) {
      return Object.values(xhr.responseJSON.errors).flat().join(', ');
    }
    if (xhr?.responseText) return xhr.responseText;
    return 'Request failed';
  };

  const populateSelect = ($select, items, valueKey, labelKey, placeholder = 'Select an option') => {
    if (!$select || !$select.length) return;
    $select.empty();
    $select.append(`<option value="">${placeholder}</option>`);
    (items || []).forEach((item) => {
      const val = item[valueKey];
      const label = item[labelKey];
      if (val === undefined || label === undefined) return;
      $select.append(`<option value="${val}">${label}</option>`);
    });
  };

  // Page: products.html
  const initProductsPage = () => {
    const $list = $('#productList');
    const $status = $('#pageStatus');
    const $tableBody = $('#productsTableBody');

    const renderProducts = (products = []) => {
      if ($tableBody.length === 0) {
        // fallback list rendering
        $list.empty();
        if (!products.length) {
          $list.append('<li class="list-group-item">No products found.</li>');
          return;
        }
        products.forEach((p) => {
          const name = p.productName || p.name || `Product ${p.productId || ''}`;
          const price = p.price ?? p.productPrice ?? '-';
          $list.append(`<li class="list-group-item d-flex justify-content-between"><span>${name}</span><span class="text-muted">${price}</span></li>`);
        });
        return;
      }

      $tableBody.empty();
      if (!products.length) {
        $tableBody.append('<tr><td colspan="4" class="text-center">No products found</td></tr>');
        return;
      }
      products.forEach((p) => {
        const id = p.productId || p.id;
        const name = p.productName || p.name || `Product ${id ?? ''}`;
        const price = p.price ?? p.productPrice ?? '-';
        const qty = p.quantity ?? p.stockQuantity ?? '-';
        $tableBody.append(`
          <tr>
            <td>${id ?? '-'}</td>
            <td>${name}</td>
            <td>${price}</td>
            <td>${qty}</td>
          </tr>
        `);
      });
    };

    const loadProducts = () => {
      setStatus($status, 'Loading products...', 'info');
      ajaxJson({ url: ENDPOINTS.products, method: 'GET' })
        .done((res) => {
          const products = res.data || res.items || res || [];
          renderProducts(products);
          setStatus($status, 'Products loaded', 'success');
        })
        .fail((xhr) => {
          setStatus($status, parseError(xhr), 'error');
        });
    };

    loadProducts();
  };

  // Page: add-product.html
  const initAddProductPage = () => {
    const $sub = $('#subCategory');
    const $form = $('#productForm');
    const $status = $('#pageStatus');
    const $submit = $('#submitProduct');

    const loadSubcategories = () => {
      setStatus($status, 'Loading subcategories...', 'info');
      ajaxJson({ url: ENDPOINTS.subcategories, method: 'GET' })
        .done((res) => {
          const items = res.data || res.items || res || [];
          const normalized = items.map((s) => ({
            subCategoryId: s.subCategoryId || s.id,
            subCategoryName: s.subCategoryName || s.name
          }));
          populateSelect($sub, normalized, 'subCategoryId', 'subCategoryName', 'Select subcategory');
          setStatus($status, 'Subcategories loaded', 'success');
        })
        .fail((xhr) => setStatus($status, parseError(xhr), 'error'));
    };

    const saveProduct = (payload, hasFile) => {
      const req = hasFile
        ? ajaxForm({
            url: ENDPOINTS.products,
            method: 'POST',
            data: payload
          })
        : ajaxJson({
            url: ENDPOINTS.products,
            method: 'POST',
            data: payload
          });

      req
        .done(() => {
          setStatus($status, 'Product created successfully.', 'success');
          $form[0].reset();
        })
        .fail((xhr) => setStatus($status, parseError(xhr), 'error'))
        .always(() => $submit.prop('disabled', false));
    };

    $form.on('submit', function (e) {
      e.preventDefault();
      $submit.prop('disabled', true);

      const name = $('#productName').val().trim();
      const price = parseFloat($('#price').val());
      const subId = $('#subCategory').val();
      const desc = $('#description').val().trim();
      const quantity = parseInt($('#quantity').val(), 10);
      const file = $('#image')[0].files[0];
      const storeId = getStoreId();

      if (!name || !subId || isNaN(price)) {
        setStatus($status, 'Name, price, and subcategory are required.', 'error');
        $submit.prop('disabled', false);
        return;
      }

      if (file) {
        const fd = new FormData();
        fd.append('productName', name);
        fd.append('price', price);
        fd.append('subCategoryId', subId);
        fd.append('storeId', storeId);
        if (desc) fd.append('productDescription', desc);
        if (!isNaN(quantity)) fd.append('quantity', quantity);
        fd.append('image', file);
        saveProduct(fd, true);
      } else {
        const payload = {
          productName: name,
          price: price,
          subCategoryId: isNaN(subId) ? subId : Number(subId),
          storeId: storeId
        };
        if (desc) payload.productDescription = desc;
        if (!isNaN(quantity)) payload.quantity = quantity;
        saveProduct(payload, false);
      }
    });

    loadSubcategories();
  };

  // Page: product-details.html
  const initProductDetailsPage = () => {
    const $product = $('#productId');
    const $attrs = $('#attributeIds');
    const $measures = $('#measureIds');
    const $form = $('#productDetailForm');
    const $status = $('#pageStatus');
    const $submit = $('#submitDetail');

    const loadProducts = () => {
      ajaxJson({ url: ENDPOINTS.products, method: 'GET' })
        .done((res) => {
          const items = res.data || res.items || res || [];
          const normalized = items.map((p) => ({
            productId: p.productId || p.id,
            productName: p.productName || p.name
          }));
          populateSelect($product, normalized, 'productId', 'productName', 'Select product');
        })
        .fail((xhr) => setStatus($status, parseError(xhr), 'error'));
    };

    const loadAttributes = () => {
      ajaxJson({ url: ENDPOINTS.attributes, method: 'GET' })
        .done((res) => {
          const items = res.data || res.items || res || [];
          const normalized = items.map((a) => ({
            attributeId: a.attributeId || a.id,
            attributeName: a.attributeName || a.name
          }));
          populateSelect($attrs, normalized, 'attributeId', 'attributeName', 'Select attributes');
        })
        .fail((xhr) => setStatus($status, parseError(xhr), 'error'));
    };

    const loadMeasures = () => {
      ajaxJson({ url: ENDPOINTS.measures, method: 'GET' })
        .done((res) => {
          const items = res.data || res.items || res || [];
          const normalized = items.map((m) => ({
            measureUnitId: m.measureUnitId || m.id,
            measureUnitName: m.measureUnitName || m.name
          }));
          populateSelect($measures, normalized, 'measureUnitId', 'measureUnitName', 'Select measures');
        })
        .fail((xhr) => setStatus($status, parseError(xhr), 'error'));
    };

    $form.on('submit', function (e) {
      e.preventDefault();
      $submit.prop('disabled', true);
      const productId = $product.val();
      const attributeIds = ($attrs.val() || []).map((v) => (isNaN(v) ? v : Number(v)));
      const measureUnitIds = ($measures.val() || []).map((v) => (isNaN(v) ? v : Number(v)));
      const price = parseFloat($('#detailPrice').val());
      const quantity = parseInt($('#detailQuantity').val(), 10);

      if (!productId) {
        setStatus($status, 'Select a product.', 'error');
        $submit.prop('disabled', false);
        return;
      }
      if (!attributeIds.length || !measureUnitIds.length) {
        setStatus($status, 'Select at least one attribute and one measure unit.', 'error');
        $submit.prop('disabled', false);
        return;
      }

      const payload = {
        productId: isNaN(productId) ? productId : Number(productId),
        attributeIds,
        measureUnitIds
      };
      if (!isNaN(price)) payload.price = price;
      if (!isNaN(quantity)) payload.quantity = quantity;

      ajaxJson({
        url: ENDPOINTS.productDetails,
        method: 'POST',
        data: payload
      })
        .done(() => {
          setStatus($status, 'Product detail added.', 'success');
          $form[0].reset();
        })
        .fail((xhr) => setStatus($status, parseError(xhr), 'error'))
        .always(() => $submit.prop('disabled', false));
    });

    loadProducts();
    loadAttributes();
    loadMeasures();
  };

  $(document).ready(function () {
    const page = $('body').data('page');
    if (page === 'products') {
      initProductsPage();
    } else if (page === 'add-product') {
      initAddProductPage();
    } else if (page === 'product-details') {
      initProductDetailsPage();
    }
  });
})();

