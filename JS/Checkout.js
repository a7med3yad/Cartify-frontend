// Checkout.js
const CartifyApi = window.CartifyApi || {};
const API_BASE_URL = CartifyApi.baseUrl || 'https://cartify.runasp.net/api';

const fallbackGetAuthToken = () => {
    try {
        const stored =
            JSON.parse(localStorage.getItem('Auth') || 'null') ||
            JSON.parse(sessionStorage.getItem('Auth') || 'null') ||
            {};
        return stored.jwt || null;
    } catch (error) {
        console.warn('Unable to read stored auth token', error);
        return null;
    }
};

const fallbackGetUserId = () => {
    const token = fallbackGetAuthToken();
    if (!token) return null;

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userId =
            payload.sub || payload.nameid || payload.UserId || payload.userId;
        return userId ? (typeof userId === 'string' ? parseInt(userId, 10) : userId) : null;
    } catch (error) {
        console.error('Error parsing JWT:', error);
        return null;
    }
};

const getAuthToken = () =>
    (CartifyApi.getAuthToken && CartifyApi.getAuthToken()) || fallbackGetAuthToken();
const getUserId = () =>
    (CartifyApi.getUserId && CartifyApi.getUserId()) || fallbackGetUserId();

// Get cart items from localStorage
function getCartItems() {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    return cart;
}

const paymentSelect = document.querySelector('select[name="payment"]');
const cardInfo = document.getElementById('card-info');
const paypalDiv = document.getElementById('paypal');
const card = document.getElementById("myform");
  
  
  
if (paymentSelect) {
    paymentSelect.addEventListener('change', ()=>{
        if(paymentSelect.value==='card'){
            if (cardInfo) cardInfo.style.display='block';
        } else {
            if (cardInfo) cardInfo.style.display='none';
        }

        if(paymentSelect.value==='paypal'){
            if (paypalDiv) paypalDiv.style.display='block';
        } else {
            if (paypalDiv) paypalDiv.style.display='none';
        }
    });
}



