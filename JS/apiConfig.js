(function (window) {
    const HOSTED_BASE_URL = 'https://cartify.runasp.net/api';
    const LOCAL_BASE_URL = 'http://localhost:5097/api';
    const AUTH_STORAGE_KEY = 'Auth';

    const safeParse = (value) => {
        if (!value) return null;
        try {
            return JSON.parse(value);
        } catch (error) {
            console.warn('Failed to parse stored auth payload', error);
            return null;
        }
    };

    const getStoredAuth = () =>
        safeParse(localStorage.getItem(AUTH_STORAGE_KEY)) ||
        safeParse(sessionStorage.getItem(AUTH_STORAGE_KEY));

    const resolveBaseUrl = () => {
        if (window.__CARTIFY_API_BASE__) {
            return window.__CARTIFY_API_BASE__;
        }

        const hostname = window.location.hostname;
        const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';

        if (isLocalHost) {
            return LOCAL_BASE_URL;
        }

        const hostedDomains = ['runasp.net', 'netlify.app'];
        const servedFromHostedDomain = hostedDomains.some((domain) =>
            hostname.endsWith(domain)
        );

        return servedFromHostedDomain ? HOSTED_BASE_URL : HOSTED_BASE_URL;
    };

    const decodeJwtPayload = (token) => {
        try {
            const base64Payload = token.split('.')[1];
            const jsonPayload = atob(base64Payload);
            return JSON.parse(jsonPayload);
        } catch (error) {
            console.error('Unable to decode JWT payload', error);
            return null;
        }
    };

    const getAuthToken = () => {
        const authData = getStoredAuth();
        return authData?.jwt ?? null;
    };

    const getUserId = () => {
        const token = getAuthToken();
        if (!token) return null;

        const payload = decodeJwtPayload(token);
        if (!payload) return null;

        const idCandidate =
            payload.sub ||
            payload.nameid ||
            payload.UserId ||
            payload.userId ||
            payload.id;

        if (!idCandidate) return null;

        const parsed = parseInt(idCandidate, 10);
        return Number.isNaN(parsed) ? idCandidate : parsed;
    };

    window.CartifyApi = {
        baseUrl: resolveBaseUrl(),
        getAuthToken,
        getUserId,
        getAuthData: getStoredAuth,
        requireAuth(callback) {
            const token = getAuthToken();
            if (!token && typeof callback === 'function') {
                callback();
            }
            return token;
        },
    };
})(window);

