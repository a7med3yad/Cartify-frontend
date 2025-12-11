// Merchant Dashboard JavaScript
$(document).ready(function () {
    // Check authentication
    checkAuth();

    // Load merchant data
    loadMerchantData();

    // Setup navigation
    setupNavigation();

    // Setup logout
    $('#logoutBtn').click(function (e) {
        e.preventDefault();
        logout();
    });
});

/**
 * Check if user is authenticated and has merchant role
 */
function checkAuth() {
    // Check for Auth data in localStorage or sessionStorage
    let authData = localStorage.getItem('Auth') || sessionStorage.getItem('Auth');

    if (!authData) {
        // No auth data, redirect to login
        window.location.href = 'login.html';
        return;
    }

    try {
        const auth = JSON.parse(authData);

        if (!auth.jwt) {
            window.location.href = 'login.html';
            return;
        }

        // Decode JWT to check role
        const tokenData = parseJwt(auth.jwt);
        const roles = tokenData["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
        const rolesArray = Array.isArray(roles) ? roles : [roles];

        if (!rolesArray.includes('Merchant')) {
            // Not a merchant, redirect to customer home
            window.location.href = 'index.html';
            return;
        }

        // Store user info globally
        window.merchantData = {
            token: auth.jwt,
            userId: tokenData["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"],
            username: tokenData["http://schemas.xmlsoap.org/ws/2008/06/identity/claims/name"] ||
                tokenData["unique_name"] ||
                "Merchant",
            email: tokenData["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"],
            storeId: tokenData["storeId"]
        };

    } catch (error) {
        console.error('Auth error:', error);
        window.location.href = 'login.html';
    }
}

/**
 * Parse JWT token
 */
function parseJwt(token) {
    try {
        const base64Payload = token.split('.')[1];
        const payload = atob(base64Payload);
        return JSON.parse(payload);
    } catch (e) {
        return null;
    }
}

/**
 * Load merchant data and display in UI
 */
function loadMerchantData() {
    if (window.merchantData) {
        $('#merchantName').text(window.merchantData.username);

        // Load dashboard stats
        loadDashboardStats();
    }
}

/**
 * Load dashboard statistics
 */
function loadDashboardStats() {
    // This is a placeholder - replace with actual API calls
    // For now, showing dummy data
    $('#totalRevenue').text('$0');
    $('#totalOrders').text('0');
    $('#totalProducts').text('0');
    $('#totalCustomers').text('0');

    // TODO: Fetch real data from API
    // Example:
    // $.ajax({
    //     url: 'https://cartify.runasp.net/api/merchant/dashboard/stats',
    //     method: 'GET',
    //     headers: {
    //         'Authorization': 'Bearer ' + window.merchantData.token
    //     },
    //     success: function(data) {
    //         $('#totalRevenue').text('$' + data.revenue);
    //         $('#totalOrders').text(data.orders);
    //         $('#totalProducts').text(data.products);
    //         $('#totalCustomers').text(data.customers);
    //     }
    // });
}

/**
 * Setup navigation between sections
 */
function setupNavigation() {
    $('.nav-link[data-section]').click(function (e) {
        e.preventDefault();

        const section = $(this).data('section');

        // Update active nav item
        $('.nav-link').removeClass('active');
        $(this).addClass('active');

        // Hide all sections
        $('.content-section').hide().removeClass('active');

        // Show selected section
        $('#' + section + 'Section').show().addClass('active');
    });
}

/**
 * Logout user
 */
function logout() {
    // Clear all auth data
    localStorage.removeItem('Auth');
    sessionStorage.removeItem('Auth');
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');

    // Redirect to login
    window.location.href = 'login.html';
}

/**
 * Get authorization header for API calls
 */
function getAuthHeader() {
    if (window.merchantData && window.merchantData.token) {
        return {
            'Authorization': 'Bearer ' + window.merchantData.token,
            'Content-Type': 'application/json'
        };
    }
    return {};
}
