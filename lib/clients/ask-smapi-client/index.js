const { CustomSmapiClientBuilder } = require('ask-smapi-sdk');

const AppConfig = require('@src/model/app-config');
const AuthorizationController = require('@src/controllers/authorization-controller');
const DynamicConfig = require('@src/utils/dynamic-config');
const HttpClient = require('@src/clients/http-client-promise');

const errorDecorator = (request, response) => {
    if (request.url.endsWith('/auth/O2/token') && response.body.includes('invalid_grant')) {
        return new Error('custom error. please try refreshing access token');
    }
    return new Error('boom');
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

    const apiClient = new HttpClient({ debug, errorDecorator });
    const client = new CustomSmapiClientBuilder()
        .withAuthEndpoint(authEndpoint)
        .withApiEndpoint(smapiEndpoint)
        .withApiClient(apiClient)
        .withRefreshTokenConfig(refreshTokenConfig)
        .withCustomUserAgent(DynamicConfig.userAgent)
        .client();

    return client;
};

module.exports = {
    makeSmapiClient
};
