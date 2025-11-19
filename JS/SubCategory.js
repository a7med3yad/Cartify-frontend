// API Base URL
const API_BASE_URL = 'https://cartify.runasp.net/api';

// Subcategory data
let subcategories = [];
let categoryId = null;

// Get category ID from URL parameters
function getCategoryIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('categoryId');
}

// Load subcategories from API
async function loadSubcategories() {
  try {
    categoryId = getCategoryIdFromURL();
    
    // If categoryId is provided, we can filter subcategories by category
    // But the API endpoint returns all subcategories, so we'll filter client-side
    const response = await fetch(`${API_BASE_URL}/Category/subcategory`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    let allSubcategories = await response.json();
    
    // Handle array response
    if (!Array.isArray(allSubcategories)) {
      allSubcategories = [];
    }
    
    // Filter by categoryId if provided
    if (categoryId) {
      subcategories = allSubcategories.filter(sub => 
        (sub.categoryId || sub.CategoryId) == categoryId
      );
    } else {
      subcategories = allSubcategories;
    }
    
    renderSubcategories();
  } catch (error) {
    console.error('Error loading subcategories:', error);
    // Show error message to user
    const categorySection = document.querySelector('.category-section .category');
    if (categorySection) {
      categorySection.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #dc3545;">
          <p>Failed to load subcategories. Please try again later.</p>
          <button onclick="loadSubcategories()" style="padding: 0.5rem 1rem; margin-top: 1rem; cursor: pointer;">Retry</button>
        </div>
      `;
    }
  }
}

// Render subcategories to the page
function renderSubcategories() {
  const categorySection = document.querySelector('.category-section .category');
  
  if (!categorySection) {
    console.error('Category section not found');
    return;
  }
  
  if (subcategories.length === 0) {
    categorySection.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <p>No subcategories found.</p>
      </div>
    `;
    return;
  }
  
  categorySection.innerHTML = subcategories.map(subcategory => `
    <div class="category-card">
      <span class="shop-now-badge">Shop Now</span>
      <a href="Products.html?subCategoryId=${subcategory.subCategoryId || subcategory.SubCategoryId}">
        <div class="image-wrapper">
          <img 
            src="${subcategory.imageUrl || subcategory.ImageUrl || 'https://via.placeholder.com/300x200?text=Subcategory'}" 
            alt="${subcategory.subCategoryName || subcategory.SubCategoryName}" 
            onerror="this.src='https://via.placeholder.com/300x200?text=Subcategory'"
          />
        </div>
        <div class="category-name">${subcategory.subCategoryName || subcategory.SubCategoryName}</div>
      </a>
    </div>
  `).join('');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadSubcategories();
});

