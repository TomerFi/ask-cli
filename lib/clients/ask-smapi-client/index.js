const { CustomSmapiClientBuilder } = require('ask-smapi-sdk');

const AppConfig = require('@src/model/app-config');
const AuthorizationController = require('@src/controllers/authorization-controller');
const DynamicConfig = require('@src/utils/dynamic-config');
const jsonView = require('@src/view/json-view');
const logStore = require('./log-store');

const _stringifyHeaders = (item) => {
    let headers = {};
    item.headers.forEach(h => {
        headers[h.key] = h.value;
    });
    headers = JSON.stringify(headers);
    return { ...item, headers };
};

/**
 * @param {Object}request Request object
 * @param {Array<{key, value}>} request.headers Array of headers
 * @param {string} request.method HTTP method
 * @param {string} request.url HTTP url
 * @param {Object} request.body HTTP body
 */
const logRequest = (req) => {
    logStore.push('REQUEST:');
    logStore.push(jsonView.toString(_stringifyHeaders(req)));
};

/**
 * @param {Object} response Response object
 * @param {Array<{key, value}>} response.headers Array of headers
 * @param {string} response.statusCode HTTP status code
 * @param {Object} response.body HTTP body
 */
const logResponse = (res) => {
    logStore.push('RESPONSE:');
    const message = _stringifyHeaders(res);
    const requestId = res.headers.find(h => h.key === 'x-amzn-requestid');
    message['request-id'] = requestId ? requestId.value : null;
    logStore.push(jsonView.toString(message));
};

/**
 * @param {Object} config Configuration object
 * @param {string} config.profile ASK CLI profile
 * @param {boolean} config.debug debug flag
 */
const makeSmapiClient = ({ profile, debug = false }) => {
    new AppConfig();
    const authorizationController = new AuthorizationController({
        auth_client_type: 'LWA',
        doDebug: debug
    });

    const refreshTokenConfig = {
        clientId: authorizationController.oauthClient.config.clientId,
        clientSecret: authorizationController.oauthClient.config.clientConfirmation,
        refreshToken: AppConfig.getInstance().getToken(profile).refresh_token
    };
    const authEndpoint = DynamicConfig.lwaTokenHost;
    const smapiEndpoint = DynamicConfig.smapiBaseUrl;

    const client = new CustomSmapiClientBuilder()
        .withAuthEndpoint(authEndpoint)
        .withApiEndpoint(smapiEndpoint)
        .withRefreshTokenConfig(refreshTokenConfig)
        .withCustomUserAgent(DynamicConfig.userAgent)
        .client();

    if (debug) {
        client.withRequestInterceptors(logRequest);
        client.withResponseInterceptors(logResponse);
    }

    return client;
};

module.exports = {
    makeSmapiClient,
    logRequest,
    logResponse
};