const FALLBACK_COUNTRY_DATA = [
    { country: "Egypt", cities: ["Cairo", "Alexandria", "Giza", "Port Said", "Mansoura", "Tanta", "Aswan"] },
    { country: "Saudi Arabia", cities: ["Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Khobar"] },
    { country: "United Arab Emirates", cities: ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Al Ain"] },
    { country: "United States", cities: ["New York", "Los Angeles", "Chicago", "Houston", "Philadelphia"] },
    { country: "United Kingdom", cities: ["London", "Manchester", "Birmingham", "Liverpool", "Leeds"] },
    { country: "Germany", cities: ["Berlin", "Munich", "Hamburg", "Cologne", "Frankfurt"] },
    { country: "France", cities: ["Paris", "Lyon", "Marseille", "Nice", "Toulouse"] },
    { country: "Canada", cities: ["Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa"] },
    { country: "India", cities: ["New Delhi", "Mumbai", "Bengaluru", "Hyderabad", "Chennai"] },
    { country: "Morocco", cities: ["Casablanca", "Rabat", "Fes", "Marrakesh", "Tangier"] }
];

const countrySelect = document.getElementById("country");
const citySelect = document.getElementById("city");

function renderCountries(data) {
    if (!countrySelect) return;
    countrySelect.innerHTML = '<option value="" hidden selected>Select Country</option>';
    data.forEach(countryObj => {
        const opt = document.createElement("option");
        opt.value = countryObj.country;
        opt.textContent = countryObj.country;
        countrySelect.appendChild(opt);
    });
}

function renderCities(cities = []) {
    if (!citySelect) return;
    citySelect.innerHTML = '<option value="" hidden selected>Select City</option>';
    if (!cities.length) {
        citySelect.disabled = true;
        return;
    }
    citySelect.disabled = false;
    cities.forEach(city => {
        const opt = document.createElement("option");
        opt.value = city;
        opt.textContent = city;
        citySelect.appendChild(opt);
    });
}

async function initCountryCitySelectors() {
    if (!countrySelect || !citySelect) return;

    let dataset = [];
    try {
        const response = await fetch("https://countriesnow.space/api/v0.1/countries");
        if (!response.ok) throw new Error(`Countries API responded with ${response.status}`);
        const data = await response.json();
        dataset = Array.isArray(data?.data) && data.data.length ? data.data : FALLBACK_COUNTRY_DATA;
    } catch (error) {
        console.warn("Country API failed, using fallback list", error);
        dataset = FALLBACK_COUNTRY_DATA;
    }

    renderCountries(dataset);

    countrySelect.addEventListener("change", function () {
        const selected = dataset.find(c => c.country === this.value);
        renderCities(selected?.cities || []);
    });
}

initCountryCitySelectors();
const form = document.getElementById("myform");
const successNotification = document.getElementById("successNotification");

if (form) {
    form.addEventListener("submit", function(e) {
        e.preventDefault(); 
        console.log("Form submitted!"); 
        processCheckout();
    });
}

function showNotification(message, type = "success") {
    if (!successNotification) return;
    
    successNotification.textContent = message || "Data submitted successfully!... ✅";
    successNotification.className = `notification ${type}`;
    successNotification.style.display = "block";
    successNotification.style.animation = "slideDown 0.3s ease-out";
    
    setTimeout(() => {
        successNotification.style.animation = "slideUp 0.3s ease-out";
        setTimeout(() => {
            successNotification.style.display = "none";
        }, 300);
    }, 3000);
}

// Process checkout
function processCheckout() {
    const userId = getUserId();
    if (!userId) {
        showNotification('Please login to checkout', 'error');
        setTimeout(() => window.location.href = 'login.html', 2000);
        return;
    }

    const token = getAuthToken();
    if (!token) {
        showNotification('Authentication required', 'error');
        return;
    }

    // Get cart items
    const cartItems = getCartItems();
    if (!cartItems || cartItems.length === 0) {
        showNotification('Your cart is empty', 'error');
        return;
    }

    // Get form data
    const formData = new FormData(form);
    const fullName = formData.get('fullname') || '';
    const email = formData.get('email') || '';
    const phone = formData.get('phone') || formData.get('mobile') || '';
    const address = formData.get('address') || '';
    const city = document.getElementById('city')?.value || '';
    const country = document.getElementById('country')?.value || '';
    const postalCode = formData.get('ZIP') || '';
    const paymentMethod = formData.get('payment') || 'cod';

    // Validate required fields
    if (!fullName || !email || !phone || !address || !city || !country) {
        showNotification('Please fill all required fields', 'error');
        return;
    }

    // Prepare cart items for API
    const cartItemsDto = cartItems.map(item => ({
        productId: item.id || item.productId || item.product_id,
        quantity: item.quantity || 1,
        price: item.price || 0
    }));

    // Prepare checkout data according to CheckoutDto structure
    const checkoutData = {
        userId: parseInt(userId),
        cartItems: cartItemsDto,
        shippingInfo: {
            fullName: fullName,
            email: email,
            phone: phone,
            address: address,
            city: city,
            country: country,
            postalCode: postalCode
        },
        paymentInfo: {
            paymentMethod: paymentMethod, // "card", "paypal", "cod"
            cardNumber: formData.get('cardnumber') || '',
            cardHolder: formData.get('cardname') || '',
            expiryDate: formData.get('expiry') || '',
            cvv: formData.get('cvc') || '' // ASP.NET Core JSON serialization converts to camelCase
        }
    };

    // Send to backend
    fetch(`${API_BASE_URL}/Checkout`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(checkoutData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw err; });
        }
        return response.json();
    })
    .then(response => {
        console.log('Checkout success:', response);
        showNotification(`Order placed successfully! Order ID: ${response.orderId}`, 'success');
        
        // Clear cart after successful checkout
        localStorage.removeItem('cart');
        
        // Redirect to order tracking or success page after 3 seconds
        setTimeout(() => {
            window.location.href = 'ordertracking.html';
        }, 3000);
    })
    .catch(error => {
        console.error('Checkout error:', error);
        const errorMsg = error.message || 'Checkout failed. Please try again.';
        showNotification(errorMsg, 'error');
    });
}
 
