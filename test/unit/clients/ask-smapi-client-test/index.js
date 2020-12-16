const { expect } = require('chai');
const sinon = require('sinon');
const { services } = require('ask-smapi-model');
const { CustomSmapiClientBuilder } = require('ask-smapi-sdk');
const proxyquire = require('proxyquire');
const AppConfig = require('@src/model/app-config');
const AuthorizationController = require('@src/controllers/authorization-controller');

const logStoreStub = [];
const { makeSmapiClient, logRequest, logResponse } = proxyquire('@src/clients/ask-smapi-client', { './log-store': logStoreStub });

describe('Ask Smapi client test', () => {
    const profile = 'TEST';
    let withRequestInterceptorsStub;
    let withResponseInterceptorsStub;
    let clientStub;
    beforeEach(() => {
        sinon.stub(AppConfig.prototype, '_validateFilePath');
        sinon.stub(AppConfig.prototype, 'read');
        sinon.stub(AppConfig, 'getInstance').returns({
            getToken() {
                return { refresh_token: 'test' };
            }
        });
        sinon.stub(AuthorizationController.prototype, '_getAuthClientInstance').returns(
            { config: {} }
        );
        withRequestInterceptorsStub = sinon.stub();
        withResponseInterceptorsStub = sinon.stub();
        clientStub = { apiConfiguration: { apiEndpoint: null },
            withRequestInterceptors: withRequestInterceptorsStub,
            withResponseInterceptors: withResponseInterceptorsStub };
    });

    it('| should make smapi client', () => {
        const client = makeSmapiClient({ profile });

        expect(client).instanceOf(services.skillManagement.SkillManagementServiceClient);
    });

    it('| should make smapi client and configure debug logger', () => {
        sinon.stub(CustomSmapiClientBuilder.prototype, 'client').returns(clientStub);
        makeSmapiClient({ profile, debug: true });

        expect(withRequestInterceptorsStub.args[0][0]).eql(logRequest);
        expect(withResponseInterceptorsStub.args[0][0]).eql(logResponse);
    });

    it('| should log request and response', () => {
        const req = { body: {}, headers: [{ key: 'foo', value: 'bar' }], url: 'http://foo.com', method: 'GET' };
        logRequest(req);
        let res = { body: {}, headers: [{ key: 'foo', value: 'bar' }], statusCode: 200 };
        logResponse(res);

        res = { body: {}, headers: [{ key: 'foo', value: 'bar' }, { key: 'x-amzn-requestid', value: 'xxx' }], statusCode: 200 };
        logResponse(res);

        expect(logStoreStub[0]).eql('REQUEST:');
        expect(logStoreStub[1]).eql('{\n  "body": {},\n  "headers": "{\\"foo\\":\\"bar\\"}",\n  "url": "http://foo.com",\n  "method": "GET"\n}');
        expect(logStoreStub[2]).eql('RESPONSE:');
        expect(logStoreStub[3]).eql('{\n  "body": {},\n  "headers": "{\\"foo\\":\\"bar\\"}",\n  "statusCode": 200,\n  "request-id": null\n}');
        expect(logStoreStub[4]).eql('RESPONSE:');
        expect(logStoreStub[5]).eql('{\n  "body": {},\n  "headers": "{\\"foo\\":\\"bar\\",\\"x-amzn-requestid\\":\\"xxx\\"}",'
        + '\n  "statusCode": 200,\n  "request-id": "xxx"\n}');
    });

    afterEach(() => {
        sinon.restore();
    });
});
