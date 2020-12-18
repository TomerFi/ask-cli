const url = require('url');

const jsonView = require('@src/view/json-view');
const logStore = require('./log-store');

const arrayToObjectHeader = (header) => {
    const reducer = (obj, item) => {
        if (obj[item.key]) {
            obj[item.key].push(item.value);
        } else {
            obj[item.key] = [item.value];
        }
        return obj;
    };

    return header.reduce(reducer, {});
};
const objectToArrayHeader = (header) => {
    const arrayHeader = [];
    Object.keys(header).forEach((key) => {
        const headerArray = Array.isArray(header[key]) ? header[key] : [header[key]];
        for (const value of headerArray) {
            arrayHeader.push({ key, value });
        }
    });

    return arrayHeader;
};

class ResponseError extends Error {
    constructor(message, response) {
        super(message); // (1)
        this.name = 'ResponseError';
        this.response = response;
    }
}

const defaultErrorDecorator = (request, response) => new ResponseError('Request failed.', response);

module.exports = class HttpClient {
    constructor({ debug = false, minErrorCode = 400, errorDecorator = defaultErrorDecorator }) {
        this.debug = debug;
        this.minErrorCode = minErrorCode;
        this.errorDecorator = errorDecorator;
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
        const headers = arrayToObjectHeader(request.headers);
        if (this.debug) {
            this.logRequest({ ...request, headers });
        }
        const urlObj = url.parse(request.url);

        const clientRequestOptions = {
            hostname: urlObj.hostname,
            path: urlObj.path,
            port: urlObj.port,
            protocol: urlObj.protocol,
            auth: urlObj.auth,
            headers,
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

                    responseObj.headers = objectToArrayHeader(response.headers);

                    if (response.statusCode >= this.minErrorCode) {
                        reject(this.errorDecorator(request, responseObj));
                    } else {
                        resolve(responseObj);
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
