// CRUD helpers for Cartify merchant products and product details (jQuery + AJAX)
(function () {
  const API_ROOT = 'https://cartify.runasp.net/api';
  const ENDPOINTS = {
    products: `${API_ROOT}/merchant/products`,
    productDetails: `${API_ROOT}/merchant/product-details`,
    subcategories: `${API_ROOT}/Category/subcategory`,
    productById: (id) => `${API_ROOT}/merchant/products/${id}`,
    productDetailById: (id) => `${API_ROOT}/merchant/product-details/${id}`,
    productDetailsForProduct: (id) => `${API_ROOT}/merchant/products/${id}/details`,
    attributes: `${API_ROOT}/merchant/attributes-measures/attributes`,
    measures: `${API_ROOT}/merchant/attributes-measures/measures`
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
      return auth.storeId || auth.storeID || 1;
    } catch (e) {
      return 1;
    }
  };

  const authHeaders = () => {
    const token = getAuthToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const ajaxJson = (opts) =>
    $.ajax({
      ...opts,
      headers: { ...authHeaders(), ...(opts.headers || {}) },
      contentType: 'application/json',
      dataType: 'json',
      data: opts.data ? JSON.stringify(opts.data) : undefined
    });

  const ajaxForm = (opts) =>
    $.ajax({
      ...opts,
      headers: { ...authHeaders(), ...(opts.headers || {}) },
      processData: false,
      contentType: false
    });

  const parseError = (xhr) => {
    if (xhr?.responseJSON?.message) return xhr.responseJSON.message;
    if (xhr?.responseJSON?.errors) return Object.values(xhr.responseJSON.errors).flat().join(', ');
    if (xhr?.responseText) return xhr.responseText;
    return 'Request failed';
  };

  const setStatus = ($el, msg, type = 'info') => {
    if (!$el?.length) return;
    $el.removeClass('status-success status-error status-info').addClass(`status-${type}`).text(msg).show();
  };

  // ---------- Products ----------
  const loadProducts = (page = 1) => {
    const $status = $('#pageStatus');
    const search = $('#searchProducts').val() || '';
    const pageSize = parseInt($('#pageSize').val(), 10) || 10;
    setStatus($status, 'Loading products...', 'info');
    ajaxJson({
      url: ENDPOINTS.products,
      method: 'GET',
      data: { page, pageSize, search }
    })
      .done((res) => {
        const items = res.data || res.items || res || [];
        const total = res.totalCount || res.total || items.length;
        renderProductsTable(items);
        renderPagination('#paginationInfo', total, page, pageSize);
        setStatus($status, 'Products loaded', 'success');
      })
      .fail((xhr) => setStatus($status, parseError(xhr), 'error'));
  };

  const renderProductsTable = (items) => {
    const $body = $('#productsTableBody');
    if (!$body.length) return;
    $body.empty();
    if (!items || !items.length) {
      $body.append('<tr><td colspan="7" class="text-center">No products found</td></tr>');
      return;
    }
    items.forEach((p) => {
      const id = p.productId || p.id;
      const img = p.imageUrl || p.image || '';
      const sub = p.subCategoryName || p.subcategoryName || p.subCategory?.name || '';
      const type = p.typeName || p.type || '';
      $body.append(`
        <tr>
          <td>${id ?? '-'}</td>
          <td>${img ? `<img src="${img}" class="table-thumb" alt="img">` : '-'}</td>
          <td>${p.productName || p.name || '-'}</td>
          <td>${p.price ?? '-'}</td>
          <td>${sub || '-'}</td>
          <td>${type || '-'}</td>
          <td>
            <a class="btn btn-sm btn-outline-primary me-1" href="edit-product.html?id=${id}">Edit</a>
            <button class="btn btn-sm btn-outline-danger" data-action="delete-product" data-id="${id}">Delete</button>
          </td>
        </tr>
      `);
    });
  };

  const deleteProduct = (id) => {
    const $status = $('#pageStatus');
    if (!confirm('Delete this product?')) return;
    setStatus($status, 'Deleting...', 'info');
    ajaxJson({ url: ENDPOINTS.productById(id), method: 'DELETE' })
      .done(() => {
        setStatus($status, 'Product deleted', 'success');
        loadProducts(currentPage());
      })
      .fail((xhr) => setStatus($status, parseError(xhr), 'error'));
  };

  const loadProductForEdit = (id) => {
    const $status = $('#pageStatus');
    setStatus($status, 'Loading product...', 'info');
    ajaxJson({ url: ENDPOINTS.productById(id), method: 'GET' })
      .done((p) => {
        $('#productId').val(id);
        $('#productName').val(p.productName || p.name || '');
        $('#price').val(p.price ?? '');
        $('#quantity').val(p.quantity ?? p.stockQuantity ?? '');
        $('#description').val(p.productDescription || p.description || '');
        if (p.subCategoryId || p.subCategory?.id) {
          $('#subCategory').val(p.subCategoryId || p.subCategory.id);
        }
        if (p.typeId || p.type?.id) {
          $('#productType').val(p.typeId || p.type.id);
        }
        setStatus($status, 'Product loaded', 'success');
      })
      .fail((xhr) => setStatus($status, parseError(xhr), 'error'));
  };

  const saveProduct = () => {
    const $status = $('#pageStatus');
    const $btn = $('#submitProduct');
    const name = $('#productName').val().trim();
    const price = parseFloat($('#price').val());
    const subId = $('#subCategory').val();
    const desc = $('#description').val().trim();
    const quantity = parseInt($('#quantity').val(), 10);
    const type = $('#productType').val();
    const file = $('#image')[0]?.files?.[0];
    const storeId = getStoreId();

    if (!name || isNaN(price) || !subId) {
      setStatus($status, 'Name, price, and subcategory are required.', 'error');
      return;
    }

    $btn.prop('disabled', true);
    const sendFormData = !!file;
    if (sendFormData) {
      const fd = new FormData();
      fd.append('productName', name);
      fd.append('price', price);
      fd.append('subCategoryId', subId);
      fd.append('storeId', storeId);
      if (desc) fd.append('productDescription', desc);
      if (!isNaN(quantity)) fd.append('quantity', quantity);
      if (type) fd.append('typeId', type);
      fd.append('image', file);
      ajaxForm({ url: ENDPOINTS.products, method: 'POST', data: fd })
        .done(() => {
          setStatus($status, 'Product created.', 'success');
          $('#productForm')[0].reset();
        })
        .fail((xhr) => setStatus($status, parseError(xhr), 'error'))
        .always(() => $btn.prop('disabled', false));
    } else {
      const payload = {
        productName: name,
        price: price,
        subCategoryId: isNaN(subId) ? subId : Number(subId),
        storeId: storeId
      };
      if (desc) payload.productDescription = desc;
      if (!isNaN(quantity)) payload.quantity = quantity;
      if (type) payload.typeId = type;
      ajaxJson({ url: ENDPOINTS.products, method: 'POST', data: payload })
        .done(() => {
          setStatus($status, 'Product created.', 'success');
          $('#productForm')[0].reset();
        })
        .fail((xhr) => setStatus($status, parseError(xhr), 'error'))
        .always(() => $btn.prop('disabled', false));
    }
  };

  const updateProduct = (id) => {
    const $status = $('#pageStatus');
    const $btn = $('#submitProduct');
    const name = $('#productName').val().trim();
    const price = parseFloat($('#price').val());
    const subId = $('#subCategory').val();
    const desc = $('#description').val().trim();
    const quantity = parseInt($('#quantity').val(), 10);
    const type = $('#productType').val();
    const file = $('#image')[0]?.files?.[0];

    if (!name || isNaN(price) || !subId) {
      setStatus($status, 'Name, price, and subcategory are required.', 'error');
      return;
    }

    $btn.prop('disabled', true);
    if (file) {
      const fd = new FormData();
      fd.append('productName', name);
      fd.append('price', price);
      fd.append('subCategoryId', subId);
      if (desc) fd.append('productDescription', desc);
      if (!isNaN(quantity)) fd.append('quantity', quantity);
      if (type) fd.append('typeId', type);
      fd.append('image', file);
      ajaxForm({ url: ENDPOINTS.productById(id), method: 'PUT', data: fd })
        .done(() => setStatus($status, 'Product updated.', 'success'))
        .fail((xhr) => setStatus($status, parseError(xhr), 'error'))
        .always(() => $btn.prop('disabled', false));
    } else {
      const payload = {
        productName: name,
        price: price,
        subCategoryId: isNaN(subId) ? subId : Number(subId)
      };
      if (desc) payload.productDescription = desc;
      if (!isNaN(quantity)) payload.quantity = quantity;
      if (type) payload.typeId = type;
      ajaxJson({ url: ENDPOINTS.productById(id), method: 'PUT', data: payload })
        .done(() => setStatus($status, 'Product updated.', 'success'))
        .fail((xhr) => setStatus($status, parseError(xhr), 'error'))
        .always(() => $btn.prop('disabled', false));
    }
  };

  const loadSubcategories = () =>
    ajaxJson({ url: ENDPOINTS.subcategories, method: 'GET' }).then((res) => {
      const items = res.data || res.items || res || [];
      return items.map((s) => ({
        id: s.subCategoryId || s.id,
        name: s.subCategoryName || s.name
      }));
    });

  const populateSelect = ($select, list, placeholder = 'Select') => {
    if (!$select?.length) return;
    $select.empty();
    $select.append(`<option value="">${placeholder}</option>`);
    list.forEach((i) => $select.append(`<option value="${i.id}">${i.name}</option>`));
  };

  // ---------- Product Details ----------
  const loadProductDetails = (page = 1) => {
    const $status = $('#pageStatus');
    const search = $('#searchDetails').val() || '';
    const pageSize = parseInt($('#pageSize').val(), 10) || 10;
    setStatus($status, 'Loading product details...', 'info');
    ajaxJson({ url: ENDPOINTS.productDetails, method: 'GET', data: { page, pageSize, search } })
      .done((res) => {
        const items = res.data || res.items || res || [];
        const total = res.totalCount || res.total || items.length;
        renderProductDetailsTable(items);
        renderPagination('#paginationInfo', total, page, pageSize);
        setStatus($status, 'Product details loaded', 'success');
      })
      .fail((xhr) => setStatus($status, parseError(xhr), 'error'));
  };

  const renderProductDetailsTable = (items) => {
    const $body = $('#productDetailsTableBody');
    if (!$body.length) return;
    $body.empty();
    if (!items || !items.length) {
      $body.append('<tr><td colspan="6" class="text-center">No product details found</td></tr>');
      return;
    }
    items.forEach((d) => {
      const id = d.productDetailId || d.id;
      const attrs = (d.attributes || d.attributeNames || []).map((a) => a.name || a.attributeName || a).join(', ');
      const measures = (d.measureUnits || d.measureUnitNames || []).map((m) => m.name || m.measureUnitName || m).join(', ');
      $body.append(`
        <tr>
          <td>${id ?? '-'}</td>
          <td>${d.productName || d.product?.name || '-'}</td>
          <td>${attrs || '-'}</td>
          <td>${measures || '-'}</td>
          <td>${d.price ?? '-'}</td>
          <td>${d.quantity ?? '-'}</td>
          <td>
            <a class="btn btn-sm btn-outline-primary me-1" href="edit-product-detail.html?id=${id}">Edit</a>
            <button class="btn btn-sm btn-outline-danger" data-action="delete-detail" data-id="${id}">Delete</button>
          </td>
        </tr>
      `);
    });
  };

  const deleteProductDetail = (id) => {
    const $status = $('#pageStatus');
    if (!confirm('Delete this product detail?')) return;
    setStatus($status, 'Deleting...', 'info');
    ajaxJson({ url: ENDPOINTS.productDetailById(id), method: 'DELETE' })
      .done(() => {
        setStatus($status, 'Product detail deleted', 'success');
        loadProductDetails(currentPage());
      })
      .fail((xhr) => setStatus($status, parseError(xhr), 'error'));
  };

  const loadProductDetailForEdit = (id) => {
    const $status = $('#pageStatus');
    setStatus($status, 'Loading detail...', 'info');
    ajaxJson({ url: ENDPOINTS.productDetailById(id), method: 'GET' })
      .done((d) => {
        $('#detailId').val(id);
        $('#productId').val(d.productId || d.product?.id);
        setMulti('#attributeIds', d.attributeIds || (d.attributes || []).map((a) => a.id || a.attributeId));
        setMulti('#measureIds', d.measureUnitIds || (d.measureUnits || []).map((m) => m.id || m.measureUnitId));
        $('#detailPrice').val(d.price ?? '');
        $('#detailQuantity').val(d.quantity ?? '');
        setStatus($status, 'Detail loaded', 'success');
      })
      .fail((xhr) => setStatus($status, parseError(xhr), 'error'));
  };

  const setMulti = (selector, ids = []) => {
    const $el = $(selector);
    if (!$el.length) return;
    $el.val((ids || []).map((x) => String(x)));
  };

  const saveProductDetail = () => {
    const $status = $('#pageStatus');
    const $btn = $('#submitDetail');
    const productId = $('#productId').val();
    const attributeIds = ($('#attributeIds').val() || []).map((v) => (isNaN(v) ? v : Number(v)));
    const measureUnitIds = ($('#measureIds').val() || []).map((v) => (isNaN(v) ? v : Number(v)));
    const price = parseFloat($('#detailPrice').val());
    const quantity = parseInt($('#detailQuantity').val(), 10);

    if (!productId || !attributeIds.length || !measureUnitIds.length) {
      setStatus($status, 'Product, attributes, and measure units are required.', 'error');
      return;
    }

    const payload = {
      productId: isNaN(productId) ? productId : Number(productId),
      attributeIds,
      measureUnitIds
    };
    if (!isNaN(price)) payload.price = price;
    if (!isNaN(quantity)) payload.quantity = quantity;

    $btn.prop('disabled', true);
    ajaxJson({ url: ENDPOINTS.productDetails, method: 'POST', data: payload })
      .done(() => {
        setStatus($status, 'Product detail created.', 'success');
        $('#productDetailForm')[0].reset();
      })
      .fail((xhr) => setStatus($status, parseError(xhr), 'error'))
      .always(() => $btn.prop('disabled', false));
  };

  const updateProductDetail = (id) => {
    const $status = $('#pageStatus');
    const $btn = $('#submitDetail');
    const productId = $('#productId').val();
    const attributeIds = ($('#attributeIds').val() || []).map((v) => (isNaN(v) ? v : Number(v)));
    const measureUnitIds = ($('#measureIds').val() || []).map((v) => (isNaN(v) ? v : Number(v)));
    const price = parseFloat($('#detailPrice').val());
    const quantity = parseInt($('#detailQuantity').val(), 10);

    if (!productId || !attributeIds.length || !measureUnitIds.length) {
      setStatus($status, 'Product, attributes, and measure units are required.', 'error');
      return;
    }

    const payload = {
      productId: isNaN(productId) ? productId : Number(productId),
      attributeIds,
      measureUnitIds
    };
    if (!isNaN(price)) payload.price = price;
    if (!isNaN(quantity)) payload.quantity = quantity;

    $btn.prop('disabled', true);
    ajaxJson({ url: ENDPOINTS.productDetailById(id), method: 'PUT', data: payload })
      .done(() => setStatus($status, 'Product detail updated.', 'success'))
      .fail((xhr) => setStatus($status, parseError(xhr), 'error'))
      .always(() => $btn.prop('disabled', false));
  };

  // ---------- Shared UI helpers ----------
  const renderPagination = (selector, total, page, pageSize) => {
    const $el = $(selector);
    if (!$el.length) return;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    $el.text(`Page ${page} of ${totalPages} (Total: ${total})`);
  };

  const currentPage = () => {
    const p = parseInt($('#pageNumber').val(), 10);
    return isNaN(p) || p < 1 ? 1 : p;
  };

  const bindProductsPage = () => {
    $('#searchProducts, #pageSize').on('change keyup', () => loadProducts(1));
    $('#pageNumber').on('change', function () {
      const p = parseInt($(this).val(), 10) || 1;
      loadProducts(p);
    });
    $(document).on('click', '[data-action="delete-product"]', function () {
      deleteProduct($(this).data('id'));
    });
    loadProducts(1);
  };

  const bindProductDetailsPage = () => {
    $('#searchDetails, #pageSize').on('change keyup', () => loadProductDetails(1));
    $('#pageNumber').on('change', function () {
      const p = parseInt($(this).val(), 10) || 1;
      loadProductDetails(p);
    });
    $(document).on('click', '[data-action="delete-detail"]', function () {
      deleteProductDetail($(this).data('id'));
    });
    loadProductDetails(1);
  };

  const bindAddProductPage = () => {
    loadSubcategories().then((list) => populateSelect($('#subCategory'), list, 'Select subcategory'));
    $('#productForm').on('submit', function (e) {
      e.preventDefault();
      saveProduct();
    });
  };

  const bindEditProductPage = () => {
    const id = new URLSearchParams(window.location.search).get('id');
    loadSubcategories().then((list) => populateSelect($('#subCategory'), list, 'Select subcategory'));
    if (id) loadProductForEdit(id);
    $('#productForm').on('submit', function (e) {
      e.preventDefault();
      updateProduct(id);
    });
  };

  const loadProductsForSelect = () =>
    ajaxJson({ url: ENDPOINTS.products, method: 'GET', data: { page: 1, pageSize: 200 } }).then((res) => {
      const items = res.data || res.items || res || [];
      return items.map((p) => ({ id: p.productId || p.id, name: p.productName || p.name }));
    });

  const loadAttributesForSelect = () =>
    ajaxJson({ url: ENDPOINTS.attributes, method: 'GET' }).then((res) => {
      const items = res.data || res.items || res || [];
      return items.map((a) => ({ id: a.attributeId || a.id, name: a.attributeName || a.name }));
    });

  const loadMeasuresForSelect = () =>
    ajaxJson({ url: ENDPOINTS.measures, method: 'GET' }).then((res) => {
      const items = res.data || res.items || res || [];
      return items.map((m) => ({ id: m.measureUnitId || m.id, name: m.measureUnitName || m.name }));
    });

  const bindAddProductDetailPage = () => {
    $.when(loadProductsForSelect(), loadAttributesForSelect(), loadMeasuresForSelect()).done((prods, attrs, measures) => {
      populateSelect($('#productId'), prods, 'Select product');
      populateSelect($('#attributeIds'), attrs, 'Select attributes');
      populateSelect($('#measureIds'), measures, 'Select measures');
    });
    $('#productDetailForm').on('submit', function (e) {
      e.preventDefault();
      saveProductDetail();
    });
  };

  const bindEditProductDetailPage = () => {
    const id = new URLSearchParams(window.location.search).get('id');
    $.when(loadProductsForSelect(), loadAttributesForSelect(), loadMeasuresForSelect()).done((prods, attrs, measures) => {
      populateSelect($('#productId'), prods, 'Select product');
      populateSelect($('#attributeIds'), attrs, 'Select attributes');
      populateSelect($('#measureIds'), measures, 'Select measures');
      if (id) loadProductDetailForEdit(id);
    });
    $('#productDetailForm').on('submit', function (e) {
      e.preventDefault();
      updateProductDetail(id);
    });
  };

  $(document).ready(function () {
    const page = $('body').data('page');
    if (page === 'products') {
      bindProductsPage();
    } else if (page === 'add-product') {
      bindAddProductPage();
    } else if (page === 'edit-product') {
      bindEditProductPage();
    } else if (page === 'product-details') {
      bindProductDetailsPage();
    } else if (page === 'add-product-detail') {
      bindAddProductDetailPage();
    } else if (page === 'edit-product-detail') {
      bindEditProductDetailPage();
    }
  });

  // Expose for console debugging if needed
  window.MerchantCRUD = {
    loadProducts,
    deleteProduct,
    loadProductForEdit,
    saveProduct,
    updateProduct,
    loadProductDetails,
    deleteProductDetail,
    loadProductDetailForEdit,
    saveProductDetail,
    updateProductDetail
  };
})();

