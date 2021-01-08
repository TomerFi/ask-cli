const url = require('url');

const jsonView = require('@src/view/json-view');
const logStore = require('./log-store');

const isCodeSuccessfulDefault = (responseCode) => responseCode >= 200 && responseCode < 300;

class HttpResponseError extends Error {
    constructor(response) {
        super(`http request failed with status code: ${response.statusCode}`);
        this.name = 'HttpClientResponseError';
        this.statusCode = response.statusCode;
        this.headers = response.headers;
        this.responseBody = response.body;
    }
}

module.exports = class HttpClient {
    constructor({ debug = false, isCodeSuccessful = isCodeSuccessfulDefault }) {
        this.debug = debug;
        this.isCodeSuccessful = isCodeSuccessful;
    }

    stringifyHeaders(item) {
        const headers = JSON.stringify(item.headers);
        return { ...item, headers };
    }

    logRequest(req) {
        logStore.push('REQUEST:');
        logStore.push(jsonView.toString(this.stringifyHeaders(req)));
    }

    logResponse(res) {
        logStore.push('RESPONSE:');
        const message = this.stringifyHeaders(res);
        const requestId = res.headers['x-amzn-requestid'];
        message['request-id'] = requestId ? requestId.value : null;
        logStore.push(jsonView.toString(message));
    }

    invoke(request) {
        if (this.debug) {
            this.logRequest(request);
        }
        const urlObj = url.parse(request.url);

        const clientRequestOptions = {
            hostname: urlObj.hostname,
            path: urlObj.path,
            port: urlObj.port,
            protocol: urlObj.protocol,
            auth: urlObj.auth,
            headers: request.headers,
            method: request.method,
        };

        // eslint-disable-next-line global-require
        const client = clientRequestOptions.protocol === 'https:' ? require('https') : require('http');

        return new Promise((resolve, reject) => {
            const clientRequest = client.request(clientRequestOptions, (response) => {
                const chunks = [];
                response.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                response.on('end', () => {
                    const responseStr = Buffer.concat(chunks).toString();

                    const responseObj = {
                        statusCode: response.statusCode,
                        body: responseStr,
                        headers: response.headers,
                    };

                    if (this.debug) {
                        this.logResponse(responseObj);
                    }

                    if (this.isCodeSuccessful(response.statusCode)) {
                        resolve(responseObj);
                    } else {
                        reject(new HttpResponseError(responseObj));
                    }
                });
            });

            clientRequest.on('error', (err) => {
                reject(err);
            });

            if (request.body) {
                clientRequest.write(request.body);
            }

            clientRequest.end();
        });
    }
};
