// API Base URL
const API_BASE_URL = 'https://cartify.runasp.net/api';

// Category data
let categories = [];
let currentPage = 1;
const pageSize = 20;

// Load categories from API
async function loadCategories(page = 1) {
  try {
    const response = await fetch(`${API_BASE_URL}/Category?page=${page}&pageSize=${pageSize}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Handle PagedResult structure
    if (data.items || data.Items) {
      categories = data.items || data.Items || [];
    } else if (Array.isArray(data)) {
      categories = data;
    } else {
      categories = [];
    }
    
    renderCategories();
  } catch (error) {
    console.error('Error loading categories:', error);
    // Show error message to user
    const categorySection = document.querySelector('.category-section .category');
    if (categorySection) {
      categorySection.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #dc3545;">
          <p>Failed to load categories. Please try again later.</p>
          <button onclick="loadCategories()" style="padding: 0.5rem 1rem; margin-top: 1rem; cursor: pointer;">Retry</button>
        </div>
      `;
    }
  }
}

// Render categories to the page
function renderCategories() {
  const categorySection = document.querySelector('.category-section .category');
  
  if (!categorySection) {
    console.error('Category section not found');
    return;
  }
  
  if (categories.length === 0) {
    categorySection.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <p>No categories found.</p>
      </div>
    `;
    return;
  }
  
  categorySection.innerHTML = categories.map(category => `
    <div class="category-card">
      <span class="shop-now-badge">Shop Now</span>
      <a href="Sub-Category.html?categoryId=${category.categoryId || category.CategoryId}">
        <div class="image-wrapper">
          <img 
            src="${category.imageUrl || category.ImageUrl || 'https://via.placeholder.com/300x200?text=Category'}" 
            alt="${category.categoryName || category.CategoryName}" 
            onerror="this.src='https://via.placeholder.com/300x200?text=Category'"
          />
        </div>
        <div class="category-name">${category.categoryName || category.CategoryName}</div>
      </a>
    </div>
  `).join('');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadCategories();
});

